"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { PageHeader, Table, EmptyState } from "@/components/ui";

interface AuditLog {
  id: number;
  userEmail: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  description: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);

  useEffect(() => {
    api.get<{ items: AuditLog[] }>("/api/audit-logs").then((res) => setRows(res.items));
  }, []);

  return (
    <div>
      <PageHeader title="Audit Logs" description="System-wide trail of security-relevant actions (Super Admin / Auditor only)." />
      {rows.length === 0 ? (
        <EmptyState message="No audit events recorded yet." />
      ) : (
        <Table headers={["When", "User", "Action", "Resource", "Description", "IP"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 text-slate-500">{new Date(r.createdAt).toLocaleString()}</td>
              <td className="px-4 py-3 text-slate-600">{r.userEmail ?? "system"}</td>
              <td className="px-4 py-3 font-mono text-xs text-violet-700">{r.action}</td>
              <td className="px-4 py-3 text-slate-600">
                {r.resource}
                {r.resourceId ? `#${r.resourceId}` : ""}
              </td>
              <td className="px-4 py-3 text-slate-500">{r.description ?? "-"}</td>
              <td className="px-4 py-3 text-slate-400">{r.ipAddress ?? "-"}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
