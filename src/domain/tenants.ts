/**
 * Rules for adding and running farms on the platform (FarmForYou admin).
 * A farm's slug is its subdomain: merryfarms → merryfarms.farmforyou.in.
 */

/** Subdomains the platform keeps for itself. */
export const RESERVED_SLUGS = ["www", "admin", "app", "api", "mail", "static", "assets", "help", "support", "blog", "status", "farmforyou", "demo", "test"]

export type SlugProblem = "slug_format" | "slug_reserved"

/** 3–30 lowercase letters, digits and hyphens, starting with a letter, no hyphen at either end or twice in a row. */
export function checkSlug(slug: string): SlugProblem | null {
  if (!/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/.test(slug) || slug.includes("--")) return "slug_format"
  if (RESERVED_SLUGS.includes(slug)) return "slug_reserved"
  return null
}

/** A slug from the farm's English name: "Merry Farms" → "merryfarms", "Kaveri Dairy & Co." → "kaveridairyco". */
export function suggestSlug(nameEn: string): string {
  const s = nameEn
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "")
    .replace(/^[0-9]+/, "")
    .slice(0, 30)
  return s.length >= 3 ? s : ""
}

/** Bill numbers start with this: "Merry Farms" → "MF", "Kaveri" → "KAV". 2–5 capital letters. */
export function suggestInvoicePrefix(nameEn: string): string {
  const words = nameEn.toUpperCase().replace(/[^A-Z ]/g, " ").split(/\s+/).filter(Boolean)
  if (words.length >= 2) return words.slice(0, 4).map((w) => w[0]).join("")
  return (words[0] ?? "FARM").slice(0, 3).padEnd(2, "X")
}

export const isInvoicePrefix = (p: string) => /^[A-Z]{2,5}$/.test(p)

/** When a new farm's free trial ends. */
export function trialEnd(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000)
}

export type FarmStatus = "trial" | "active" | "suspended"

/** What the admin list shows: a trial that has run out is called out, so it can be converted or paused. */
export function statusLabel(status: FarmStatus, trialEndsAt: Date | null, now: Date): FarmStatus | "trial_over" {
  if (status === "trial" && trialEndsAt && trialEndsAt.getTime() < now.getTime()) return "trial_over"
  return status
}
