import { headers } from "next/headers"

/** Absolute URL on the current host (the farm's own domain), for links sent on WhatsApp. */
export async function absoluteUrl(path: string) {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}${path}`
}
