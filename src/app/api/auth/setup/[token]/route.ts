import { z } from "zod";
import { db } from "@/db";
import { users, employees } from "@/db/schema";
import { eq } from "drizzle-orm";
import { apiSuccess, withErrorHandling, HttpError } from "@/lib/api";
import { hashPassword, signToken, setAuthCookie } from "@/lib/auth";
import { parseBody } from "@/lib/validate";
import { MIN_PASSWORD_LENGTH } from "@/lib/password";

const setupSchema = z.object({
  password: z.string().min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  phone: z.string().optional(),
  personalEmail: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelation: z.string().optional(),
});

// GET /api/auth/setup/[token] - validate a setup token and return user info.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return withErrorHandling(async () => {
    const { token } = await params;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.setupToken, token));

    if (!user) {
      throw new HttpError("Invalid or expired setup link", 404);
    }
    if (!user.mustChangePassword) {
      throw new HttpError("This account has already been set up", 400);
    }

    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.userId, user.id));

    return apiSuccess({
      email: user.email,
      firstName: employee?.firstName ?? "",
      lastName: employee?.lastName ?? "",
      employeeCode: employee?.employeeCode ?? "",
    });
  });
}

// POST /api/auth/setup/[token] - set password and additional details.
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return withErrorHandling(async () => {
    const { token } = await params;
    const body = await parseBody(req, setupSchema);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.setupToken, token));

    if (!user) {
      throw new HttpError("Invalid or expired setup link", 404);
    }
    if (!user.mustChangePassword) {
      throw new HttpError("This account has already been set up", 400);
    }

    // Hash password and update user
    const passwordHash = await hashPassword(body.password);
    await db
      .update(users)
      .set({
        passwordHash,
        mustChangePassword: false,
        setupToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Update employee profile with additional details
    const [employee] = await db
      .select()
      .from(employees)
      .where(eq(employees.userId, user.id));

    if (employee) {
      await db
        .update(employees)
        .set({
          dateOfBirth: body.dateOfBirth || null,
          gender: body.gender as typeof employees.gender.enumValues[number] | undefined ?? null,
          phone: body.phone || null,
          personalEmail: body.personalEmail || null,
          address: body.address || null,
          emergencyContactName: body.emergencyContactName || null,
          emergencyContactPhone: body.emergencyContactPhone || null,
          emergencyContactRelation: body.emergencyContactRelation || null,
          updatedAt: new Date(),
        })
        .where(eq(employees.id, employee.id));
    }

    // Auto-login: sign a token and set cookie
    const jwtToken = await signToken({
      userId: user.id,
      employeeId: employee?.id ?? null,
      email: user.email,
      role: user.role,
    });
    await setAuthCookie(jwtToken);

    return apiSuccess({ message: "Account setup complete! Welcome aboard." });
  });
}
