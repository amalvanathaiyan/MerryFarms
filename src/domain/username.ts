/**
 * Usernames: a second way for a super admin or a farm admin (owner) to sign in, besides their email.
 * One per login, unique across the platform, never case-sensitive. Pure.
 */

export const USERNAME_MIN = 3
export const USERNAME_MAX = 30

/** "  Amal.V " → "amal.v". */
export const normaliseUsername = (raw: string) => raw.trim().toLowerCase()

/** What the sign-in box holds: an email has an @, anything else is a username. */
export const isEmailLogin = (value: string) => value.includes("@")

/**
 * Letters a–z, digits, dot, underscore and hyphen; starts with a letter; 3–30 long.
 * Returns an error code, or null when fine. Expects a normalised value.
 */
export function checkUsername(username: string): string | null {
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) return "username_invalid"
  if (!/^[a-z][a-z0-9._-]*$/.test(username)) return "username_invalid"
  if (/[._-]{2}/.test(username) || /[._-]$/.test(username)) return "username_invalid"
  return null
}
