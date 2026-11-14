import { headers } from "next/headers"
import { appBase, hostConfigFromEnv } from "@/domain/app-hosts"
import { getTenant } from "@/lib/tenant"

/** Absolute URL on the current host (the farm's own domain), for links sent on WhatsApp. */
export async function absoluteUrl(path: string) {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}${path}`
}

/**
 * A link for customers (a bill, "my orders"): on the farm's shop address, even when made in the farm app, whose
 * address is its own (src/domain/app-hosts.ts). With every app on one address, this same address.
 */
export async function shopUrl(path: string) {
  const tenant = await getTenant()
  const base = appBase("shop", tenant?.slug ?? null, hostConfigFromEnv(process.env))
  return base ? `${base}${path}` : absoluteUrl(path)
}
