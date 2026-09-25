"use client";

import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/components/AuthProvider";
import { BrandLogo } from "@/components/BrandLogo";
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT, PASSWORD_TOO_SHORT } from "@/lib/password";

interface LoginForm {
  email: string;
  password: string;
}

const DEMO_ACCOUNTS = [
  ["superadmin@ems.local", "Super Admin", "👑"],
  ["hradmin@ems.local", "HR Admin", "🛡️"],
  ["hrexec@ems.local", "HR Executive", "📋"],
  ["manager@ems.local", "Dept Manager", "🏢"],
  ["teamlead@ems.local", "Team Lead", "👥"],
  ["employee@ems.local", "Employee", "🧑‍💼"],
  ["finance@ems.local", "Finance Admin", "💰"],
  ["trainingadmin@ems.local", "Training Admin", "🎓"],
  ["trainer@ems.local", "Trainer", "📚"],
  ["auditor@ems.local", "Auditor", "🔍"],
];

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({
    defaultValues: { email: "hradmin@ems.local", password: "Password@123" },
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();

  const onSubmit = async (values: LoginForm) => {
    setError(null);
    setLoading(true);
    try {
      await api.post("/api/auth/login", values);
      await refresh();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0" style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 30%, #312e81 60%, #1e1b4b 100%)",
      }} />

      {/* Floating gradient orbs */}
      <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(circle, #6366f1 0%, transparent 70%)",
          animation: "pulse-glow 6s ease infinite",
        }}
      />
      <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(circle, #a855f7 0%, transparent 70%)",
          animation: "pulse-glow 8s ease infinite 2s",
        }}
      />
      <div className="absolute top-[40%] right-[20%] h-[300px] w-[300px] rounded-full opacity-15"
        style={{
          background: "radial-gradient(circle, #ec4899 0%, transparent 70%)",
          animation: "pulse-glow 7s ease infinite 1s",
        }}
      />

      {/* Dot grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }} />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 sm:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
            <BrandLogo variant="mark" className="h-6 w-6 object-contain brightness-0 invert" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">VolkssKatt</p>
            <p className="text-[10px] font-medium text-violet-300/70 tracking-widest uppercase">Infotech Pvt Ltd</p>
          </div>
        </div>
        <nav className="hidden items-center gap-1 lg:flex">
          {["Home", "About Us", "Services", "Portfolio", "Careers", "Contact"].map(
            (item, i) => (
              <span
                key={item}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  i === 0
                    ? "bg-white/10 text-white backdrop-blur-sm"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {item}
              </span>
            ),
          )}
        </nav>
        <span className="rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-violet-500/30 hover:-translate-y-0.5 cursor-pointer">
          Get Quote
        </span>
      </header>

      {/* Main content */}
      <section className="relative z-10 px-4 py-8 sm:px-8">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-2">
          {/* Left: Hero text */}
          <div className="text-white animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 backdrop-blur-sm border border-white/10 mb-6">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-white/80 tracking-wide">
                Platform Active — v2.0
              </span>
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
              Transform Your{" "}
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-pink-300 bg-clip-text text-transparent">
                Workforce
              </span>{" "}
              Management
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70 sm:text-lg">
              Attendance, leave, payroll, performance reviews, and certifications
              — all unified in one powerful platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <span className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-indigo-600 shadow-xl shadow-white/10 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl cursor-pointer">
                Get Started
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/10 cursor-pointer">
                View Portfolio
              </span>
            </div>

            {/* Stats row */}
            <div className="mt-10 flex gap-8">
              {[
                ["500+", "Employees"],
                ["99.9%", "Uptime"],
                ["10+", "Modules"],
              ].map(([val, label]) => (
                <div key={label}>
                  <p className="text-2xl font-extrabold text-white">{val}</p>
                  <p className="text-xs font-medium text-white/50">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Login card */}
          <div className="animate-fade-in-up" style={{ animationDelay: "150ms" }}>
            <div className="rounded-3xl border border-white/10 bg-white/[0.07] p-1.5 backdrop-blur-xl shadow-2xl">
              <div className="rounded-2xl bg-white p-8 sm:p-10">
                <div className="mb-7 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25">
                    <BrandLogo variant="mark" className="h-7 w-7 object-contain brightness-0 invert" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
                    <p className="text-sm text-slate-500">Sign in to your account</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Email address
                    </label>
                    <input
                      type="email"
                      {...register("email", { required: true })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100"
                      placeholder="name@company.com"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Password
                    </label>
                    <input
                      type="password"
                      {...register("password", {
                        required: "Password is required",
                        minLength: { value: MIN_PASSWORD_LENGTH, message: PASSWORD_TOO_SHORT },
                      })}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 transition-all duration-200 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-violet-100"
                      placeholder="••••••••"
                    />
                    <p className="mt-1.5 text-xs text-slate-400">{PASSWORD_HINT}</p>
                    {errors.password && (
                      <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
                    )}
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
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Signing in...
                      </span>
                    ) : (
                      "Sign in"
                    )}
                  </button>
                </form>

                {/* Demo accounts */}
                <div className="mt-6">
                  <div className="relative mb-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-100" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white px-3 text-xs font-medium text-slate-400">
                        Demo accounts
                      </span>
                    </div>
                  </div>
                  <p className="mb-3 text-center text-xs text-slate-400">
                    Password: <code className="rounded-md bg-violet-50 px-1.5 py-0.5 font-semibold text-violet-600">Password@123</code>
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {DEMO_ACCOUNTS.map(([email, label, emoji]) => (
                      <button
                        key={email}
                        type="button"
                        onClick={() => {
                          setValue("email", email);
                          setValue("password", "Password@123");
                        }}
                        className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-left text-xs font-medium text-slate-600 transition-all duration-200 hover:bg-violet-50 hover:text-violet-700 hover:shadow-sm"
                      >
                        <span className="text-sm">{emoji}</span>
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
