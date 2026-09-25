"use client";

import { useAuth } from "./AuthProvider";
import { ROLE_LABELS } from "@/lib/types";

export function Topbar() {
  const { user, employee, logout } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <p className="text-sm text-slate-400">Welcome back,</p>
        <p className="font-semibold text-slate-900">
          {employee ? `${employee.firstName} ${employee.lastName}` : user?.email}
        </p>
      </div>
      <div className="flex items-center gap-4">
        <span className="rounded-full bg-gradient-to-r from-blue-50 to-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
          {user ? ROLE_LABELS[user.role] : ""}
        </span>
        <button
          onClick={logout}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
