import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Employees from "./pages/Employees";
import Departments from "./pages/Departments";
import Analytics from "./pages/Analytics";
import Users from "./pages/Users";
import SalaryCalculator from "./pages/SalaryCalculator";
import Holidays from "./pages/Holidays";
import Profile from "./pages/Profile";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import { NotificationProvider } from "./context/NotificationContext";

// Guards a route: must be logged in, and (optionally) have one of `roles`.
function RequireAuth({ roles, children }) {
  const { user, loading } = useAuth();

  if (loading) return <p className="center-note">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <NotFound type="403" />;

  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Authenticated routes inside Layout */}
      <Route
        element={
          <RequireAuth>
            <NotificationProvider>
              <Layout />
            </NotificationProvider>
          </RequireAuth>
        }
      >
        <Route path="/" element={<Employees />} />
        <Route path="/departments" element={<Departments />} />
        <Route path="/salary-calculator" element={<SalaryCalculator />} />
        <Route path="/holidays" element={<Holidays />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/reports" element={<Reports />} />
        <Route
          path="/analytics"
          element={
            <RequireAuth>
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
        <Route path="/404" element={<NotFound />} />
        {user && <Route path="*" element={<NotFound />} />}
      </Route>

      {/* Unauthenticated or Standalone 404 fallback */}
      <Route path="/404" element={<NotFound standalone />} />
      <Route path="*" element={<NotFound standalone />} />
    </Routes>
  );
}
