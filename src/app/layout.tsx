import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "VolkssKatt | Employee Management & Training System",
  description:
    "VolkssKatt Infotech Private Limited — Employee Management System with an integrated Training System.",
  icons: { icon: "/images/volksskatt-mark.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#f0f2f5] text-slate-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
