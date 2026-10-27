/**
 * Demo sign-in for trying the app locally without Supabase (npm run demo).
 * Enabled ONLY when both are true:
 *   - NODE_ENV is not "production" (a production build can never use it), and
 *   - DEMO_LOGIN=1 is set.
 * The cookie holds a demo staff member's id; requireStaff() still checks that the
 * staff member belongs to the farm being viewed.
 */
export const DEMO_COOKIE = "mf_demo_staff"

export function isDemoLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEMO_LOGIN === "1"
}

/** Demo staff have auth ids that can never collide with Supabase's UUIDs. */
export const DEMO_AUTH_PREFIX = "demo-"
