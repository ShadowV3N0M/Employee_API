import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { isPrivileged, useAuth } from "../auth";
import { formatMoney } from "../format";
import EmployeeForm from "../components/EmployeeForm";
import ExcelImportModal from "../components/ExcelImportModal";
import HistoryModal from "../components/HistoryModal";
import SalaryModal from "../components/SalaryModal";


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
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState(null); // { type: "form" | "salary" | "history", employee }
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    api
      .listEmployees({
        page,
        limit: PAGE_SIZE,
        sort_by: sortBy,
        order,
        include_inactive: showInactive,
      })
      .then((res) => {
        if (cancelled) return;
        // Deactivating the last row of the last page leaves it empty: step back
        if (res.items.length === 0 && page > 1) setPage(page - 1);
        else setData(res);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [page, sortBy, order, showInactive, reloadKey]);

  function toggleSort(field) {
    if (sortBy === field) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSortBy(field);
      setOrder("asc");
    }
    setPage(1);
  }

  const arrow = (field) => (sortBy === field ? (order === "asc" ? " ▲" : " ▼") : "");

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

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const columnCount = privileged ? 8 : 5;

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Employees</h2>
          <p className="muted">
            {data.total} {data.total === 1 ? "employee" : "employees"}
            {!privileged && " · salary and address are visible to managers and admins only"}
          </p>
        </div>

        <div className="toolbar">
          {privileged && (
            <label className="check">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => {
                  setShowInactive(e.target.checked);
                  setPage(1);
                }}
              />
              Show inactive
            </label>
          )}
          {privileged && (
            <button className="btn primary" onClick={() => setModal({ type: "form", employee: null })}>
              + Add employee
            </button>
          )}
          {isAdmin && (
            <button className="btn secondary" onClick={() => setModal({ type: "excel" })}>
              📊 Excel Hub (Import/Delete)
            </button>
          )}
          <a
            href={api.exportEmployeesUrl(showInactive)}
            download="employees.csv"
            className="btn ghost"
            style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
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

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => toggleSort("Emp_ID")}>ID{arrow("Emp_ID")}</th>
              <th className="sortable" onClick={() => toggleSort("F_Name")}>Name{arrow("F_Name")}</th>
              <th>Email</th>
              <th className="sortable" onClick={() => toggleSort("Dept_ID")}>Department{arrow("Dept_ID")}</th>
              {privileged && (
                <th className="sortable num" onClick={() => toggleSort("Salary")}>Salary{arrow("Salary")}</th>
              )}
              {privileged && <th>Address</th>}
              <th>Status</th>
              {privileged && <th className="right">Actions</th>}
            </tr>
          </thead>

          <tbody>
            {loading && data.items.length === 0 && (
              <tr><td colSpan={columnCount} className="muted center">Loading…</td></tr>
            )}

            {!loading && data.items.length === 0 && !error && (
              <tr><td colSpan={columnCount} className="muted center">No employees to show.</td></tr>
            )}

            {data.items.map((emp) => (
              <tr key={emp.Emp_ID} className={emp.is_active ? "" : "inactive"}>
                <td>{emp.Emp_ID}</td>
                <td>{emp.F_Name} {emp.L_Name}</td>
                <td>{emp.Email || "—"}</td>
                <td>{deptName[emp.Dept_ID] ?? `#${emp.Dept_ID}`}</td>
                {privileged && <td className="num">{formatMoney(emp.Salary)}</td>}
                {privileged && <td className="truncate" title={emp.Address}>{emp.Address}</td>}
                <td>
                  <span className={`badge ${emp.is_active ? "ok" : "off"}`}>
                    {emp.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                {privileged && (
                  <td className="right nowrap">
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
                  </td>
                )}
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
