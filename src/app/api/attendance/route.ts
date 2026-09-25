import { z } from "zod";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendanceRecords, employees } from "@/db/schema";
import {
  apiSuccess,
  requireAuth,
  withErrorHandling,
  HttpError,
  audit,
  getEmployeeForSession,
} from "@/lib/api";
import { parseBody } from "@/lib/validate";
import { HR_ROLES, canViewAllEmployees, isPeopleManager } from "@/lib/rbac";

const createSchema = z.object({
  employeeId: z.number().int(),
  date: z.string().min(1),
  status: z
    .enum(["present", "absent", "half_day", "late", "work_from_home", "on_leave", "holiday"])
    .default("present"),
  checkIn: z.string().optional().nullable(),
  checkOut: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

// GET /api/attendance - scoped attendance history.
// Employees see only their own records; managers see their team's; HR/Admin see all.
export async function GET(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    const url = new URL(req.url);
    const employeeIdParam = url.searchParams.get("employeeId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const self = await getEmployeeForSession(session);
    const filters = [];

    if (canViewAllEmployees(session.role)) {
      if (employeeIdParam) filters.push(eq(attendanceRecords.employeeId, Number(employeeIdParam)));
    } else if (isPeopleManager(session.role) && self) {
      const requested = employeeIdParam ? Number(employeeIdParam) : null;
      if (requested && requested !== self.id) {
        const [target] = await db.select().from(employees).where(eq(employees.id, requested));
        if (!target || (target.managerId !== self.id && target.departmentId !== self.departmentId)) {
          throw new HttpError("You cannot view this employee's attendance", 403);
        }
        filters.push(eq(attendanceRecords.employeeId, requested));
      } else {
        filters.push(eq(attendanceRecords.employeeId, self.id));
      }
    } else if (self) {
      filters.push(eq(attendanceRecords.employeeId, self.id));
    } else {
      return apiSuccess([]);
    }

    if (from) filters.push(gte(attendanceRecords.date, from));
    if (to) filters.push(lte(attendanceRecords.date, to));

    const rows = await db
      .select()
      .from(attendanceRecords)
      .where(and(...filters))
      .orderBy(attendanceRecords.date);

    return apiSuccess(rows);
  });
}

// POST /api/attendance - HR/Admin manually records/corrects an attendance entry.
export async function POST(req: Request) {
  return withErrorHandling(async () => {
    const session = await requireAuth();
    if (!HR_ROLES.includes(session.role)) {
      throw new HttpError("Only HR/Admin can manually record attendance", 403);
    }
    const body = await parseBody(req, createSchema);

    const [row] = await db
      .insert(attendanceRecords)
      .values({
        employeeId: body.employeeId,
        date: body.date,
        status: body.status,
        checkIn: body.checkIn ? new Date(body.checkIn) : null,
        checkOut: body.checkOut ? new Date(body.checkOut) : null,
        notes: body.notes ?? null,
      })
      .onConflictDoUpdate({
        target: [attendanceRecords.employeeId, attendanceRecords.date],
        set: {
          status: body.status,
          checkIn: body.checkIn ? new Date(body.checkIn) : null,
          checkOut: body.checkOut ? new Date(body.checkOut) : null,
          notes: body.notes ?? null,
        },
      })
      .returning();

    await audit({
      userId: session.userId,
      action: "ATTENDANCE_UPSERT",
      resource: "attendance",
      resourceId: row.id,
      description: `Recorded attendance for employee ${body.employeeId} on ${body.date}`,
    });

    return apiSuccess(row, 201);
  });
}
