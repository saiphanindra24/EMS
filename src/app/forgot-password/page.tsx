"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { api, ApiClientError } from "@/lib/api-client";
import { BrandLogo } from "@/components/BrandLogo";

interface ForgotPasswordForm {
  email: string;
}

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const onSubmit = async (values: ForgotPasswordForm) => {
    setError(null);
    setLoading(true);

    try {
      const response = await api.post<{ message: string }>("/api/auth/forgot-password", {
        email: values.email,
      });
      setSuccess(response.message);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Unable to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen relative overflow-hidden">
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 30%, #312e81 60%, #1e1b4b 100%)" }} />
      <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full opacity-30" style={{ background: "radial-gradient(circle, #6366f1 0%, transparent 70%)", animation: "pulse-glow 6s ease infinite" }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

      <header className="relative z-10 flex items-center justify-between px-6 py-4 sm:px-10">
        <Link href="/login" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
            <BrandLogo variant="mark" className="h-6 w-6 object-contain brightness-0 invert" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">VolkssKatt</p>
            <p className="text-[10px] font-medium text-violet-300/70 tracking-widest uppercase">Infotech Pvt Ltd</p>
          </div>
        </Link>
        <Link href="/login" className="rounded-xl border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/10">Back to Login</Link>
      </header>

      <section className="relative z-10 flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-8">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-1.5 backdrop-blur-xl shadow-2xl">
            <div className="rounded-2xl bg-white p-8 sm:p-10">
              <div className="mb-7 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-3xl">
                  🔐
                </div>
                <h2 className="text-xl font-bold text-slate-900">Forgot password?</h2>
                <p className="mt-2 text-sm text-slate-500">Enter your email and we&apos;ll send a secure reset link.</p>
              </div>

              {success ? (
                <div className="text-center animate-scale-in">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-3xl">✅</div>
                  <p className="text-sm text-slate-600 leading-relaxed">{success}</p>
                  <Link href="/login" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-200">← Return to login</Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">Email address</label>
                    <input
                      type="email"
                      {...register("email", { required: "Email is required" })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100"
                      placeholder="name@company.com"
                    />
                    {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-inset ring-red-200/50">
                      <span>⚠️</span> {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading} className="brand-gradient-btn w-full rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50">
                    {loading ? "Sending reset link..." : "Send reset link"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
