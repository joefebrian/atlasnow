export const ROLES = [
  "SUPER_ADMIN",
  "AGENCY_ADMIN",
  "ANALYST",
  "CLIENT_ADMIN",
  "HQ_MARKETING",
  "HQ_OPS",
  "REGIONAL",
  "BRANCH",
  "VIEWER",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "P2P Super Admin",
  AGENCY_ADMIN: "Group Admin",
  ANALYST: "P2P Analyst",
  CLIENT_ADMIN: "Brand Admin",
  HQ_MARKETING: "HQ Marketing",
  HQ_OPS: "HQ Operations",
  REGIONAL: "Regional Manager",
  BRANCH: "Branch PIC",
  VIEWER: "Executive Viewer",
};

/** Can operate an agency workspace (not “see every brand on the platform”). */
export const AGENCY_ROLES: Role[] = ["SUPER_ADMIN", "AGENCY_ADMIN", "ANALYST"];

/** Roles assignable to users on a client workspace (multi-login per client) */
export const CLIENT_ROLES: Role[] = [
  "CLIENT_ADMIN",
  "HQ_MARKETING",
  "HQ_OPS",
  "REGIONAL",
  "BRANCH",
  "VIEWER",
];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function isAgencyStaff(role: string): boolean {
  return AGENCY_ROLES.includes(role as Role);
}

export function isPlatformAdmin(role: string): boolean {
  return role === "SUPER_ADMIN";
}

export function isClientRole(value: string): value is Role {
  return CLIENT_ROLES.includes(value as Role);
}
