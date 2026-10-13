import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import LoginPage from "../components/LoginPage";
import * as AuthContextModule from "../context/AuthContext";

describe("Enterprise Authentication Suite", () => {
  let mockLogin;
  let mockRegister;
  let mockForgotPassword;
  let mockResetPassword;
  let mockVerifyMFA;
  let mockClearError;

  beforeEach(() => {
    mockLogin = vi.fn().mockResolvedValue({ success: true });
    mockRegister = vi.fn().mockResolvedValue({ success: true, message: "Welcome" });
    mockForgotPassword = vi.fn().mockResolvedValue({ success: true, emailMasked: "t***@company.com", message: "Code sent" });
    mockResetPassword = vi.fn().mockResolvedValue({ success: true, message: "Password updated" });
    mockVerifyMFA = vi.fn().mockResolvedValue({ success: true });
    mockClearError = vi.fn();

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: null,
      authError: "",
      clearError: mockClearError,
      login: mockLogin,
      register: mockRegister,
      forgotPassword: mockForgotPassword,
      resetPassword: mockResetPassword,
      verifyMFA: mockVerifyMFA,
      toggleMFA: vi.fn(),
    });
  });

  it("renders clean production sign-in form with empty inputs and no hardcoded credentials", () => {
    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: "SSKATT EWTS" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sign In$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Account/i })).toBeInTheDocument();

    const emailInput = screen.getByLabelText(/Work Email/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);

    expect(emailInput).toHaveValue("");
    expect(passwordInput).toHaveValue("");
    expect(emailInput).toHaveAttribute("placeholder", "name@company.com");
  });

  it("toggles password visibility when show/hide button is clicked", () => {
    render(<LoginPage />);

    const passwordInput = screen.getByLabelText(/^Password$/i);
    const toggleBtn = screen.getByRole("button", { name: /Show password/i });

    expect(passwordInput).toHaveAttribute("type", "password");

    fireEvent.click(toggleBtn);
    expect(passwordInput).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: /Hide password/i }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("switches to registration mode and submits valid employee signup", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: /Create Account/i }));

    expect(screen.getByLabelText(/First Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Last Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Department/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/First Name/i), { target: { value: "Eleanor" } });
    fireEvent.change(screen.getByLabelText(/Last Name/i), { target: { value: "Vance" } });
    fireEvent.change(screen.getByLabelText(/Work Email/i), { target: { value: "eleanor.vance@company.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "StrongPass2026!" } });
    fireEvent.change(screen.getByLabelText(/Confirm Password/i), { target: { value: "StrongPass2026!" } });

    const submitBtn = screen.getByRole("button", { name: /Register & Join Workspace/i });
    expect(submitBtn).not.toBeDisabled();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: "Eleanor",
          last_name: "Vance",
          email: "eleanor.vance@company.com",
          password: "StrongPass2026!",
          confirm_password: "StrongPass2026!",
        })
      );
    });
  });

  it("navigates to forgot password and requests 6-digit verification code", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: /Forgot Password\?/i }));

    expect(screen.getByRole("heading", { name: /Reset Password/i })).toBeInTheDocument();

    const emailInput = screen.getByLabelText(/Registered Email/i);
    fireEvent.change(emailInput, { target: { value: "developer@company.com" } });

    fireEvent.click(screen.getByRole("button", { name: /Send Verification Code/i }));

    await waitFor(() => {
      expect(mockForgotPassword).toHaveBeenCalledWith("developer@company.com");
    });
  });

  it("switches to MFA mode and verifies 6-digit security code", async () => {
    mockLogin.mockResolvedValueOnce({
      mfaRequired: true,
      tempToken: "sample-signed-token",
      emailMasked: "a***@company.com",
      message: "Two-factor verification required",
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText(/Work Email/i), { target: { value: "admin@emwts.local" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "AdminPass2026!" } });
    fireEvent.click(screen.getByRole("button", { name: /Sign In to Workspace/i }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Two-Factor Verification/i })).toBeInTheDocument();
    });

    const mfaInput = screen.getByLabelText(/Security Code/i);
    fireEvent.change(mfaInput, { target: { value: "654321" } });

    fireEvent.click(screen.getByRole("button", { name: /Confirm & Enter Workspace/i }));

    await waitFor(() => {
      expect(mockVerifyMFA).toHaveBeenCalledWith("sample-signed-token", "654321");
    });
  });
});
