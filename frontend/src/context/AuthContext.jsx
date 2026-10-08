import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiClient, setAccessToken } from "../services/apiClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient("/api/v1/auth/me/");
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setRoles(data.roles);
      } else {
        setUser(null);
        setRoles(null);
        setAccessToken(null);
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      setUser(null);
      setRoles(null);
      setAccessToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    setAuthError("");
    try {
      const response = await apiClient("/api/v1/auth/login/", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = data.non_field_errors?.[0] || data.detail || "Authentication failed. Please verify credentials.";
        setAuthError(msg);
        return { success: false, error: msg };
      }

      setAccessToken(data.access);
      setUser(data.user);
      setRoles({
        role: data.user.role,
        is_super_admin: data.user.role === "SUPER_ADMIN",
        is_hr_admin: data.user.role === "HR_ADMIN" || data.user.role === "SUPER_ADMIN",
        is_manager: ["MANAGER", "HR_ADMIN", "SUPER_ADMIN"].includes(data.user.role),
        is_employee: true,
      });

      return { success: true, user: data.user };
    } catch (_err) {
      const msg = "Unable to connect to authentication server.";
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      await apiClient("/api/v1/auth/logout/", {
        method: "POST",
      });
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      setAccessToken(null);
      setUser(null);
      setRoles(null);
    }
  };

  const value = {
    user,
    roles,
    isAuthenticated: Boolean(user),
    isLoading,
    authError,
    login,
    logout,
    checkAuth,
    clearError: () => setAuthError(""),
    isSuperAdmin: roles?.is_super_admin || false,
    isHRAdmin: roles?.is_hr_admin || false,
    isManager: roles?.is_manager || false,
    isEmployee: roles?.is_employee || false,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
