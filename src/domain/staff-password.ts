/** Server only (uses Node crypto); kept apart from staff.ts, which the Staff screen also loads. */
import { randomInt } from "node:crypto"

/** A temporary password that is easy to read out on a call: "Farm-4827-kmtq". */
export function tempPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyz"
  const word = Array.from({ length: 4 }, () => letters[randomInt(letters.length)]).join("")
  return `Farm-${String(randomInt(1000, 10000))}-${word}`
}
