"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { PageHeader, Table, Badge, Button, EmptyState } from "@/components/ui";
import { exportToCsv } from "@/lib/export";
import { CertificateModal, type CertificateData } from "@/components/CertificateModal";

interface Certificate extends CertificateData {}

export default function CertificatesPage() {
  const [rows, setRows] = useState<Certificate[]>([]);
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);

  useEffect(() => {
    api.get<Certificate[]>("/api/certificates").then(setRows);
  }, []);

  const handleExport = () => {
    exportToCsv("training-certificates", rows, [
      { header: "Certificate Number", accessor: "certificateNumber" },
      { header: "Training Program", accessor: "trainingTitle" },
      { header: "Score", accessor: (r) => r.score ?? "Passed" },
      { header: "Issue Date", accessor: "issueDate" },
      { header: "Expiry Date", accessor: (r) => r.expiryDate ?? "No expiry" },
    ]);
  };

  return (
    <div>
      <PageHeader
        title="Certificates"
        description="Certificates earned from completed trainings."
        actions={
          rows.length > 0 ? (
            <Button variant="secondary" onClick={handleExport}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export CSV
            </Button>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <EmptyState message="No certificates issued yet." />
      ) : (
        <Table headers={["Certificate #", "Training", "Score", "Issue Date", "Expiry", "Action"]}>
          {rows.map((c) => (
            <tr key={c.id}>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.certificateNumber}</td>
              <td className="px-4 py-3 font-medium text-slate-900">{c.trainingTitle}</td>
              <td className="px-4 py-3 text-slate-600">{c.score ? `${c.score}%` : "Passed"}</td>
              <td className="px-4 py-3 text-slate-600">{c.issueDate}</td>
              <td className="px-4 py-3">
                {c.expiryDate ? <Badge tone="amber">{c.expiryDate}</Badge> : <Badge tone="green">No expiry</Badge>}
              </td>
              <td className="px-4 py-3">
                <Button size="sm" variant="secondary" onClick={() => setSelectedCert(c)}>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24-3.414 2.45-6.329 5.86-6.329s6.1 2.915 5.86 6.329m-11.72 0h11.72m-11.72 0L5 18h14l-1.72-4.171M6 18v3h12v-3" />
                  </svg>
                  View / Print
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {/* Printable Certificate Modal */}
      <CertificateModal
        open={!!selectedCert}
        onClose={() => setSelectedCert(null)}
        certificate={selectedCert}
      />
    </div>
  );
}
