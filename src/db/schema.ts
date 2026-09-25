// ---------------------------------------------------------------------------
// EMS + ETS Database Schema (Drizzle ORM / PostgreSQL)
//
// This file is the single source of truth for the relational design of the
// Employee Management System (EMS) and the integrated Employee Training
// System (ETS). Tables are grouped by module to make the design easy to
// follow. Enums are used everywhere a column has a fixed, known set of
// values -- this keeps bad data out of the database at the lowest level.
// ---------------------------------------------------------------------------
import {
  pgTable,
  pgEnum,
  serial,
  text,
  varchar,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// ENUMS
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", [
  "super_admin",
  "hr_admin",
  "hr_executive",
  "department_manager",
  "team_lead",
  "employee",
  "finance_admin",
  "training_admin",
  "trainer",
  "auditor",
]);

export const genderEnum = pgEnum("gender", ["male", "female", "other"]);

export const employmentTypeEnum = pgEnum("employment_type", [
  "full_time",
  "part_time",
  "contract",
  "intern",
  "consultant",
]);

export const employmentStatusEnum = pgEnum("employment_status", [
  "active",
  "on_leave",
  "suspended",
  "terminated",
  "resigned",
]);

export const workLocationEnum = pgEnum("work_location", ["onsite", "remote", "hybrid"]);

export const shiftEnum = pgEnum("shift", ["morning", "evening", "night", "general"]);

export const statusEnum = pgEnum("active_status", ["active", "inactive"]);

export const designationLevelEnum = pgEnum("designation_level", [
  "entry",
  "junior",
  "mid",
  "senior",
  "lead",
  "manager",
  "director",
  "executive",
]);

export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "half_day",
  "late",
  "work_from_home",
  "on_leave",
  "holiday",
]);

export const leaveTypeCodeEnum = pgEnum("leave_type_code", [
  "casual",
  "sick",
  "earned",
  "comp_off",
  "maternity",
  "paternity",
  "loss_of_pay",
]);

export const leaveStatusEnum = pgEnum("leave_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const documentTypeEnum = pgEnum("document_type", [
  "resume",
  "id_proof",
  "educational_certificate",
  "experience_certificate",
  "joining_document",
  "other",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "pending",
  "verified",
  "rejected",
]);

export const cycleStatusEnum = pgEnum("cycle_status", ["upcoming", "active", "closed"]);

export const goalStatusEnum = pgEnum("goal_status", [
  "not_started",
  "in_progress",
  "completed",
  "cancelled",
]);

export const reviewTypeEnum = pgEnum("review_type", ["self", "manager"]);

export const reviewStatusEnum = pgEnum("review_status", ["draft", "submitted"]);

export const payrollStatusEnum = pgEnum("payroll_status", ["draft", "processed", "paid"]);

export const trainingTypeEnum = pgEnum("training_type", [
  "online",
  "offline",
  "hybrid",
  "workshop",
  "certification",
  "on_the_job",
  "internal",
  "external",
]);

export const trainingCategoryEnum = pgEnum("training_category", [
  "technical",
  "soft_skills",
  "leadership",
  "communication",
  "security",
  "compliance",
  "management",
  "programming",
  "database",
  "cloud",
  "devops",
  "ai_ml",
]);

export const skillLevelEnum = pgEnum("skill_level", ["beginner", "intermediate", "advanced"]);

export const trainingStatusEnum = pgEnum("training_status", [
  "draft",
  "scheduled",
  "ongoing",
  "completed",
  "cancelled",
]);

export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "enrolled",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
]);

export const assessmentTypeEnum = pgEnum("assessment_type", [
  "mcq",
  "true_false",
  "short_answer",
  "practical",
  "final",
]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "leave",
  "training",
  "assessment",
  "certificate",
  "attendance",
  "announcement",
  "payroll",
  "general",
]);

// ---------------------------------------------------------------------------
// 1. AUTHENTICATION / USERS
// ---------------------------------------------------------------------------
// `users` holds only authentication + access-control data. Profile data
// lives on `employees` (1:1). Splitting the two keeps security-sensitive
// auth fields (password hash, role) away from the rest of the HR data.
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("employee"),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 2. DEPARTMENTS
// ---------------------------------------------------------------------------
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull().unique(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  description: text("description"),
  // Stored as a plain integer (no FK) to avoid a circular dependency with
  // `employees` (an employee belongs to a department, a department has a
  // head employee). Validity is enforced in the API layer.
  headEmployeeId: integer("head_employee_id"),
  status: statusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 3. DESIGNATIONS
// ---------------------------------------------------------------------------
export const designations = pgTable("designations", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 150 }).notNull(),
  departmentId: integer("department_id")
    .notNull()
    .references(() => departments.id, { onDelete: "restrict" }),
  description: text("description"),
  level: designationLevelEnum("level").notNull().default("entry"),
  status: statusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 4. EMPLOYEES (core HR profile)
// ---------------------------------------------------------------------------
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  employeeCode: varchar("employee_code", { length: 30 }).notNull().unique(),

  // Personal
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  dateOfBirth: date("date_of_birth"),
  gender: genderEnum("gender"),
  phone: varchar("phone", { length: 20 }),
  personalEmail: varchar("personal_email", { length: 255 }),
  address: text("address"),
  profilePhotoUrl: text("profile_photo_url"),
  emergencyContactName: varchar("emergency_contact_name", { length: 150 }),
  emergencyContactPhone: varchar("emergency_contact_phone", { length: 20 }),
  emergencyContactRelation: varchar("emergency_contact_relation", { length: 50 }),

  // Employment
  dateOfJoining: date("date_of_joining").notNull(),
  departmentId: integer("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  designationId: integer("designation_id").references(() => designations.id, {
    onDelete: "set null",
  }),
  managerId: integer("manager_id").references((): AnyPgColumn => employees.id, {
    onDelete: "set null",
  }),
  employmentType: employmentTypeEnum("employment_type").notNull().default("full_time"),
  employmentStatus: employmentStatusEnum("employment_status").notNull().default("active"),
  workLocation: workLocationEnum("work_location").notNull().default("onsite"),
  shift: shiftEnum("shift").notNull().default("general"),

  // Professional
  qualification: text("qualification"),
  skills: jsonb("skills").$type<string[]>().default([]),
  certifications: jsonb("certifications").$type<string[]>().default([]),
  previousExperience: text("previous_experience"),

  // Financial (sensitive - restricted at the API layer)
  bankAccountNumber: varchar("bank_account_number", { length: 40 }),
  bankName: varchar("bank_name", { length: 150 }),
  bankIfsc: varchar("bank_ifsc", { length: 20 }),
  pan: varchar("pan", { length: 20 }),
  uan: varchar("uan", { length: 20 }),
  salary: numeric("salary", { precision: 12, scale: 2 }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 5. ATTENDANCE
// ---------------------------------------------------------------------------
export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    checkIn: timestamp("check_in", { withTimezone: true }),
    checkOut: timestamp("check_out", { withTimezone: true }),
    workingHours: numeric("working_hours", { precision: 5, scale: 2 }).default("0"),
    overtimeHours: numeric("overtime_hours", { precision: 5, scale: 2 }).default("0"),
    lateMinutes: integer("late_minutes").default(0),
    status: attendanceStatusEnum("status").notNull().default("present"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("attendance_employee_date_idx").on(table.employeeId, table.date)],
);

// ---------------------------------------------------------------------------
// 6. LEAVE MANAGEMENT
// ---------------------------------------------------------------------------
export const leaveTypes = pgTable("leave_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  code: leaveTypeCodeEnum("code").notNull().unique(),
  description: text("description"),
  defaultDaysPerYear: numeric("default_days_per_year", { precision: 5, scale: 1 }).default("0"),
  carryForward: boolean("carry_forward").notNull().default(false),
  requiresApproval: boolean("requires_approval").notNull().default(true),
  status: statusEnum("status").notNull().default("active"),
});

export const leaveBalances = pgTable(
  "leave_balances",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    leaveTypeId: integer("leave_type_id")
      .notNull()
      .references(() => leaveTypes.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    allocated: numeric("allocated", { precision: 5, scale: 1 }).notNull().default("0"),
    used: numeric("used", { precision: 5, scale: 1 }).notNull().default("0"),
  },
  (table) => [
    uniqueIndex("leave_balance_unique_idx").on(table.employeeId, table.leaveTypeId, table.year),
  ],
);

export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  leaveTypeId: integer("leave_type_id")
    .notNull()
    .references(() => leaveTypes.id, { onDelete: "restrict" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  days: numeric("days", { precision: 5, scale: 1 }).notNull(),
  reason: text("reason"),
  status: leaveStatusEnum("status").notNull().default("pending"),
  approverId: integer("approver_id").references(() => users.id, { onDelete: "set null" }),
  approverComment: text("approver_comment"),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// 7. HOLIDAYS
// ---------------------------------------------------------------------------
export const holidays = pgTable("holidays", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  date: date("date").notNull(),
  description: text("description"),
  isOptional: boolean("is_optional").notNull().default(false),
  status: statusEnum("status").notNull().default("active"),
});

// ---------------------------------------------------------------------------
// 8. EMPLOYEE DOCUMENTS
// ---------------------------------------------------------------------------
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  documentType: documentTypeEnum("document_type").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  status: documentStatusEnum("status").notNull().default("pending"),
  verifiedBy: integer("verified_by").references(() => users.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 9. PERFORMANCE MANAGEMENT
// ---------------------------------------------------------------------------
export const performanceCycles = pgTable("performance_cycles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: cycleStatusEnum("status").notNull().default("upcoming"),
  description: text("description"),
});

export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  cycleId: integer("cycle_id")
    .notNull()
    .references(() => performanceCycles.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  weight: numeric("weight", { precision: 5, scale: 2 }).default("0"),
  targetDate: date("target_date"),
  status: goalStatusEnum("status").notNull().default("not_started"),
  progress: integer("progress").notNull().default(0),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kpis = pgTable("kpis", {
  id: serial("id").primaryKey(),
  goalId: integer("goal_id")
    .notNull()
    .references(() => goals.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 150 }).notNull(),
  targetValue: numeric("target_value", { precision: 10, scale: 2 }),
  achievedValue: numeric("achieved_value", { precision: 10, scale: 2 }),
  unit: varchar("unit", { length: 30 }),
});

export const performanceReviews = pgTable("performance_reviews", {
  id: serial("id").primaryKey(),
  cycleId: integer("cycle_id")
    .notNull()
    .references(() => performanceCycles.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  reviewerId: integer("reviewer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  reviewType: reviewTypeEnum("review_type").notNull(),
  rating: numeric("rating", { precision: 3, scale: 2 }),
  strengths: text("strengths"),
  improvements: text("improvements"),
  feedback: text("feedback"),
  status: reviewStatusEnum("status").notNull().default("draft"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 10. PAYROLL
// ---------------------------------------------------------------------------
export const salaryStructures = pgTable("salary_structures", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id")
    .notNull()
    .unique()
    .references(() => employees.id, { onDelete: "cascade" }),
  basic: numeric("basic", { precision: 12, scale: 2 }).notNull().default("0"),
  hra: numeric("hra", { precision: 12, scale: 2 }).notNull().default("0"),
  conveyance: numeric("conveyance", { precision: 12, scale: 2 }).notNull().default("0"),
  medicalAllowance: numeric("medical_allowance", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  specialAllowance: numeric("special_allowance", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  otherAllowances: numeric("other_allowances", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  providentFund: numeric("provident_fund", { precision: 12, scale: 2 }).notNull().default("0"),
  professionalTax: numeric("professional_tax", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  incomeTax: numeric("income_tax", { precision: 12, scale: 2 }).notNull().default("0"),
  otherDeductions: numeric("other_deductions", { precision: 12, scale: 2 })
    .notNull()
    .default("0"),
  effectiveFrom: date("effective_from").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payrollRuns = pgTable(
  "payroll_runs",
  {
    id: serial("id").primaryKey(),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    status: payrollStatusEnum("status").notNull().default("draft"),
    processedBy: integer("processed_by").references(() => users.id, { onDelete: "set null" }),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("payroll_run_month_year_idx").on(table.month, table.year)],
);

export const payslips = pgTable("payslips", {
  id: serial("id").primaryKey(),
  payrollRunId: integer("payroll_run_id")
    .notNull()
    .references(() => payrollRuns.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  basic: numeric("basic", { precision: 12, scale: 2 }).notNull().default("0"),
  allowances: numeric("allowances", { precision: 12, scale: 2 }).notNull().default("0"),
  deductions: numeric("deductions", { precision: 12, scale: 2 }).notNull().default("0"),
  bonus: numeric("bonus", { precision: 12, scale: 2 }).notNull().default("0"),
  grossSalary: numeric("gross_salary", { precision: 12, scale: 2 }).notNull().default("0"),
  netSalary: numeric("net_salary", { precision: 12, scale: 2 }).notNull().default("0"),
  workingDays: integer("working_days").notNull().default(0),
  presentDays: numeric("present_days", { precision: 5, scale: 1 }).notNull().default("0"),
  lopDays: numeric("lop_days", { precision: 5, scale: 1 }).notNull().default("0"),
  status: payrollStatusEnum("status").notNull().default("processed"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 11. NOTIFICATIONS
// ---------------------------------------------------------------------------
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull().default("general"),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  relatedEntityType: varchar("related_entity_type", { length: 50 }),
  relatedEntityId: integer("related_entity_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 12. AUDIT LOGS
// ---------------------------------------------------------------------------
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 100 }).notNull(),
  resource: varchar("resource", { length: 100 }).notNull(),
  resourceId: varchar("resource_id", { length: 50 }),
  description: text("description"),
  ipAddress: varchar("ip_address", { length: 64 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// 13. ETS - TRAININGS
// ---------------------------------------------------------------------------
export const trainings = pgTable("trainings", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  category: trainingCategoryEnum("category").notNull(),
  trainerId: integer("trainer_id").references(() => employees.id, { onDelete: "set null" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  durationHours: numeric("duration_hours", { precision: 6, scale: 2 }).default("0"),
  trainingType: trainingTypeEnum("training_type").notNull().default("online"),
  skillLevel: skillLevelEnum("skill_level").notNull().default("beginner"),
  maxParticipants: integer("max_participants").notNull().default(30),
  status: trainingStatusEnum("status").notNull().default("draft"),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const trainingMaterials = pgTable("training_materials", {
  id: serial("id").primaryKey(),
  trainingId: integer("training_id")
    .notNull()
    .references(() => trainings.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileType: varchar("file_type", { length: 100 }),
  uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const enrollments = pgTable(
  "enrollments",
  {
    id: serial("id").primaryKey(),
    trainingId: integer("training_id")
      .notNull()
      .references(() => trainings.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    enrollmentDate: timestamp("enrollment_date", { withTimezone: true }).notNull().defaultNow(),
    status: enrollmentStatusEnum("status").notNull().default("enrolled"),
    progress: integer("progress").notNull().default(0),
    completionDate: timestamp("completion_date", { withTimezone: true }),
  },
  (table) => [uniqueIndex("enrollment_unique_idx").on(table.trainingId, table.employeeId)],
);

export const trainingAttendance = pgTable(
  "training_attendance",
  {
    id: serial("id").primaryKey(),
    trainingId: integer("training_id")
      .notNull()
      .references(() => trainings.id, { onDelete: "cascade" }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    present: boolean("present").notNull().default(true),
    markedBy: integer("marked_by").references(() => users.id, { onDelete: "set null" }),
  },
  (table) => [
    uniqueIndex("training_attendance_unique_idx").on(
      table.trainingId,
      table.employeeId,
      table.date,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 14. ETS - ASSESSMENTS
// ---------------------------------------------------------------------------
export const assessments = pgTable("assessments", {
  id: serial("id").primaryKey(),
  trainingId: integer("training_id")
    .notNull()
    .references(() => trainings.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  assessmentType: assessmentTypeEnum("assessment_type").notNull().default("mcq"),
  totalMarks: numeric("total_marks", { precision: 6, scale: 2 }).notNull().default("100"),
  passingMarks: numeric("passing_marks", { precision: 6, scale: 2 }).notNull().default("40"),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => assessments.id, { onDelete: "cascade" }),
  questionText: text("question_text").notNull(),
  questionType: assessmentTypeEnum("question_type").notNull().default("mcq"),
  options: jsonb("options").$type<string[]>().default([]),
  correctAnswer: text("correct_answer"),
  marks: numeric("marks", { precision: 5, scale: 2 }).notNull().default("1"),
});

export const assessmentAttempts = pgTable("assessment_attempts", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => assessments.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  answers: jsonb("answers").$type<Record<string, string>>().default({}),
  score: numeric("score", { precision: 6, scale: 2 }),
  percentage: numeric("percentage", { precision: 5, scale: 2 }),
  passed: boolean("passed"),
  attemptDate: timestamp("attempt_date", { withTimezone: true }).notNull().defaultNow(),
  trainerFeedback: text("trainer_feedback"),
  evaluatedBy: integer("evaluated_by").references(() => users.id, { onDelete: "set null" }),
});

// ---------------------------------------------------------------------------
// 15. ETS - CERTIFICATES
// ---------------------------------------------------------------------------
export const certificates = pgTable("certificates", {
  id: serial("id").primaryKey(),
  certificateNumber: varchar("certificate_number", { length: 60 }).notNull().unique(),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  trainingId: integer("training_id")
    .notNull()
    .references(() => trainings.id, { onDelete: "cascade" }),
  trainerId: integer("trainer_id").references(() => employees.id, { onDelete: "set null" }),
  completionDate: date("completion_date").notNull(),
  score: numeric("score", { precision: 6, scale: 2 }),
  issueDate: date("issue_date").notNull(),
  expiryDate: date("expiry_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
