import "server-only"
import { tenantDb } from "@/lib/tenant-db"
import { TEMPLATE_KEYS, type TemplateKey, type TemplateOverrides } from "@/domain/templates"

/** The farm's own message wording, keyed by template. Missing ones use the defaults. */
export async function templateOverrides(tenantId: string): Promise<TemplateOverrides> {
  const rows = await tenantDb(tenantId).messageTemplate.findMany()
  const out: TemplateOverrides = {}
  for (const r of rows) {
    if (!TEMPLATE_KEYS.includes(r.key as TemplateKey)) continue
    out[r.key as TemplateKey] = { ta: r.bodyTa ?? undefined, en: r.bodyEn ?? undefined }
  }
  return out
}
