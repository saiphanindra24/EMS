// ---------------------------------------------------------------------------
// Role-based access control (RBAC)
//
// Every role in the system is declared here along with helper predicates
// used across API routes. Keeping this centralised means permission logic
// is defined once and reused everywhere instead of being duplicated (and
// potentially getting out of sync) in every route handler.
// ---------------------------------------------------------------------------

export const ROLES = [
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
] as const;

export type Role = (typeof ROLES)[number];

/** Roles that can manage the full employee lifecycle (create/update/deactivate). */
export const HR_ROLES: Role[] = ["super_admin", "hr_admin", "hr_executive"];

/** Roles that can see every employee's data regardless of department. */
export const GLOBAL_READ_ROLES: Role[] = [
  "super_admin",
  "hr_admin",
  "hr_executive",
  "auditor",
];

/** Roles allowed to manage org structure (departments/designations). */
export const ORG_ADMIN_ROLES: Role[] = ["super_admin", "hr_admin"];

/** Roles allowed to see/modify payroll & other financial data. */
export const FINANCE_ROLES: Role[] = ["super_admin", "finance_admin", "hr_admin"];

/** Roles that manage people (used for team-scoped access). */
export const PEOPLE_MANAGER_ROLES: Role[] = ["department_manager", "team_lead"];

/** Roles allowed to administer the training system. */
export const TRAINING_ADMIN_ROLES: Role[] = ["super_admin", "training_admin"];

/** Roles allowed to approve leave requests. */
export const LEAVE_APPROVER_ROLES: Role[] = [
  "super_admin",
  "hr_admin",
  "hr_executive",
  "department_manager",
  "team_lead",
];

export function hasRole(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}

export function isHr(role: Role): boolean {
  return hasRole(role, HR_ROLES);
}

export function isAdmin(role: Role): boolean {
  return role === "super_admin";
}

export function canViewAllEmployees(role: Role): boolean {
  return hasRole(role, GLOBAL_READ_ROLES);
}

export function canManageOrgStructure(role: Role): boolean {
  return hasRole(role, ORG_ADMIN_ROLES);
}

export function canViewFinancialData(role: Role): boolean {
  return hasRole(role, FINANCE_ROLES);
}

export function isPeopleManager(role: Role): boolean {
  return hasRole(role, PEOPLE_MANAGER_ROLES);
}

export function isTrainingAdmin(role: Role): boolean {
  return hasRole(role, TRAINING_ADMIN_ROLES);
}

export function isTrainer(role: Role): boolean {
  return role === "trainer";
}

export function canApproveLeave(role: Role): boolean {
  return hasRole(role, LEAVE_APPROVER_ROLES);
}
