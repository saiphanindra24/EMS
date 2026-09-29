"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { api, ApiClientError } from "@/lib/api-client";
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT, validatePasswordStrength } from "@/lib/password";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordForm>();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const password = watch("password") || "";

  const onSubmit = async (values: ResetPasswordForm) => {
    setError(null);

    const strengthError = validatePasswordStrength(values.password);
    if (strengthError) {
      setError(strengthError);
      return;
    }

    if (values.password !== values.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/reset-password", {
        token,
        password: values.password,
      });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 30%, #312e81 60%, #1e1b4b 100%)" }} />
      <div className="absolute top-[-20%] right-[-10%] h-[600px] w-[600px] rounded-full opacity-25" style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)", animation: "pulse-glow 6s ease infinite" }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

      <header className="relative z-10 flex items-center px-6 py-4 sm:px-10">
        <Link href="/login" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
            <BrandLogo variant="mark" className="h-6 w-6 object-contain brightness-0 invert" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">VolkssKatt</p>
            <p className="text-[10px] font-medium text-violet-300/70 tracking-widest uppercase">Password Reset</p>
          </div>
        </Link>
      </header>

      <section className="relative z-10 flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-1.5 backdrop-blur-xl shadow-2xl">
            <div className="rounded-2xl bg-white p-8 sm:p-10">
              {success ? (
                <div className="text-center animate-scale-in">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">✅</div>
                  <h2 className="text-xl font-bold text-slate-900">Password reset complete</h2>
                  <p className="mt-2 text-sm text-slate-500">Your password has been updated successfully. Redirecting to login...</p>
                </div>
              ) : (
                <>
                  <div className="mb-7">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 mb-4">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-700">Create a new password</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Reset your password</h2>
                    <p className="mt-1 text-sm text-slate-500">Choose a strong password to protect your account.</p>
                  </div>

                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">New password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          {...register("password", {
                            required: "Password is required",
                            minLength: {
                              value: MIN_PASSWORD_LENGTH,
                              message: `Min ${MIN_PASSWORD_LENGTH} characters`,
                            },
                          })}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 pr-10 text-sm text-slate-900 transition-all duration-200 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100"
                          placeholder="••••••••"
                        />
                        <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={showPassword ? "Hide password" : "Show password"}>
                          {showPassword ? (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                          ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{PASSWORD_HINT}</p>
                      {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          {...register("confirmPassword", {
                            required: "Please confirm your password",
                            validate: (value) => value === password || "Passwords do not match",
                          })}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 pr-10 text-sm text-slate-900 transition-all duration-200 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100"
                          placeholder="••••••••"
                        />
                        <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
                          {showConfirmPassword ? (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                          ) : (
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          )}
                        </button>
                      </div>
                      {errors.confirmPassword && <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>}
                    </div>

                    {password && <PasswordStrengthIndicator password={password} />}

                    {error && (
                      <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200/50">
                        <span>⚠️</span> {error}
                      </div>
                    )}

                    <button type="submit" disabled={loading} className="brand-gradient-btn w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50">
                      {loading ? "Resetting..." : "Reset Password"}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
