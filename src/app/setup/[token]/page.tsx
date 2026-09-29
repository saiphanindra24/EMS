"use client";

import { useForm } from "react-hook-form";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/components/AuthProvider";
import { BrandLogo } from "@/components/BrandLogo";
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT, validatePasswordStrength } from "@/lib/password";
import { PasswordStrengthIndicator } from "@/components/PasswordStrengthIndicator";

interface SetupInfo {
  email: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
}

interface SetupForm {
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  personalEmail: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
}

export default function SetupPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [info, setInfo] = useState<SetupInfo | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SetupForm>();

  const password = watch("password");

  useEffect(() => {
    const validate = async () => {
      try {
        const data = await api.get<SetupInfo>(`/api/auth/setup/${token}`);
        setInfo(data);
      } catch (err) {
        setPageError(
          err instanceof ApiClientError
            ? err.message
            : "Invalid or expired setup link",
        );
      } finally {
        setLoading(false);
      }
    };
    validate();
  }, [token]);

  const onSubmit = async (values: SetupForm) => {
    setSubmitError(null);

    const strengthError = validatePasswordStrength(values.password);
    if (strengthError) {
      setSubmitError(strengthError);
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/api/auth/setup/${token}`, {
        password: values.password,
        dateOfBirth: values.dateOfBirth || undefined,
        gender: values.gender || undefined,
        phone: values.phone || undefined,
        personalEmail: values.personalEmail || undefined,
        address: values.address || undefined,
        emergencyContactName: values.emergencyContactName || undefined,
        emergencyContactPhone: values.emergencyContactPhone || undefined,
        emergencyContactRelation: values.emergencyContactRelation || undefined,
      });
      setSuccess(true);
      await refresh();
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch (err) {
      setSubmitError(
        err instanceof ApiClientError ? err.message : "Setup failed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e1b4b 30%, #312e81 60%, #1e1b4b 100%)",
        }}
      />
      <div
        className="absolute top-[-20%] right-[-10%] h-[600px] w-[600px] rounded-full opacity-25"
        style={{
          background: "radial-gradient(circle, #10b981 0%, transparent 70%)",
          animation: "pulse-glow 6s ease infinite",
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Header */}
      <header className="relative z-10 flex items-center px-6 py-4 sm:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
            <BrandLogo variant="mark" className="h-6 w-6 object-contain brightness-0 invert" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">VolkssKatt</p>
            <p className="text-[10px] font-medium text-violet-300/70 tracking-widest uppercase">
              Account Setup
            </p>
          </div>
        </div>
      </header>

      {/* Main */}
      <section className="relative z-10 flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl animate-fade-in-up">
          <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-1.5 backdrop-blur-xl shadow-2xl">
            <div className="rounded-2xl bg-white p-8 sm:p-10">
              {loading ? (
                <div className="flex flex-col items-center gap-4 py-12">
                  <div className="relative h-10 w-10">
                    <div className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
                    <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-violet-500 animate-spin" />
                  </div>
                  <p className="text-sm text-slate-400">Validating setup link...</p>
                </div>
              ) : pageError ? (
                <div className="text-center py-8">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-3xl">
                    ❌
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Setup Link Invalid
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">{pageError}</p>
                </div>
              ) : success ? (
                <div className="text-center animate-scale-in py-8">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">
                    🎉
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Welcome aboard, {info?.firstName}!
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Your account is ready. Redirecting to dashboard...
                  </p>
                  <div className="mt-4 relative h-1 w-40 mx-auto rounded-full bg-slate-100 overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-500 rounded-full animate-[shimmer_2s_ease_forwards]" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-7">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 mb-4">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold text-emerald-700">
                        Approved — {info?.employeeCode}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Set up your account
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Welcome, <strong>{info?.firstName} {info?.lastName}</strong>! Set your password and fill in your details.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                    {/* Password section */}
                    <div className="rounded-xl bg-slate-50 p-5 space-y-4">
                      <p className="text-sm font-semibold text-slate-900">🔐 Set your password</p>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Password
                          </label>
                          <input
                            type="password"
                            {...register("password", {
                              required: "Password is required",
                              minLength: {
                                value: MIN_PASSWORD_LENGTH,
                                message: `Min ${MIN_PASSWORD_LENGTH} characters`,
                              },
                            })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100"
                            placeholder="••••••••"
                          />
                          <p className="mt-1 text-xs text-slate-400">{PASSWORD_HINT}</p>
                          {errors.password && (
                            <p className="mt-1 text-xs text-red-600">
                              {errors.password.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Confirm password
                          </label>
                          <input
                            type="password"
                            {...register("confirmPassword", {
                              required: "Please confirm password",
                              validate: (v) =>
                                v === password || "Passwords do not match",
                            })}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100"
                            placeholder="••••••••"
                          />
                          {errors.confirmPassword && (
                            <p className="mt-1 text-xs text-red-600">
                              {errors.confirmPassword.message}
                            </p>
                          )}
                        </div>
                      </div>
                      {password && <PasswordStrengthIndicator password={password} />}
                    </div>

                    {/* Personal details */}
                    <div className="rounded-xl bg-slate-50 p-5 space-y-4">
                      <p className="text-sm font-semibold text-slate-900">
                        👤 Personal details <span className="font-normal text-slate-400">(optional)</span>
                      </p>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Date of birth
                          </label>
                          <input
                            type="date"
                            {...register("dateOfBirth")}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Gender
                          </label>
                          <select
                            {...register("gender")}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100"
                          >
                            <option value="">— select —</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Phone
                          </label>
                          <input
                            type="tel"
                            {...register("phone")}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100"
                            placeholder="+91 98765 43210"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Personal email
                        </label>
                        <input
                          type="email"
                          {...register("personalEmail")}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100"
                          placeholder="personal@email.com"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Address
                        </label>
                        <textarea
                          {...register("address")}
                          rows={2}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100 resize-none"
                          placeholder="Your address"
                        />
                      </div>
                    </div>

                    {/* Emergency contact */}
                    <div className="rounded-xl bg-slate-50 p-5 space-y-4">
                      <p className="text-sm font-semibold text-slate-900">
                        🚨 Emergency contact <span className="font-normal text-slate-400">(optional)</span>
                      </p>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Name
                          </label>
                          <input
                            {...register("emergencyContactName")}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Phone
                          </label>
                          <input
                            type="tel"
                            {...register("emergencyContactPhone")}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700">
                            Relation
                          </label>
                          <input
                            {...register("emergencyContactRelation")}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm transition-all duration-200 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100"
                            placeholder="e.g. Spouse, Parent"
                          />
                        </div>
                      </div>
                    </div>

                    {submitError && (
                      <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200/50">
                        <span>⚠️</span> {submitError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="brand-gradient-btn w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50"
                    >
                      {submitting ? (
                        <span className="inline-flex items-center gap-2">
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Setting up...
                        </span>
                      ) : (
                        "Complete Setup & Start"
                      )}
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
