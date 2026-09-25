"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { PageHeader, Table, Badge, EmptyState } from "@/components/ui";

interface Enrollment {
  id: number;
  trainingId: number;
  trainingTitle: string;
  status: string;
  progress: number;
  enrollmentDate: string;
  completionDate: string | null;
}

const TONE: Record<string, "green" | "red" | "amber" | "indigo" | "slate"> = {
  enrolled: "indigo",
  in_progress: "amber",
  completed: "green",
  failed: "red",
  cancelled: "slate",
};

export default function EnrollmentsPage() {
  const [rows, setRows] = useState<Enrollment[]>([]);

  useEffect(() => {
    api.get<Enrollment[]>("/api/enrollments").then(setRows);
  }, []);

  return (
    <div>
      <PageHeader title="My Trainings" description="Trainings you're enrolled in or have been assigned." />
      {rows.length === 0 ? (
        <EmptyState message="You are not enrolled in any training yet. Browse the catalog to get started." />
      ) : (
        <Table headers={["Training", "Status", "Progress", "Enrolled On", "Completed On"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="px-4 py-3 font-medium text-slate-900">
                <Link href={`/trainings/${r.trainingId}`} className="hover:underline">
                  {r.trainingTitle}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Badge tone={TONE[r.status] ?? "slate"}>{r.status}</Badge>
              </td>
              <td className="px-4 py-3 text-slate-600">{r.progress}%</td>
              <td className="px-4 py-3 text-slate-500">{new Date(r.enrollmentDate).toLocaleDateString()}</td>
              <td className="px-4 py-3 text-slate-500">{r.completionDate ? new Date(r.completionDate).toLocaleDateString() : "-"}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
