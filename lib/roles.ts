import { UserRole } from "@prisma/client";

// Checks whether a role is in an allowed list. This is what makes role
// isolation backend-enforced rather than just hidden in the UI — every
// protected API route calls this before doing anything else. It has no
// dependency on the database or a live session, so it can be unit tested
// in isolation.
export function hasRole(role: UserRole | undefined, allowed: UserRole[]) {
  if (!role) return false;
  return allowed.includes(role);
}
