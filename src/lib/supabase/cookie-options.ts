/**
 * With farms on subdomains the sign-in cookie is shared across them, so someone signing in on the main address
 * stays signed in on their farm's. It proves who they are, not access: requireStaff() still checks the farm.
 */
export function authCookieOptions() {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN
  return root ? { domain: `.${root}` } : undefined
}
