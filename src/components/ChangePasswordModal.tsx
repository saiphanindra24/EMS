"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { api, ApiClientError } from "@/lib/api-client";
import { validatePasswordStrength, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { PasswordStrengthIndicator } from "./PasswordStrengthIndicator";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordForm>();

  const newPassword = watch("newPassword") || "";

  if (!isOpen) return null;

  const handleClose = () => {
    reset();
    setError(null);
    setSuccess(false);
    onClose();
  };

  const onSubmit = async (values: ChangePasswordForm) => {
    setError(null);

    // Client-side strength check
    const strengthError = validatePasswordStrength(values.newPassword);
    if (strengthError) {
      setError(strengthError);
      return;
    }

    if (values.newPassword !== values.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/change-password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });

      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 1800);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-900/10 z-10 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Change Password</h3>
              <p className="text-xs text-slate-500">Update your account login password</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        {success ? (
          <div className="py-8 text-center animate-scale-in">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">
              ✅
            </div>
            <h4 className="text-base font-bold text-slate-900">Password Changed!</h4>
            <p className="mt-1 text-xs text-slate-500">Your password has been successfully updated.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  {...register("currentPassword", { required: "Current password is required" })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 pr-10 text-sm text-slate-900 transition-all focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                >
                  {showCurrentPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="mt-1 text-xs text-red-600">{errors.currentPassword.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  {...register("newPassword", {
                    required: "New password is required",
                    minLength: {
                      value: MIN_PASSWORD_LENGTH,
                      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
                    },
                  })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 pr-10 text-sm text-slate-900 transition-all focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                >
                  {showNewPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>
              )}
              {newPassword && <PasswordStrengthIndicator password={newPassword} />}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  {...register("confirmPassword", {
                    required: "Please confirm new password",
                    validate: (v) => v === newPassword || "Passwords do not match",
                  })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 pr-10 text-sm text-slate-900 transition-all focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs text-red-700 ring-1 ring-inset ring-red-200/50">
                <span>⚠️</span> {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="brand-gradient-btn rounded-xl px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-all disabled:opacity-50"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
