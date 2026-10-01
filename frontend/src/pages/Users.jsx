import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import Modal from "../components/Modal";

const ROLES = ["user", "manager", "admin"];

// Admin-only page (enforced by server and client route guard)
export default function Users() {
  const { user: me } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");

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

  const load = () => {
    setLoading(true);
    return api
      .listUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

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

  const filteredUsers = useMemo(() => {
    if (!query.trim()) return users;
    const q = query.toLowerCase();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, query]);

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
          <input
            type="search"
            placeholder="Search users…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ padding: "6px 12px", minWidth: "200px" }}
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

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
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

            {!loading && filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="muted center">
                  {users.length === 0 ? "No users registered." : "No matching users found."}
                </td>
              </tr>
            )}

            {filteredUsers.map((u) => {
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
                required
                value={form.username}
                placeholder="e.g. rahul.m"
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>

            <label>
              Password <span style={{ color: "red" }}>*</span>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                placeholder="At least 6 characters"
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>

            <label>
              Email (Optional)
              <input
                type="email"
                value={form.email}
                placeholder="user@example.com"
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>

            <label>
              Assign Role <span style={{ color: "red" }}>*</span>
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

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
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
