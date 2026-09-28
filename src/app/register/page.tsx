"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import Link from "next/link";
import { api, ApiClientError } from "@/lib/api-client";
import { BrandLogo } from "@/components/BrandLogo";

interface RegisterForm {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export default function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (values: RegisterForm) => {
    setError(null);
    setLoading(true);
    try {
      await api.post("/api/auth/register", values);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Registration failed");
    } finally {
      setLoading(false);
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
        className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, #6366f1 0%, transparent 70%)",
          animation: "pulse-glow 6s ease infinite",
        }}
      />
      <div
        className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, #a855f7 0%, transparent 70%)",
          animation: "pulse-glow 8s ease infinite 2s",
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
      <header className="relative z-10 flex items-center justify-between px-6 py-4 sm:px-10">
        <Link href="/login" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
            <BrandLogo variant="mark" className="h-6 w-6 object-contain brightness-0 invert" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">VolkssKatt</p>
            <p className="text-[10px] font-medium text-violet-300/70 tracking-widest uppercase">
              Infotech Pvt Ltd
            </p>
          </div>
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/10"
        >
          Sign In
        </Link>
      </header>

      {/* Main */}
      <section className="relative z-10 flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-1.5 backdrop-blur-xl shadow-2xl">
            <div className="rounded-2xl bg-white p-8 sm:p-10">
              {success ? (
                /* Success state */
                <div className="text-center animate-scale-in">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">
                    ✅
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Registration Submitted!
                  </h2>
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                    Your registration request has been submitted. An admin will
                    review and approve your account. You&apos;ll receive a setup
                    link once approved.
                  </p>
                  <Link
                    href="/login"
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-200"
                  >
                    ← Back to login
                  </Link>
                </div>
              ) : (
                /* Registration form */
                <>
                  <div className="mb-7">
                    <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 mb-4">
                      <span className="h-2 w-2 rounded-full bg-violet-500" />
                      <span className="text-xs font-semibold text-violet-700">
                        New Employee
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">
                      Create your account
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Register with your company email. An admin will approve
                      your account.
                    </p>
                  </div>

                  <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          First name
                        </label>
                        <input
                          {...register("firstName", {
                            required: "Required",
                          })}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100"
                          placeholder="John"
                        />
                        {errors.firstName && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.firstName.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">
                          Last name
                        </label>
                        <input
                          {...register("lastName", {
                            required: "Required",
                          })}
                          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100"
                          placeholder="Doe"
                        />
                        {errors.lastName && (
                          <p className="mt-1 text-xs text-red-600">
                            {errors.lastName.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Company email
                      </label>
                      <input
                        type="email"
                        {...register("email", {
                          required: "Email is required",
                        })}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100"
                        placeholder="you@company.com"
                      />
                      {errors.email && (
                        <p className="mt-1 text-xs text-red-600">
                          {errors.email.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">
                        Phone number{" "}
                        <span className="text-slate-400">(optional)</span>
                      </label>
                      <input
                        type="tel"
                        {...register("phone")}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100"
                        placeholder="+91 98765 43210"
                      />
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200/50">
                        <span>⚠️</span> {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="brand-gradient-btn w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50"
                    >
                      {loading ? (
                        <span className="inline-flex items-center gap-2">
                          <svg
                            className="h-4 w-4 animate-spin"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            />
                          </svg>
                          Submitting...
                        </span>
                      ) : (
                        "Submit Registration"
                      )}
                    </button>
                  </form>

                  <p className="mt-6 text-center text-sm text-slate-500">
                    Already have an account?{" "}
                    <Link
                      href="/login"
                      className="font-semibold text-violet-600 hover:text-violet-700"
                    >
                      Sign in
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
