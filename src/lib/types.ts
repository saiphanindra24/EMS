export type Role =
  | "super_admin"
  | "hr_admin"
  | "hr_executive"
  | "department_manager"
  | "team_lead"
  | "employee"
  | "finance_admin"
  | "training_admin"
  | "trainer"
  | "auditor";

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  hr_admin: "HR Admin",
  hr_executive: "HR Executive",
  department_manager: "Department Manager",
  team_lead: "Team Lead",
  employee: "Employee",
  finance_admin: "Finance/Payroll Admin",
  training_admin: "Training Admin",
  trainer: "Trainer",
  auditor: "Auditor",
};

export interface SessionUser {
  id: number;
  email: string;
  role: Role;
  isActive?: boolean;
}

export interface EmployeeSummary {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  profilePhotoUrl?: string | null;
  departmentId?: number | null;
  departmentName?: string | null;
  designationId?: number | null;
  designationTitle?: string | null;
  managerId?: number | null;
  employmentStatus?: string;
}
