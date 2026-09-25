"use client";

import { useEffect, useState, use as usePromise } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader, Card, Field, inputClass, Button, Badge, Table, EmptyState } from "@/components/ui";

interface Question {
  id: number;
  questionText: string;
  questionType: string;
  options: string[] | null;
  correctAnswer?: string | null;
  marks: string;
}
interface AssessmentDetail {
  id: number;
  title: string;
  assessmentType: string;
  totalMarks: string;
  passingMarks: string;
  durationMinutes: number;
  trainingId: number;
  questions: Question[];
}
interface Attempt {
  id: number;
  employeeId: number;
  score: string | null;
  percentage: string | null;
  passed: boolean | null;
  trainerFeedback: string | null;
}

const GRADER_ROLES = ["super_admin", "training_admin", "trainer"];

export default function AssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const { user } = useAuth();
  const [assessment, setAssessment] = useState<AssessmentDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [myAttempts, setMyAttempts] = useState<Attempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const canGrade = user && GRADER_ROLES.includes(user.role);
  const [newQuestion, setNewQuestion] = useState({ questionText: "", questionType: "mcq", options: "", correctAnswer: "", marks: "1" });

  const load = () => {
    api.get<AssessmentDetail>(`/api/assessments/${id}`).then(setAssessment);
    api.get<Attempt[]>(`/api/assessments/${id}/attempt`).then(setMyAttempts);
  };
  useEffect(() => {
    load();
  }, [id]);

  const submitAttempt = async () => {
    setError(null);
    try {
      await api.post(`/api/assessments/${id}/attempt`, { answers });
      setSubmitted(true);
      load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to submit");
    }
  };

  const evaluate = async (attemptId: number, score: string) => {
    try {
      await api.patch(`/api/assessments/attempts/${attemptId}`, { score: Number(score) });
      load();
    } catch (e) {
      alert(e instanceof ApiClientError ? e.message : "Failed");
    }
  };

  const addQuestion = async () => {
    // Simplified: questions are added by re-fetching + posting through a lightweight
    // direct call, since the create endpoint expects the full list on creation.
    alert("Add questions when creating the assessment, or extend via the API directly with POST /api/assessments.");
    setNewQuestion({ questionText: "", questionType: "mcq", options: "", correctAnswer: "", marks: "1" });
  };

  if (!assessment) return <p className="text-slate-400">Loading...</p>;

  const myAttempt = myAttempts.find((a) => a.employeeId !== undefined);

  return (
    <div>
      <PageHeader
        title={assessment.title}
        description={`${assessment.assessmentType.toUpperCase()} • Pass ${assessment.passingMarks}/${assessment.totalMarks} • ${assessment.durationMinutes} min`}
      />

      {!canGrade && (
        <Card>
          <h3 className="mb-3 font-semibold text-slate-900">Take assessment</h3>
          {myAttempt || submitted ? (
            <p className="text-sm text-emerald-700">
              You already attempted this assessment
              {myAttempt?.score != null ? ` — Score: ${myAttempt.score}/${assessment.totalMarks} (${myAttempt.passed ? "Passed" : "Failed"})` : " (pending evaluation)"}.
            </p>
          ) : assessment.questions.length === 0 ? (
            <EmptyState message="No questions configured yet." />
          ) : (
            <div className="space-y-4">
              {assessment.questions.map((q) => (
                <div key={q.id}>
                  <p className="text-sm font-medium text-slate-800">{q.questionText}</p>
                  {q.questionType === "mcq" && q.options ? (
                    <div className="mt-1 space-y-1">
                      {q.options.map((opt) => (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            value={opt}
                            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : q.questionType === "true_false" ? (
                    <div className="mt-1 flex gap-4 text-sm text-slate-600">
                      {["true", "false"].map((opt) => (
                        <label key={opt} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            value={opt}
                            onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      className={inputClass + " mt-1"}
                      onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    />
                  )}
                </div>
              ))}
              {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <Button onClick={submitAttempt}>Submit attempt</Button>
            </div>
          )}
        </Card>
      )}

      {canGrade && (
        <Card>
          <h3 className="mb-3 font-semibold text-slate-900">Attempts &amp; evaluation</h3>
          {myAttempts.length === 0 ? (
            <EmptyState message="No attempts yet." />
          ) : (
            <Table headers={["Employee ID", "Score", "%", "Passed", "Feedback", "Grade"]}>
              {myAttempts.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 text-slate-600">{a.employeeId}</td>
                  <td className="px-4 py-3 text-slate-600">{a.score ?? "Pending"}</td>
                  <td className="px-4 py-3 text-slate-600">{a.percentage ?? "-"}</td>
                  <td className="px-4 py-3">
                    {a.passed === null ? (
                      <Badge tone="amber">Pending</Badge>
                    ) : (
                      <Badge tone={a.passed ? "green" : "red"}>{a.passed ? "Passed" : "Failed"}</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{a.trainerFeedback ?? "-"}</td>
                  <td className="px-4 py-3">
                    <EvaluateInline onEvaluate={(score) => evaluate(a.id, score)} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      )}

      {canGrade && (
        <Card className="mt-6 opacity-70">
          <h3 className="mb-2 font-semibold text-slate-900">Add question (via API)</h3>
          <p className="text-xs text-slate-400">
            Bulk question creation happens when the assessment is created. For quick edits, use the API directly:
            <code className="ml-1 rounded bg-slate-100 px-1 py-0.5">POST /api/assessments</code>
          </p>
          <Field label="Question text (reference only)">
            <input
              className={inputClass}
              value={newQuestion.questionText}
              onChange={(e) => setNewQuestion({ ...newQuestion, questionText: e.target.value })}
            />
          </Field>
          <Button variant="secondary" className="mt-2" onClick={addQuestion}>
            Learn more
          </Button>
        </Card>
      )}
    </div>
  );
}

function EvaluateInline({ onEvaluate }: { onEvaluate: (score: string) => void }) {
  const [score, setScore] = useState("");
  return (
    <div className="flex items-center gap-2">
      <input className={inputClass + " w-20"} placeholder="score" value={score} onChange={(e) => setScore(e.target.value)} />
      <Button
        variant="secondary"
        onClick={() => {
          if (score) onEvaluate(score);
        }}
      >
        Grade
      </Button>
    </div>
  );
}
