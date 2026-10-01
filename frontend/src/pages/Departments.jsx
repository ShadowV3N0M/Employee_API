import { useEffect, useState } from "react";
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
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    api
      .listDepartments()
      .then(setDepartments)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

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
      setNotice(`Department "${name.trim()}" created`);
      setName("");
      setBudget("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Departments</h2>
          <p className="muted">{departments.length} total</p>
        </div>
      </div>

      {notice && <div className="alert success">{notice}</div>}
      {error && <div className="alert error">{error}</div>}

      {isAdmin && (
        <form className="card inline-form" onSubmit={handleCreate}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={50} />
          </label>
          <label>
            Budget (optional)
            <input type="number" min="0" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </label>
          <button className="btn primary" disabled={busy}>{busy ? "Adding…" : "+ Add department"}</button>
        </form>
      )}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>ID</th><th>Name</th><th className="num">Budget</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={3} className="muted center">Loading…</td></tr>}
            {!loading && departments.length === 0 && (
              <tr><td colSpan={3} className="muted center">No departments yet.</td></tr>
            )}
            {departments.map((d) => (
              <tr key={d.Dept_ID}>
                <td>{d.Dept_ID}</td>
                <td>{d.Dept_Name}</td>
                <td className="num">{d.Budget == null ? "—" : formatMoney(d.Budget)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isAdmin && <p className="muted small">Only admins can create departments.</p>}
    </>
  );
}
