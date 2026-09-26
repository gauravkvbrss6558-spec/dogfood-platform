import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export { hasRole } from "./roles";

// Every protected API route calls this first. It returns the logged-in
// user's session, or null if nobody is logged in — routes decide what
// to do with that (usually: return a 401).
export async function getSession() {
  return getServerSession(authOptions);
}
