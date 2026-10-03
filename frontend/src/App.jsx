import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Employees from "./pages/Employees";
import Departments from "./pages/Departments";
import Analytics from "./pages/Analytics";
import Users from "./pages/Users";

// Guards a route: must be logged in, and (optionally) have one of `roles`.
function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="center-note">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Employees />} />
        <Route path="/departments" element={<Departments />} />
        <Route
          path="/analytics"
          element={
            <RequireAuth roles={["manager", "admin"]}>
              <Analytics />
            </RequireAuth>
          }
        />
        <Route
          path="/users"
          element={
            <RequireAuth roles={["admin"]}>
              <Users />
            </RequireAuth>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
