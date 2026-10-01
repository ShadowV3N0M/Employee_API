import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";
import ThemeToggle from "./ThemeToggle";

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">Employee Management</span>

          <nav className="nav">
            <NavLink to="/" end>Employees</NavLink>
            <NavLink to="/departments">Departments</NavLink>
            {user.role === "admin" && <NavLink to="/users">Users</NavLink>}
          </nav>

          <div className="who">
            <ThemeToggle />
            <span>{user.username}</span>
            <span className={`badge role-${user.role}`}>{user.role}</span>
            <button className="btn ghost" onClick={logout}>Log out</button>
          </div>
        </div>
      </header>

      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
