"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f0f2f5]">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          {/* Animated spinner */}
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-[3px] border-slate-200" />
            <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-violet-500 animate-spin" />
          </div>
          <p className="text-sm font-medium text-slate-400">Loading VolkssKatt...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-[#f0f2f5]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Animated gradient accent bar */}
        <div
          className="h-[3px] w-full"
          style={{
            background: "linear-gradient(90deg, #6366f1 0%, #8b5cf6 25%, #a855f7 50%, #ec4899 75%, #6366f1 100%)",
            backgroundSize: "200% 100%",
            animation: "gradient-shift 4s ease infinite",
          }}
        />
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
