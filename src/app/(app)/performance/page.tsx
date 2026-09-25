"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader, Table, Badge, Button, Modal, Field, inputClass, EmptyState, Card } from "@/components/ui";

interface Cycle {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}
interface Goal {
  id: number;
  title: string;
  description: string | null;
  status: string;
  progress: number;
  employeeId: number;
}
interface Review {
  id: number;
  reviewType: string;
  rating: string | null;
  feedback: string | null;
  status: string;
  employeeId: number;
}

const MANAGE_ROLES = ["super_admin", "hr_admin"];

export default function PerformancePage() {
  const { user, employee } = useAuth();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [cycleOpen, setCycleOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManageCycles = user && MANAGE_ROLES.includes(user.role);

  const cycleForm = useForm<{ name: string; startDate: string; endDate: string }>();
  const goalForm = useForm<{ cycleId: string; employeeId: string; title: string; description: string }>();
  const reviewForm = useForm<{ cycleId: string; employeeId: string; reviewType: string; rating: string; feedback: string }>();

  const load = () => {
    api.get<Cycle[]>("/api/performance/cycles").then(setCycles);
    api.get<Goal[]>("/api/performance/goals").then(setGoals);
    api.get<Review[]>("/api/performance/reviews").then(setReviews);
  };
  useEffect(load, []);

  const createCycle = async (v: { name: string; startDate: string; endDate: string }) => {
    setError(null);
    try {
      await api.post("/api/performance/cycles", v);
      setCycleOpen(false);
      cycleForm.reset();
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed");
    }
  };

  const createGoal = async (v: { cycleId: string; employeeId: string; title: string; description: string }) => {
    setError(null);
    try {
      await api.post("/api/performance/goals", { ...v, cycleId: Number(v.cycleId), employeeId: Number(v.employeeId) });
      setGoalOpen(false);
      goalForm.reset();
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed");
    }
  };

  const createReview = async (v: { cycleId: string; employeeId: string; reviewType: string; rating: string; feedback: string }) => {
    setError(null);
    try {
      await api.post("/api/performance/reviews", {
        cycleId: Number(v.cycleId),
        employeeId: Number(v.employeeId),
        reviewType: v.reviewType,
        rating: v.rating ? Number(v.rating) : null,
        feedback: v.feedback,
        status: "submitted",
      });
      setReviewOpen(false);
      reviewForm.reset();
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed");
    }
  };

  const updateGoalProgress = async (id: number, progress: number) => {
    await api.patch("/api/performance/goals", { id, progress, status: progress >= 100 ? "completed" : "in_progress" });
    load();
  };

  return (
    <div>
      <PageHeader
        title="Performance Management"
        description="Cycles, goals, self/manager reviews, and ratings."
        actions={
          <div className="flex gap-2">
            {canManageCycles && <Button variant="secondary" onClick={() => setCycleOpen(true)}>+ Cycle</Button>}
            <Button variant="secondary" onClick={() => setGoalOpen(true)}>+ Goal</Button>
            <Button onClick={() => setReviewOpen(true)}>+ Review</Button>
          </div>
        }
      />

      <Card className="mb-6">
        <h3 className="mb-2 font-semibold text-slate-900">Cycles</h3>
        {cycles.length === 0 ? (
          <EmptyState message="No performance cycles yet." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {cycles.map((c) => (
              <Badge key={c.id} tone={c.status === "active" ? "green" : c.status === "closed" ? "slate" : "amber"}>
                {c.name} ({c.startDate} → {c.endDate}) — {c.status}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold text-slate-900">Goals</h3>
          {goals.length === 0 ? (
            <EmptyState message="No goals assigned." />
          ) : (
            <Table headers={["Title", "Status", "Progress", ""]}>
              {goals.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-3 text-slate-700">{g.title}</td>
                  <td className="px-4 py-3">
                    <Badge tone={g.status === "completed" ? "green" : g.status === "cancelled" ? "red" : "amber"}>{g.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{g.progress}%</td>
                  <td className="px-4 py-3">
                    {(employee?.id === g.employeeId || canManageCycles) && (
                      <input
                        type="range"
                        min={0}
                        max={100}
                        defaultValue={g.progress}
                        onMouseUp={(e) => updateGoalProgress(g.id, Number((e.target as HTMLInputElement).value))}
                        className="w-24"
                      />
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </div>

        <div>
          <h3 className="mb-2 font-semibold text-slate-900">Reviews</h3>
          {reviews.length === 0 ? (
            <EmptyState message="No reviews yet." />
          ) : (
            <Table headers={["Type", "Rating", "Status", "Feedback"]}>
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-slate-700 capitalize">{r.reviewType}</td>
                  <td className="px-4 py-3 text-slate-600">{r.rating ?? "-"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={r.status === "submitted" ? "green" : "amber"}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{r.feedback ?? "-"}</td>
                </tr>
              ))}
            </Table>
          )}
        </div>
      </div>

      <Modal open={cycleOpen} onClose={() => setCycleOpen(false)} title="New performance cycle">
        <form onSubmit={cycleForm.handleSubmit(createCycle)} className="space-y-3">
          <Field label="Name">
            <input className={inputClass} {...cycleForm.register("name", { required: true })} />
          </Field>
          <Field label="Start date">
            <input type="date" className={inputClass} {...cycleForm.register("startDate", { required: true })} />
          </Field>
          <Field label="End date">
            <input type="date" className={inputClass} {...cycleForm.register("endDate", { required: true })} />
          </Field>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full">Create</Button>
        </form>
      </Modal>

      <Modal open={goalOpen} onClose={() => setGoalOpen(false)} title="Assign a goal">
        <form onSubmit={goalForm.handleSubmit(createGoal)} className="space-y-3">
          <Field label="Cycle ID">
            <input className={inputClass} {...goalForm.register("cycleId", { required: true })} />
          </Field>
          <Field label="Employee ID">
            <input className={inputClass} {...goalForm.register("employeeId", { required: true })} defaultValue={String(employee?.id ?? "")} />
          </Field>
          <Field label="Title">
            <input className={inputClass} {...goalForm.register("title", { required: true })} />
          </Field>
          <Field label="Description">
            <textarea className={inputClass} {...goalForm.register("description")} />
          </Field>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full">Assign</Button>
        </form>
      </Modal>

      <Modal open={reviewOpen} onClose={() => setReviewOpen(false)} title="Submit review">
        <form onSubmit={reviewForm.handleSubmit(createReview)} className="space-y-3">
          <Field label="Cycle ID">
            <input className={inputClass} {...reviewForm.register("cycleId", { required: true })} />
          </Field>
          <Field label="Employee ID">
            <input className={inputClass} {...reviewForm.register("employeeId", { required: true })} defaultValue={String(employee?.id ?? "")} />
          </Field>
          <Field label="Review type">
            <select className={inputClass} {...reviewForm.register("reviewType")}>
              <option value="self">Self review</option>
              <option value="manager">Manager review</option>
            </select>
          </Field>
          <Field label="Rating (0-5)">
            <input type="number" step="0.1" min={0} max={5} className={inputClass} {...reviewForm.register("rating")} />
          </Field>
          <Field label="Feedback">
            <textarea className={inputClass} {...reviewForm.register("feedback")} />
          </Field>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" className="w-full">Submit</Button>
        </form>
      </Modal>
    </div>
  );
}
