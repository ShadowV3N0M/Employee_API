import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";

const ROLES = ["user", "manager", "admin"];

// Admin-only page (also enforced by the server)
export default function Users() {
  const { user: me } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = () =>
    api
      .listUsers()
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function changeRole(username, role) {
    setError("");
    setNotice("");
    try {
      await api.changeRole(username, role);
      setNotice(`${username} is now ${role}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Users</h2>
          <p className="muted">Everyone who registers starts as a plain user. Promote them here.</p>
        </div>
      </div>

      {notice && <div className="alert success">{notice}</div>}
      {error && <div className="alert error">{error}</div>}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr><th>ID</th><th>Username</th><th>Role</th><th>Status</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="muted center">Loading…</td></tr>}
            {users.map((u) => {
              const isMe = u.username === me.username;
              return (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.username} {isMe && <span className="muted small">(you)</span>}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={isMe}
                      title={isMe ? "You can't change your own role" : ""}
                      onChange={(e) => changeRole(u.username, e.target.value)}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? "ok" : "off"}`}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
