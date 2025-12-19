import type { Role } from "../core/types.js";

export const ROLES: ReadonlyArray<Role> = [
  "FOUNDER",
  "HR",
  "WAREHOUSE",
  "FINANCE",
  "LEGAL",
  "STAFF",
];

export const ROLE_LEVEL: Record<Role, number> = {
  FOUNDER: 100,
  LEGAL: 90,
  FINANCE: 80,
  HR: 70,
  WAREHOUSE: 60,
  STAFF: 10,
};

export function roleAtLeast(role: Role, required: Role) {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[required];
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as ReadonlyArray<string>).includes(value);
}
