import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { formatMoney } from "../format";

export default function Departments() {
  const { user } = useAuth();
  const isAdmin = user.role === "admin";

  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Creation form state
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);

  // Filtration state
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [minBudget, setMinBudget] = useState("");
  const [maxBudget, setMaxBudget] = useState("");

  // Debounce search
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
      min_budget: minBudget !== "" ? Number(minBudget) : undefined,
      max_budget: maxBudget !== "" ? Number(maxBudget) : undefined,
    };

    return api
      .listDepartments(params)
      .then(setDepartments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [debouncedSearch, minBudget, maxBudget]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await api.createDepartment({
        Dept_Name: name.trim(),
        Budget: budget === "" ? null : Number(budget),
      });
      setNotice(`Department "${name.trim()}" created successfully.`);
      setName("");
      setBudget("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (minBudget !== "") count++;
    if (maxBudget !== "") count++;
    return count;
  }, [searchTerm, minBudget, maxBudget]);

  const clearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setMinBudget("");
    setMaxBudget("");
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Departments</h2>
          <p className="muted">
            {departments.length} {departments.length === 1 ? "department" : "departments"}
          </p>
        </div>
      </div>

      {notice && (
        <div className="alert success" onClick={() => setNotice("")}>
          {notice} <span className="dismiss">dismiss</span>
        </div>
      )}
      {error && <div className="alert error">{error}</div>}

      {isAdmin && (
        <form className="card inline-form" onSubmit={handleCreate}>
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Data Science"
              required
              maxLength={50}
            />
          </label>
          <label>
            Budget (optional)
            <input
              type="number"
              min="0"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="e.g. 500000"
            />
          </label>
          <button className="btn primary" disabled={busy}>
            {busy ? "Adding…" : "+ Add department"}
          </button>
        </form>
      )}

      {/* Multi-field Department Filter Bar */}
      <div className="filter-card">
        <div className="filter-bar">
          <div className="filter-group lg">
            <span className="filter-label">🔍 Search</span>
            <input
              type="search"
              className="filter-input"
              placeholder="Search by name or Dept ID…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-group sm">
            <span className="filter-label">💰 Min Budget</span>
            <input
              type="number"
              min="0"
              step="1000"
              className="filter-input"
              placeholder="Min $"
              value={minBudget}
              onChange={(e) => setMinBudget(e.target.value)}
            />
          </div>

          <div className="filter-group sm">
            <span className="filter-label">💰 Max Budget</span>
            <input
              type="number"
              min="0"
              step="1000"
              className="filter-input"
              placeholder="Max $"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
            />
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
              {minBudget !== "" && (
                <span className="filter-chip">
                  Min Budget: ${Number(minBudget).toLocaleString()}
                  <button
                    className="filter-chip-remove"
                    title="Remove min budget filter"
                    onClick={() => setMinBudget("")}
                  >
                    ×
                  </button>
                </span>
              )}
              {maxBudget !== "" && (
                <span className="filter-chip">
                  Max Budget: ${Number(maxBudget).toLocaleString()}
                  <button
                    className="filter-chip-remove"
                    title="Remove max budget filter"
                    onClick={() => setMaxBudget("")}
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
            <span className="small muted">
              Showing {departments.length} matching departments
            </span>
          </div>
        )}
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th className="num">Budget</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="muted center">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && departments.length === 0 && !error && (
              <tr>
                <td colSpan={3} className="muted center" style={{ padding: "30px 10px" }}>
                  {activeFilterCount > 0
                    ? "No departments matched the filter criteria."
                    : "No departments yet."}
                  {activeFilterCount > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <button className="link" onClick={clearFilters}>
                        Clear filters to see all departments
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )}
            {departments.map((d) => (
              <tr key={d.Dept_ID}>
                <td>{d.Dept_ID}</td>
                <td>
                  <strong>{d.Dept_Name}</strong>
                </td>
                <td className="num">{d.Budget == null ? "—" : formatMoney(d.Budget)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isAdmin && <p className="muted small" style={{ marginTop: "12px" }}>Only admins can create departments.</p>}
    </>
  );
}
