"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { PageHeader, Table, Badge, EmptyState } from "@/components/ui";

interface Certificate {
  id: number;
  certificateNumber: string;
  trainingTitle: string;
  completionDate: string;
  score: string | null;
  issueDate: string;
  expiryDate: string | null;
}

export default function CertificatesPage() {
  const [rows, setRows] = useState<Certificate[]>([]);

  useEffect(() => {
    api.get<Certificate[]>("/api/certificates").then(setRows);
  }, []);

  return (
    <div>
      <PageHeader title="Certificates" description="Certificates earned from completed trainings." />
      {rows.length === 0 ? (
        <EmptyState message="No certificates issued yet." />
      ) : (
        <Table headers={["Certificate #", "Training", "Score", "Issue Date", "Expiry"]}>
          {rows.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.certificateNumber}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{c.trainingTitle}</td>
              <td className="px-4 py-3 text-slate-600">{c.score ?? "-"}</td>
              <td className="px-4 py-3 text-slate-600">{c.issueDate}</td>
              <td className="px-4 py-3">
                {c.expiryDate ? <Badge tone="amber">{c.expiryDate}</Badge> : <Badge tone="green">No expiry</Badge>}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
