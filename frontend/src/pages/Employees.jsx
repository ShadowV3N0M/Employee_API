import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { isPrivileged, useAuth } from "../auth";
import { formatMoney } from "../format";
import EmployeeDetailModal from "../components/EmployeeDetailModal";
import EmployeeForm from "../components/EmployeeForm";
import ExcelImportModal from "../components/ExcelImportModal";
import HistoryModal from "../components/HistoryModal";
import SalaryModal from "../components/SalaryModal";
import SortByDropdown from "../components/SortByDropdown";

const PAGE_SIZE = 10;

export default function Employees() {
  const { user } = useAuth();
  const privileged = isPrivileged(user.role); // manager or admin
  const isAdmin = user.role === "admin";

  const [data, setData] = useState({ items: [], total: 0 });
  const [departments, setDepartments] = useState([]);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("Emp_ID");
  const [order, setOrder] = useState("asc");
  const [showFilters, setShowFilters] = useState(true);

  // Multi-field filters
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // "active" | "inactive" | "all"
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(null); // { type: "detail" | "form" | "salary" | "history" | "excel", employee }
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => setReloadKey((k) => k + 1);
  const closeModal = () => setModal(null);

  // Departments are needed for names in the table and the form's dropdown
  useEffect(() => {
    api.listDepartments().then(setDepartments).catch(() => { });
  }, []);

  const deptName = useMemo(
    () => Object.fromEntries(departments.map((d) => [d.Dept_ID, d.Dept_Name])),
    [departments]
  );

  // Debounce search text input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load employees whenever pagination, sorting, or filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const params = {
      page,
      limit: PAGE_SIZE,
      sort_by: sortBy,
      order,
      search: debouncedSearch.trim() || undefined,
      dept_id: selectedDept ? Number(selectedDept) : undefined,
      status: privileged ? statusFilter : "active",
      min_salary: privileged && minSalary !== "" ? Number(minSalary) : undefined,
      max_salary: privileged && maxSalary !== "" ? Number(maxSalary) : undefined,
    };

    api
      .listEmployees(params)
      .then((res) => {
        if (cancelled) return;
        // If current page is empty after filtering or deactivating, step back
        if (res.items.length === 0 && page > 1) setPage(page - 1);
        else setData(res);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [
    page,
    sortBy,
    order,
    debouncedSearch,
    selectedDept,
    statusFilter,
    minSalary,
    maxSalary,
    privileged,
    reloadKey,
  ]);

  function toggleSort(field) {
    if (sortBy === field) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSortBy(field);
      setOrder("asc");
    }
    setPage(1);
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

  async function toggleActive(emp) {
    const verb = emp.is_active ? "deactivate" : "restore";
    if (!window.confirm(`Are you sure you want to ${verb} ${emp.F_Name} ${emp.L_Name}?`)) return;

    setError("");
    try {
      if (emp.is_active) await api.deactivateEmployee(emp.Emp_ID);
      else await api.restoreEmployee(emp.Emp_ID);
      setNotice(`${emp.F_Name} ${emp.L_Name} ${emp.is_active ? "deactivated" : "restored"}`);
      reload();
    } catch (err) {
      setError(err.message);
    }
  }

  function saved(message) {
    closeModal();
    setNotice(message);
    reload();
  }

  // Active filter count and reset
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (searchTerm.trim()) count++;
    if (selectedDept) count++;
    if (privileged && statusFilter !== "active") count++;
    if (privileged && minSalary !== "") count++;
    if (privileged && maxSalary !== "") count++;
    return count;
  }, [searchTerm, selectedDept, statusFilter, minSalary, maxSalary, privileged]);

  const clearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setSelectedDept("");
    setStatusFilter("active");
    setMinSalary("");
    setMaxSalary("");
    setPage(1);
  };

  const exportParams = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      dept_id: selectedDept ? Number(selectedDept) : undefined,
      status: privileged ? statusFilter : "active",
      min_salary: privileged && minSalary !== "" ? Number(minSalary) : undefined,
      max_salary: privileged && maxSalary !== "" ? Number(maxSalary) : undefined,
    }),
    [debouncedSearch, selectedDept, statusFilter, minSalary, maxSalary, privileged]
  );

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const columnCount = privileged ? 8 : 6;

  const sortOptions = useMemo(() => {
    const opts = [
      { value: "Emp_ID", label: "Employee ID" },
      { value: "F_Name", label: "First Name" },
      { value: "L_Name", label: "Last Name" },
      { value: "Dept_ID", label: "Department" },
      { value: "Email", label: "Official Email" },
      { value: "joining_date", label: "Joining Date" },
      { value: "is_active", label: "Account Status" },
    ];
    if (privileged) {
      opts.splice(4, 0, { value: "Salary", label: "Salary" });
    }
    return opts;
  }, [privileged]);

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Employees</h2>
          <p className="muted">
            {data.total} {data.total === 1 ? "employee" : "employees"}
            {!privileged && " · salary and address are visible to managers and admins only"}
          </p>
          <p className="muted small" style={{ margin: "4px 0 0 0" }}>
            💡 Click any employee row to open their profile popup
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
              setPage(1);
            }}
          />

          {privileged && (
            <button className="btn secondary" onClick={() => setModal({ type: "form", employee: null })}>
              + Add employee
            </button>
          )}
          {isAdmin && (
            <button className="btn secondary" onClick={() => setModal({ type: "excel" })}>
              📊 Excel Hub
            </button>
          )}
          <a
            href={api.exportEmployeesUrl(exportParams)}
            download="employees.csv"
            className="btn ghost"
            style={{ display: "inline-flex", alignItems: "center", textDecoration: "none", cursor: "pointer" }}
            title="Export currently filtered employees as CSV"
            onClick={async (e) => {
              e.preventDefault();
              try {
                await api.downloadBlob(
                  api.exportEmployeesUrl(exportParams),
                  "employees.csv"
                );
              } catch (err) {
                window.location.href = api.exportEmployeesUrl(exportParams);
              }
            }}
          >
            📤 Export CSV
          </a>
        </div>
      </div>

      {notice && (
        <div className="alert success" onClick={() => setNotice("")}>
          {notice} <span className="dismiss">dismiss</span>
        </div>
      )}
      {error && <div className="alert error">{error}</div>}

      {/* Multi-field Table Filter Bar */}
      {showFilters && (
        <div className="filter-card">
          <div className="filter-bar">
            <div className="filter-group lg">
              <span className="filter-label">🔍 Search</span>
              <input
                type="search"
                className="filter-input"
                placeholder="Search by name, email, or ID…"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="filter-group">
              <span className="filter-label">🏢 Department</span>
              <select
                className="filter-select"
                value={selectedDept}
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.Dept_ID} value={d.Dept_ID}>
                    {d.Dept_Name}
                  </option>
                ))}
              </select>
            </div>

            {privileged && (
              <div className="filter-group">
                <span className="filter-label">⚡ Status</span>
                <select
                  className="filter-select"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                  <option value="all">All (Active & Inactive)</option>
                </select>
              </div>
            )}

            {privileged && (
              <div className="filter-group sm">
                <span className="filter-label">💵 Min Salary</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  className="filter-input"
                  placeholder="Min $"
                  value={minSalary}
                  onChange={(e) => {
                    setMinSalary(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            )}

            {privileged && (
              <div className="filter-group sm">
                <span className="filter-label">💵 Max Salary</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  className="filter-input"
                  placeholder="Max $"
                  value={maxSalary}
                  onChange={(e) => {
                    setMaxSalary(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            )}

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
                {selectedDept && (
                  <span className="filter-chip">
                    Dept: {deptName[selectedDept] || selectedDept}
                    <button
                      className="filter-chip-remove"
                      title="Remove department filter"
                      onClick={() => setSelectedDept("")}
                    >
                      ×
                    </button>
                  </span>
                )}
                {privileged && statusFilter !== "active" && (
                  <span className="filter-chip">
                    Status: {statusFilter === "all" ? "All" : "Inactive Only"}
                    <button
                      className="filter-chip-remove"
                      title="Reset to Active Only"
                      onClick={() => setStatusFilter("active")}
                    >
                      ×
                    </button>
                  </span>
                )}
                {privileged && minSalary !== "" && (
                  <span className="filter-chip">
                    Min: ${Number(minSalary).toLocaleString()}
                    <button
                      className="filter-chip-remove"
                      title="Remove minimum salary filter"
                      onClick={() => setMinSalary("")}
                    >
                      ×
                    </button>
                  </span>
                )}
                {privileged && maxSalary !== "" && (
                  <span className="filter-chip">
                    Max: ${Number(maxSalary).toLocaleString()}
                    <button
                      className="filter-chip-remove"
                      title="Remove maximum salary filter"
                      onClick={() => setMaxSalary("")}
                    >
                      ×
                    </button>
                  </span>
                )}
              </div>
              <span className="small muted">
                Showing {data.items.length} of {data.total} matching records
              </span>
            </div>
          )}
        </div>
      )}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th className="sortable sortable-th" onClick={() => toggleSort("Emp_ID")}>
                <div className="th-content">ID{arrow("Emp_ID")}</div>
              </th>
              <th className="sortable sortable-th" onClick={() => toggleSort("F_Name")}>
                <div className="th-content">Name{arrow("F_Name")}</div>
              </th>
              <th className="sortable sortable-th" onClick={() => toggleSort("Email")}>
                <div className="th-content">Email{arrow("Email")}</div>
              </th>
              <th className="sortable sortable-th" onClick={() => toggleSort("Dept_ID")}>
                <div className="th-content">Department{arrow("Dept_ID")}</div>
              </th>
              {privileged && (
                <th className="sortable sortable-th num" onClick={() => toggleSort("Salary")}>
                  <div className="th-content" style={{ justifyContent: "flex-end" }}>Salary{arrow("Salary")}</div>
                </th>
              )}
              {privileged && <th>Address</th>}
              <th className="sortable sortable-th" onClick={() => toggleSort("is_active")}>
                <div className="th-content">Status{arrow("is_active")}</div>
              </th>
              <th className="right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loading && data.items.length === 0 && (
              <tr><td colSpan={columnCount} className="muted center">Loading…</td></tr>
            )}

            {!loading && data.items.length === 0 && !error && (
              <tr>
                <td colSpan={columnCount} className="muted center" style={{ padding: "30px 10px" }}>
                  No employees matched the selected filters.
                  {activeFilterCount > 0 && (
                    <div style={{ marginTop: "8px" }}>
                      <button className="link" onClick={clearFilters}>
                        Clear filters to see all employees
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )}

            {data.items.map((emp) => (
              <tr
                key={emp.Emp_ID}
                className={`clickable-row ${emp.is_active ? "" : "inactive"}`}
                onClick={() => setModal({ type: "detail", employee: emp })}
                title="Click to view full employee profile"
              >
                <td>{emp.Emp_ID}</td>
                <td><strong>{emp.F_Name} {emp.L_Name}</strong></td>
                <td>{emp.Email || "—"}</td>
                <td>{deptName[emp.Dept_ID] ?? `#${emp.Dept_ID}`}</td>
                {privileged && <td className="num">{formatMoney(emp.Salary)}</td>}
                {privileged && <td className="truncate" title={emp.Address}>{emp.Address}</td>}
                <td>
                  <span className={`badge ${emp.is_active ? "ok" : "off"}`}>
                    {emp.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="right nowrap" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="btn small ghost"
                    onClick={() => setModal({ type: "detail", employee: emp })}
                    title="View details"
                  >
                    View
                  </button>
                  {privileged && (
                    <>
                      <button className="btn small ghost" onClick={() => setModal({ type: "form", employee: emp })}>Edit</button>
                      <button className="btn small ghost" onClick={() => setModal({ type: "history", employee: emp })}>History</button>
                      {isAdmin && (
                        <>
                          <button className="btn small ghost" onClick={() => setModal({ type: "salary", employee: emp })}>Salary</button>
                          <button className="btn small danger" onClick={() => toggleActive(emp)}>
                            {emp.is_active ? "Deactivate" : "Restore"}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button className="btn ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
      </div>

      {modal?.type === "detail" && (
        <EmployeeDetailModal
          employee={modal.employee}
          departments={departments}
          role={user.role}
          onClose={closeModal}
          onEdit={(emp) => setModal({ type: "form", employee: emp })}
          onSalary={(emp) => setModal({ type: "salary", employee: emp })}
          onHistory={(emp) => setModal({ type: "history", employee: emp })}
          onToggleActive={toggleActive}
        />
      )}
      {modal?.type === "form" && (
        <EmployeeForm
          employee={modal.employee}
          departments={departments}
          role={user.role}
          onClose={closeModal}
          onSaved={saved}
        />
      )}
      {modal?.type === "salary" && (
        <SalaryModal employee={modal.employee} onClose={closeModal} onSaved={saved} />
      )}
      {modal?.type === "history" && <HistoryModal employee={modal.employee} onClose={closeModal} />}
      {modal?.type === "excel" && (
        <ExcelImportModal onClose={closeModal} onSuccess={saved} />
      )}
    </>
  );
}
