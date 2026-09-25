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
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "📊", section: "Main" },
  { href: "/employees", label: "Employees", icon: "🧑‍💼", section: "Main" },
  { href: "/departments", label: "Departments", icon: "🏢", section: "Main" },
  { href: "/designations", label: "Designations", icon: "🏷️", section: "Main" },
  { href: "/attendance", label: "Attendance", icon: "🕒", section: "HR" },
  { href: "/leaves", label: "Leave", icon: "🗓️", section: "HR" },
  { href: "/holidays", label: "Holidays", icon: "🎉", section: "HR" },
  { href: "/documents", label: "Documents", icon: "📄", section: "HR" },
  { href: "/performance", label: "Performance", icon: "🎯", section: "HR" },
  { href: "/payroll", label: "Payroll", icon: "💰", section: "Finance" },
  { href: "/trainings", label: "Trainings", icon: "🎓", section: "Training" },
  { href: "/enrollments", label: "My Trainings", icon: "📚", section: "Training" },
  { href: "/certificates", label: "Certificates", icon: "📜", section: "Training" },
  {
    href: "/reports",
    label: "Reports",
    icon: "📈",
    section: "Admin",
    roles: ["super_admin", "hr_admin", "hr_executive", "finance_admin", "training_admin", "auditor"],
  },
  { href: "/audit-logs", label: "Audit Logs", icon: "🛡️", section: "Admin", roles: ["super_admin", "auditor"] },
  { href: "/notifications", label: "Notifications", icon: "🔔", section: "Admin" },
];

function groupBySection(items: NavItem[]): Record<string, NavItem[]> {
  const groups: Record<string, NavItem[]> = {};
  for (const item of items) {
    const section = item.section || "Other";
    if (!groups[section]) groups[section] = [];
    groups[section].push(item);
  }
  return groups;
}

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );
  const grouped = groupBySection(visibleItems);

  return (
    <aside className="hidden w-[272px] shrink-0 flex-col md:flex" style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)" }}>
      {/* Logo area */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
          <BrandLogo variant="mark" className="h-6 w-6 object-contain brightness-0 invert" />
        </div>
        <div>
          <p className="text-sm font-bold text-white tracking-wide">VolkssKatt</p>
          <p className="text-[10px] font-medium text-violet-300/80 tracking-widest uppercase">
            EMS Platform
          </p>
        </div>
      </div>

      {/* Decorative separator */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-slate-600/40 to-transparent" />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {Object.entries(grouped).map(([section, items]) => (
          <div key={section} className="mb-4">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
              {section}
            </p>
            <div className="space-y-0.5">
              {items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 ${
                      active
                        ? "bg-white/10 text-white shadow-sm"
                        : "text-slate-400 hover:bg-white/[0.05] hover:text-slate-200"
                    }`}
                  >
                    {/* Active indicator bar */}
                    {active && (
                      <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
                    )}
                    <span className="text-base transition-transform duration-200 group-hover:scale-110">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="mx-3 mb-4 rounded-xl bg-white/[0.06] p-4 backdrop-blur-sm">
        <p className="text-xs font-semibold text-slate-300">Need help?</p>
        <p className="mt-0.5 text-[11px] text-slate-500">
          Contact your HR administrator
        </p>
      </div>
    </aside>
  );
}
