"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { ROLE_LABELS } from "@/lib/types";
import { ChangePasswordModal } from "./ChangePasswordModal";

export function Topbar() {
  const { user, employee, logout } = useAuth();
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const initials = employee
    ? `${employee.firstName[0]}${employee.lastName[0]}`
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <>
      <header className="flex h-[72px] items-center justify-between border-b border-slate-200/80 glass px-6">
        <div className="animate-fade-in">
          <p className="text-xs font-medium text-slate-400">Welcome back,</p>
          <p className="text-base font-semibold text-slate-900">
            {employee ? `${employee.firstName} ${employee.lastName}` : user?.email}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Role badge */}
          <span className="hidden sm:inline-flex items-center rounded-full bg-gradient-to-r from-violet-50 to-indigo-50 px-3 py-1.5 text-xs font-semibold text-violet-700 ring-1 ring-inset ring-violet-200/50">
            {user ? ROLE_LABELS[user.role] : ""}
          </span>

          {/* Avatar */}
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white shadow-md">
            {initials}
          </div>

          {/* Change Password */}
          <button
            onClick={() => setChangePasswordOpen(true)}
            title="Change Password"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-all duration-200 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
              />
            </svg>
            <span className="hidden md:inline">Password</span>
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      <ChangePasswordModal
        isOpen={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </>
  );
}
