import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import Modal from "../components/Modal";
import SortByDropdown from "../components/SortByDropdown";

const ROLES = ["user", "manager", "admin"];

// Admin-only page (enforced by server and client route guard)
export default function Users() {
  const { user: me } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Filtration & sorting state
  const [sortBy, setSortBy] = useState("id");
  const [order, setOrder] = useState("asc");
  const [showFilters, setShowFilters] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Add User modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    email: "",
    role: "user",
  });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const load = () => {
    setLoading(true);
    const params = {
      search: debouncedSearch.trim() || undefined,
      role: roleFilter !== "all" ? roleFilter : undefined,
      is_active:
        statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined,
      sort_by: sortBy,
      order,
    };

    return api
      .listUsers(params)
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [debouncedSearch, roleFilter, statusFilter, sortBy, order]);

  function toggleSort(field) {
    if (sortBy === field) {
      setOrder(order === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setOrder("asc");
    }
  }

  const arrow = (field) =>
    sortBy === field ? (
      <span className="sort-indicator">{order === "asc" ? " ▲" : " ▼"}</span>
    ) : (
      <span className="sort-indicator muted" style={{ opacity: 0.35 }}>
        {" "}
        ⇅
      </span>
    );

  const sortOptions = [
    { value: "id", label: "User ID" },
    { value: "username", label: "Username" },
    { value: "email", label: "Official Email" },
    { value: "role", label: "Assigned Role" },
    { value: "is_active", label: "Account Status" },
  ];

  async function changeRole(username, role) {
    setError("");
    setNotice("");
    try {
      await api.changeRole(username, role);
      setNotice(`User '${username}' role updated to '${role}'.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleStatus(u) {
    if (u.username === me.username) return;
    const newStatus = !u.is_active;
    const action = newStatus ? "activate" : "deactivate";

    if (!window.confirm(`Are you sure you want to ${action} account for '${u.username}'?`)) {
      return;
    }

    setError("");
    setNotice("");
    try {
      const res = await api.changeUserStatus(u.username, newStatus);
      setNotice(res.message || `User '${u.username}' ${newStatus ? "activated" : "deactivated"} successfully.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteUser(u) {
    if (u.username === me.username) return;

    if (
      !window.confirm(
        `Are you sure you want to permanently delete user '${u.username}'?\n\nThis will completely remove their account and login access. This action cannot be undone.`
      )
    ) {
      return;
    }

    setError("");
    setNotice("");
    try {
      const res = await api.deleteUser(u.username);
      setNotice(res.message || `User '${u.username}' permanently deleted.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateUser(e) {
    e.preventDefault();
    setFormError("");

    if (!form.username.trim() || form.username.trim().length < 3) {
      setFormError("Username must be at least 3 characters long.");
      return;
    }
    if (!form.password || form.password.length < 6) {
      setFormError("Password must be at least 6 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createUser({
        username: form.username.trim(),
        password: form.password,
        email: form.email.trim() || undefined,
        role: form.role,
      });
      setNotice(res.message || `User '${form.username}' created successfully.`);
      setShowAddModal(false);
      setForm({ username: "", password: "", email: "", role: "user" });
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (roleFilter !== "all") count++;
    if (statusFilter !== "all") count++;
    return count;
  }, [searchTerm, roleFilter, statusFilter]);

  const clearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Users</h2>
          <p className="muted">
            Manage user accounts, assign roles, toggle account status, and permanently remove accounts.
          </p>
        </div>

        <div className="toolbar">
          <button
            type="button"
            className={`btn ${showFilters ? "primary" : "ghost"} filter-toggle-btn`}
            onClick={() => setShowFilters((prev) => !prev)}
            title={showFilters ? "Hide filtration bar" : "Show filtration bar"}
          >
            ⚡ Filter By
            {activeFilterCount > 0 && (
              <span className="filter-badge-active">{activeFilterCount}</span>
            )}
            <span style={{ fontSize: "0.7rem", marginLeft: "4px" }}>
              {showFilters ? "▲" : "▼"}
            </span>
          </button>

          <SortByDropdown
            options={sortOptions}
            sortBy={sortBy}
            order={order}
            onChange={(field, newOrder) => {
              setSortBy(field);
              setOrder(newOrder);
            }}
          />

          <button className="btn primary" onClick={() => setShowAddModal(true)}>
            + Add User
          </button>
        </div>
      </div>

      {notice && (
        <div className="alert success" onClick={() => setNotice("")}>
          {notice} <span className="dismiss">dismiss</span>
        </div>
      )}
      {error && <div className="alert error">{error}</div>}

      {/* Multi-field User Filtration Bar */}
      {showFilters && (
        <div className="filter-card">
          <div className="filter-bar">
            <div className="filter-group lg">
              <span className="filter-label">🔍 Search</span>
              <input
                type="search"
                className="filter-input"
                placeholder="Search by username, email, or ID…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <span className="filter-label">🛡️ Role</span>
              <select
                className="filter-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="user">User</option>
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-label">⚡ Status</span>
              <select
                className="filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            <div className="filter-actions">
              <button
                type="button"
                className="filter-clear-btn"
                onClick={clearFilters}
                disabled={activeFilterCount === 0}
                title="Reset all filters"
              >
                ✕ Reset Filters
                {activeFilterCount > 0 && (
                  <span className="filter-badge-active">{activeFilterCount}</span>
                )}
              </button>
            </div>
          </div>

          {activeFilterCount > 0 && (
            <div className="filter-summary">
              <div className="filter-chips">
                <span className="small muted">Active filters:</span>
                {searchTerm.trim() && (
                  <span className="filter-chip">
                    Search: "{searchTerm.trim()}"
                    <button
                      className="filter-chip-remove"
                      title="Remove search filter"
                      onClick={() => {
                        setSearchTerm("");
                        setDebouncedSearch("");
                      }}
                    >
                      ×
                    </button>
                  </span>
                )}
                {roleFilter !== "all" && (
                  <span className="filter-chip">
                    Role: {roleFilter}
                    <button
                      className="filter-chip-remove"
                      title="Remove role filter"
                      onClick={() => setRoleFilter("all")}
                    >
                      ×
                    </button>
                  </span>
                )}
                {statusFilter !== "all" && (
                  <span className="filter-chip">
                    Status: {statusFilter}
                    <button
                      className="filter-chip-remove"
                      title="Remove status filter"
                      onClick={() => setStatusFilter("all")}
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
              <span className="small muted">
                Showing {users.length} matching {users.length === 1 ? "user" : "users"}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th className="sortable sortable-th" onClick={() => toggleSort("id")}>
                <div className="th-content">ID{arrow("id")}</div>
              </th>
              <th className="sortable sortable-th" onClick={() => toggleSort("username")}>
                <div className="th-content">Username{arrow("username")}</div>
              </th>
              <th className="sortable sortable-th" onClick={() => toggleSort("email")}>
                <div className="th-content">Email{arrow("email")}</div>
              </th>
              <th className="sortable sortable-th" onClick={() => toggleSort("role")}>
                <div className="th-content">Role{arrow("role")}</div>
              </th>
              <th className="sortable sortable-th" onClick={() => toggleSort("is_active")}>
                <div className="th-content">Status{arrow("is_active")}</div>
              </th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="muted center">
                  Loading users…
                </td>
              </tr>
            )}

            {!loading && users.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="muted center" style={{ padding: "30px 10px" }}>
                  {activeFilterCount > 0
                    ? "No users matched the filter criteria."
                    : "No users registered."}
                  {activeFilterCount > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <button className="link" onClick={clearFilters}>
                        Clear filters to see all users
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )}

            {users.map((u) => {
              const isMe = u.username === me.username;
              return (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>
                    <strong>{u.username}</strong>{" "}
                    {isMe && <span className="badge role-admin" style={{ marginLeft: "4px" }}>you</span>}
                  </td>
                  <td>{u.email || <span className="muted">—</span>}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={isMe}
                      title={isMe ? "You cannot change your own role" : `Change role for ${u.username}`}
                      onChange={(e) => changeRole(u.username, e.target.value)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? "ok" : "off"}`}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="right nowrap">
                    <button
                      className="btn small ghost"
                      disabled={isMe}
                      onClick={() => toggleStatus(u)}
                      title={isMe ? "You cannot deactivate your own account" : (u.is_active ? "Deactivate account" : "Activate account")}
                      style={{ marginRight: "6px" }}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      className="btn small danger"
                      disabled={isMe}
                      onClick={() => handleDeleteUser(u)}
                      title={isMe ? "You cannot delete your own account" : `Delete ${u.username}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <Modal title="Create New User Account" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "10px 0" }}>
            {formError && <div className="alert error">{formError}</div>}

            <label>
              Username <span style={{ color: "red" }}>*</span>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
                minLength={3}
                placeholder="Unique username (min 3 chars)"
              />
            </label>

            <label>
              Email (optional)
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@example.com"
              />
            </label>

            <label>
              Password <span style={{ color: "red" }}>*</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                placeholder="Temporary password (min 6 chars)"
              />
            </label>

            <label>
              Role <span style={{ color: "red" }}>*</span>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setShowAddModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button type="submit" className="btn primary" disabled={submitting}>
                {submitting ? "Creating…" : "Create User"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
