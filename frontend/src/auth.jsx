import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, clearToken, getToken, setToken, setUnauthorizedHandler } from "./api";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

// Convenience: managers and admins see the full employee record
export const isPrivileged = (role) => role === "manager" || role === "admin";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { username, role } or null
  const [loading, setLoading] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  // If any request ever comes back 401, drop the session
  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, [logout]);

  // On page load, restore the session from a saved token. The role comes from
  // the server (/auth/me), so a promotion shows up after a refresh.
  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (token) => {
    setToken(token);
    try {
      setUser(await api.me());
    } catch (err) {
      clearToken();
      throw err;
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
