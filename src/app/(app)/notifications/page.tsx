"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { PageHeader, Card, Badge, EmptyState } from "@/components/ui";

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [rows, setRows] = useState<Notification[]>([]);

  const load = () => api.get<Notification[]>("/api/notifications").then(setRows);
  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: number) => {
    await api.patch(`/api/notifications/${id}`, { isRead: true });
    load();
  };

  return (
    <div>
      <PageHeader title="Notifications" description="Leave decisions, training assignments, assessment results, and announcements." />
      {rows.length === 0 ? (
        <EmptyState message="You're all caught up!" />
      ) : (
        <div className="space-y-2">
          {rows.map((n) => (
            <Card key={n.id} className={n.isRead ? "opacity-60" : ""}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone="indigo">{n.type}</Badge>
                    {!n.isRead && <Badge tone="amber">New</Badge>}
                  </div>
                  <p className="font-semibold text-slate-900">{n.title}</p>
                  <p className="text-sm text-slate-600">{n.message}</p>
                  <p className="mt-1 text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
                {!n.isRead && (
                  <button onClick={() => markRead(n.id)} className="shrink-0 text-xs font-medium text-violet-600 hover:underline">
                    Mark read
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
