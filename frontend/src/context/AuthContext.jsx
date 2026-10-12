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

      if (data.status === "mfa_required") {
        return {
          mfaRequired: true,
          tempToken: data.temp_token,
          emailMasked: data.email_masked,
          message: data.message,
        };
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
    } catch (err) {
      console.error("Login request failed:", err);
      const msg = "Unable to connect to authentication server. Please check if backend is waking up or verify CORS.";
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const verifyMFA = async (tempToken, code) => {
    setAuthError("");
    try {
      const response = await apiClient("/api/v1/auth/mfa/verify/", {
        method: "POST",
        body: JSON.stringify({ temp_token: tempToken, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = data.code?.[0] || data.detail || "Invalid or expired security code.";
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
    } catch (err) {
      console.error("MFA verification error:", err);
      const msg = "Network error during two-factor verification. Please try again.";
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const register = async (registrationData) => {
    setAuthError("");
    try {
      const response = await apiClient("/api/v1/auth/register/", {
        method: "POST",
        body: JSON.stringify(registrationData),
      });

      const data = await response.json();

      if (!response.ok) {
        let msg = "Registration failed. Please check form inputs.";
        if (data.email) msg = Array.isArray(data.email) ? data.email[0] : data.email;
        else if (data.password) msg = Array.isArray(data.password) ? data.password[0] : data.password;
        else if (data.confirm_password) msg = Array.isArray(data.confirm_password) ? data.confirm_password[0] : data.confirm_password;
        else if (data.detail) msg = data.detail;
        else if (data.non_field_errors) msg = data.non_field_errors[0];

        setAuthError(msg);
        return { success: false, error: msg, details: data };
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

      return { success: true, user: data.user, message: data.message };
    } catch (err) {
      console.error("Registration error:", err);
      const msg = "Unable to connect to server during registration. Please verify network.";
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const forgotPassword = async (email) => {
    setAuthError("");
    try {
      const response = await apiClient("/api/v1/auth/forgot-password/", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        const msg = data.email?.[0] || data.detail || "Unable to request password reset.";
        setAuthError(msg);
        return { success: false, error: msg };
      }

      return {
        success: true,
        emailMasked: data.email_masked,
        message: data.message,
      };
    } catch (err) {
      console.error("Forgot password error:", err);
      const msg = "Unable to connect to server. Please try again.";
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const resetPassword = async (email, code, newPassword, confirmPassword) => {
    setAuthError("");
    try {
      const response = await apiClient("/api/v1/auth/reset-password/", {
        method: "POST",
        body: JSON.stringify({
          email,
          code,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        let msg = "Failed to reset password.";
        if (data.code) msg = Array.isArray(data.code) ? data.code[0] : data.code;
        else if (data.new_password) msg = Array.isArray(data.new_password) ? data.new_password[0] : data.new_password;
        else if (data.confirm_password) msg = Array.isArray(data.confirm_password) ? data.confirm_password[0] : data.confirm_password;
        else if (data.detail) msg = data.detail;

        setAuthError(msg);
        return { success: false, error: msg };
      }

      return { success: true, message: data.message };
    } catch (err) {
      console.error("Reset password error:", err);
      const msg = "Unable to connect to server. Please try again.";
      setAuthError(msg);
      return { success: false, error: msg };
    }
  };

  const toggleMFA = async (enable) => {
    try {
      const response = await apiClient("/api/v1/auth/mfa/toggle/", {
        method: "POST",
        body: JSON.stringify({ enable }),
      });

      const data = await response.json();
      if (response.ok && user) {
        setUser((prev) => ({ ...prev, mfa_enabled: data.mfa_enabled }));
      }
      return data;
    } catch (err) {
      console.error("MFA toggle error:", err);
      return { success: false, error: "Network error toggling MFA" };
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
    register,
    verifyMFA,
    forgotPassword,
    resetPassword,
    toggleMFA,
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
