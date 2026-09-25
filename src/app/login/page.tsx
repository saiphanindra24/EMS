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
  ["superadmin@ems.local", "Super Admin"],
  ["hradmin@ems.local", "HR Admin"],
  ["hrexec@ems.local", "HR Executive"],
  ["manager@ems.local", "Department Manager"],
  ["teamlead@ems.local", "Team Lead"],
  ["employee@ems.local", "Employee"],
  ["finance@ems.local", "Finance Admin"],
  ["trainingadmin@ems.local", "Training Admin"],
  ["trainer@ems.local", "Trainer"],
  ["auditor@ems.local", "Auditor"],
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
    <main className="min-h-screen bg-white">
      <header className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-4 py-3 shadow-sm sm:px-8">
        <BrandLogo className="h-12 w-auto max-w-[240px] object-contain object-left" />
        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
          <span className="rounded-full bg-blue-50 px-4 py-2 font-semibold text-blue-600">Home</span>
          <span>About Us</span>
          <span>Services</span>
          <span>Portfolio</span>
          <span>Careers</span>
          <span>Contact</span>
        </nav>
        <span className="brand-gradient-btn rounded-full px-5 py-2 text-sm font-semibold text-white shadow-md">
          Get Quote
        </span>
      </header>

      <section className="brand-gradient relative min-h-[calc(100vh-80px)] overflow-hidden px-4 py-10 sm:px-8">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-2">
          <div className="text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/80">VolkssKatt Infotech</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-5xl">
              Transform Your Ideas Into Digital Reality
            </h1>
            <p className="mt-4 max-w-xl text-lg text-white/90">
              Employee Management &amp; Training System powered by AI technology — attendance,
              leave, payroll, performance, and certifications in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-blue-600 shadow">
                Get Started →
              </span>
              <span className="rounded-full border-2 border-white/80 px-6 py-3 text-sm font-semibold text-white">
                View Portfolio
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-8 shadow-2xl sm:p-10">
            <div className="mb-6 flex items-center gap-3">
              <BrandLogo variant="mark" className="h-12 w-12 object-contain" />
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
                <p className="text-sm text-slate-500">VolkssKatt employee portal</p>
              </div>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  {...register("email", { required: true })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  {...register("password", {
                    required: "Password is required",
                    minLength: { value: MIN_PASSWORD_LENGTH, message: PASSWORD_TOO_SHORT },
                  })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
                <p className="mt-1 text-xs text-slate-400">{PASSWORD_HINT}</p>
                {errors.password && (
                  <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
                )}
              </div>
              {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="brand-gradient-btn w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md transition disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <div className="mt-6 rounded-xl bg-gradient-to-br from-blue-50 to-violet-50 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
                Demo accounts
              </p>
              <p className="mb-2 text-xs text-slate-500">
                HR Admin &amp; HR Executive passwords follow the {PASSWORD_HINT.toLowerCase()} policy.
                Demo password:{" "}
                <code className="rounded bg-white px-1 py-0.5 font-semibold text-violet-700">Password@123</code>
              </p>
              <div className="grid grid-cols-2 gap-1">
                {DEMO_ACCOUNTS.map(([email, label]) => (
                  <button
                    key={email}
                    type="button"
                    onClick={() => {
                      setValue("email", email);
                      setValue("password", "Password@123");
                    }}
                    className="rounded-md bg-white px-2 py-1.5 text-left text-xs font-medium text-slate-600 shadow-sm hover:bg-violet-50 hover:text-violet-700"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
