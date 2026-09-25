"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { BrandLogo } from "./BrandLogo";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: Role[]; // undefined = visible to everyone
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/employees", label: "Employees", icon: "🧑‍💼" },
  { href: "/departments", label: "Departments", icon: "🏢" },
  { href: "/designations", label: "Designations", icon: "🏷️" },
  { href: "/attendance", label: "Attendance", icon: "🕒" },
  { href: "/leaves", label: "Leave", icon: "🗓️" },
  { href: "/holidays", label: "Holidays", icon: "🎉" },
  { href: "/documents", label: "Documents", icon: "📄" },
  { href: "/performance", label: "Performance", icon: "🎯" },
  {
    href: "/payroll",
    label: "Payroll",
    icon: "💰",
  },
  { href: "/trainings", label: "Trainings", icon: "🎓" },
  { href: "/enrollments", label: "My Trainings", icon: "📚" },
  { href: "/certificates", label: "Certificates", icon: "📜" },
  {
    href: "/reports",
    label: "Reports",
    icon: "📈",
    roles: ["super_admin", "hr_admin", "hr_executive", "finance_admin", "training_admin", "auditor"],
  },
  { href: "/audit-logs", label: "Audit Logs", icon: "🛡️", roles: ["super_admin", "auditor"] },
  { href: "/notifications", label: "Notifications", icon: "🔔" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="border-b border-slate-200 px-4 py-3">
        <BrandLogo className="h-11 w-full object-contain object-left" />
        <p className="mt-1 text-[11px] font-medium tracking-wide text-violet-600">
          Employee &amp; Training Suite
        </p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role))).map(
          (item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-gradient-to-r from-blue-50 to-violet-50 text-violet-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          },
        )}
      </nav>
    </aside>
  );
}
