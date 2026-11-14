import "server-only"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { cleanConfig, COUNTS_AGAINST, isRestrictedAction, screen, splitWords, STARTER_ITEMS, type CaseDecision, type ComplianceConfig } from "@/domain/compliance"
import { OrderError } from "./orders"
import { emitEvent } from "./events"
import { audit, type Actor } from "./audit"

/**
 * Items against the law (docs/platform-plan.md §3.9): the restricted items list, screening a farm's products and
 * categories whenever they are added or changed, and the Compliance inbox where Farm For You decides. Rules are in
 * src/domain/compliance.ts. Screening does nothing while switched off (until the list is checked by a legal expert).
 *
 * A matched product is hidden (isActive false) and held (complianceHold), so the farm can't show it again; the
 * shop and order forms already show only active products. A category is only reported, never hidden.
 */

const CONFIG_KEY = "compliance.config"

export async function complianceConfig(): Promise<ComplianceConfig> {
  const row = await prisma.settingValue.findUnique({ where: { scopeKey_key: { scopeKey: "platform", key: CONFIG_KEY } } })
  return cleanConfig(row?.value)
}

export async function saveComplianceConfig(raw: unknown, actor: Actor) {
  const before = await complianceConfig()
  const next = cleanConfig(raw)
  const value = next as unknown as Prisma.InputJsonValue
  await prisma.settingValue.upsert({
    where: { scopeKey_key: { scopeKey: "platform", key: CONFIG_KEY } },
    create: { scopeKey: "platform", tenantId: null, key: CONFIG_KEY, value },
    update: { value },
  })
  await audit(actor, [{ tenantId: null, action: before.on !== next.on ? "compliance.switched" : "compliance.config", subject: CONFIG_KEY, before, after: next }])
}

// ── The list ─────────────────────────────────────────────────────────────────

export const listItems = () => prisma.restrictedItem.findMany({ orderBy: [{ active: "desc" }, { labelEn: "asc" }] })

export interface ItemInput {
  labelTa: string
  labelEn: string
  wordsTa: string
  wordsEn: string
  action: string
  reasonTa: string
  reasonEn: string
  active: boolean
}

export async function saveItem(id: string | null, input: ItemInput, actor: Actor) {
  if (!isRestrictedAction(input.action)) throw new OrderError("invalid_form")
  const data = {
    labelTa: input.labelTa.trim(),
    labelEn: input.labelEn.trim(),
    wordsTa: splitWords(input.wordsTa),
    wordsEn: splitWords(input.wordsEn).map((w) => w.toLowerCase()),
    action: input.action,
    reasonTa: input.reasonTa.trim(),
    reasonEn: input.reasonEn.trim(),
    active: input.active,
  }
  if (data.wordsTa.length + data.wordsEn.length === 0) throw new OrderError("words_needed")
  const before = id ? await prisma.restrictedItem.findUnique({ where: { id } }) : null
  if (id && !before) throw new OrderError("not_found")
  const item = id ? await prisma.restrictedItem.update({ where: { id }, data }) : await prisma.restrictedItem.create({ data })
  await audit(actor, [{ tenantId: null, action: id ? "compliance.item_changed" : "compliance.item_added", subject: item.id, before, after: data }])
  return item
}

export async function removeItem(id: string, actor: Actor) {
  const before = await prisma.restrictedItem.findUnique({ where: { id } })
  if (!before) throw new OrderError("not_found")
  await prisma.restrictedItem.delete({ where: { id } })
  await audit(actor, [{ tenantId: null, action: "compliance.item_removed", subject: id, before }])
}

/** Adds the starter examples (src/domain/compliance.ts) that aren't on the list yet. */
export async function addStarterItems(actor: Actor) {
  const have = new Set((await prisma.restrictedItem.findMany({ select: { labelEn: true } })).map((i) => i.labelEn))
  const fresh = STARTER_ITEMS.filter((s) => !have.has(s.labelEn))
  if (fresh.length) await prisma.restrictedItem.createMany({ data: fresh })
  await audit(actor, [{ tenantId: null, action: "compliance.starter_list", subject: "restricted_items", after: { added: fresh.length } }])
  return fresh.length
}

// ── Screening ────────────────────────────────────────────────────────────────

async function screenContext(tenantId: string) {
  const config = await complianceConfig()
  if (!config.on) return null
  const [entries, farm] = await Promise.all([
    prisma.restrictedItem.findMany({ where: { active: true }, select: { id: true, wordsTa: true, wordsEn: true, action: true } }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { fssaiNo: true } }),
  ])
  return { entries, hasLicence: !!farm?.fssaiNo?.trim() }
}

/**
 * Screens one product after the farm adds or changes it. A new match hides and holds it and opens a case (unless
 * Farm For You already allowed that word for it). No match any more: an open case is cleared and the hold lifted.
 * Returns the hold now on the product, or null.
 */
export async function screenProduct(tenantId: string, productId: string): Promise<string | null> {
  const ctx = await screenContext(tenantId)
  const p = await prisma.product.findFirst({ where: { id: productId, tenantId, deletedAt: null } })
  if (!p || !ctx) return p?.complianceHold ?? null
  const hit = screen([p.nameTa, p.nameEn, p.packTa, p.packEn, p.noteTa, p.noteEn], ctx.entries, { hasLicence: ctx.hasLicence })
  const cases = await prisma.complianceCase.findMany({ where: { subjectId: productId }, orderBy: { createdAt: "desc" } })
  const open = cases.find((c) => c.status === "open")

  if (!hit) {
    if (open) await prisma.complianceCase.update({ where: { id: open.id }, data: { status: "cleared", decidedAt: new Date() } })
    if (p.complianceHold && !cases.some((c) => c.status === "kept_hidden" || c.status === "removed")) {
      await prisma.product.update({ where: { id: p.id }, data: { complianceHold: null } })
      return null
    }
    return p.complianceHold
  }
  // Allowed before for this same word: nothing to do
  if (!open && cases.some((c) => c.status === "allowed" && c.matched === hit.word)) return p.complianceHold
  await prisma.product.update({ where: { id: p.id }, data: { isActive: false, complianceHold: hit.action } })
  const subjectName = [p.nameTa, p.nameEn].filter(Boolean).join(" · ")
  if (open) {
    await prisma.complianceCase.update({ where: { id: open.id }, data: { matched: hit.word, itemId: hit.itemId, action: hit.action, subjectName } })
  } else {
    const c = await prisma.complianceCase.create({ data: { tenantId, kind: "product", subjectId: p.id, subjectName, matched: hit.word, itemId: hit.itemId, action: hit.action, wasActive: p.isActive } })
    await emitEvent("compliance.hit", tenantId, { caseId: c.id, kind: "product", productId: p.id, matched: hit.word, action: hit.action })
  }
  return hit.action
}

/** Screens a category's names: a match opens a case for Farm For You to look at; the category stays as it is. */
export async function screenCategory(tenantId: string, categoryId: string) {
  const ctx = await screenContext(tenantId)
  if (!ctx) return
  const c = await prisma.category.findFirst({ where: { id: categoryId, tenantId, deletedAt: null } })
  if (!c) return
  const hit = screen([c.nameTa, c.nameEn], ctx.entries, { hasLicence: ctx.hasLicence })
  const cases = await prisma.complianceCase.findMany({ where: { subjectId: categoryId } })
  const open = cases.find((x) => x.status === "open")
  if (!hit) {
    if (open) await prisma.complianceCase.update({ where: { id: open.id }, data: { status: "cleared", decidedAt: new Date() } })
    return
  }
  if (open || cases.some((x) => x.status !== "cleared" && x.matched === hit.word)) return
  const made = await prisma.complianceCase.create({ data: { tenantId, kind: "category", subjectId: c.id, subjectName: [c.nameTa, c.nameEn].join(" · "), matched: hit.word, itemId: hit.itemId, action: hit.action } })
  await emitEvent("compliance.hit", tenantId, { caseId: made.id, kind: "category", categoryId: c.id, matched: hit.word, action: hit.action })
}

/** Never throws: screening must not stop a farm saving its product (a failure is logged and the save stands). */
export async function screenSafely(fn: () => Promise<unknown>) {
  try {
    await fn()
  } catch (e) {
    console.error("[compliance]", (e as Error).message)
  }
}

// ── The inbox ────────────────────────────────────────────────────────────────

export const openCasesCount = () => prisma.complianceCase.count({ where: { status: "open" } })

/** Cases, open ones first (oldest first), with the farm, the list entry and, for a product, its photo. */
export async function listCases(show: "open" | "decided", tenantId?: string) {
  const cases = await prisma.complianceCase.findMany({
    where: { ...(show === "open" ? { status: "open" } : { status: { not: "open" } }), ...(tenantId ? { tenantId } : {}) },
    orderBy: { createdAt: show === "open" ? "asc" : "desc" },
    take: 100,
  })
  const [farms, items, products] = await Promise.all([
    prisma.tenant.findMany({ where: { id: { in: [...new Set(cases.map((c) => c.tenantId))] } }, select: { id: true, slug: true, nameTa: true, nameEn: true, status: true, fssaiNo: true } }),
    prisma.restrictedItem.findMany({ where: { id: { in: cases.map((c) => c.itemId).filter((x): x is string => !!x) } } }),
    prisma.product.findMany({ where: { id: { in: cases.filter((c) => c.kind === "product").map((c) => c.subjectId) } }, select: { id: true, imageUrl: true, noteTa: true, noteEn: true, pricePaise: true, deletedAt: true } }),
  ])
  return cases.map((c) => ({ ...c, farm: farms.find((f) => f.id === c.tenantId) ?? null, item: items.find((i) => i.id === c.itemId) ?? null, product: products.find((p) => p.id === c.subjectId) ?? null }))
}

/** Farms with at least `repeatLimit` cases against them: shown to admin to review the farm. */
export async function repeatFarms() {
  const { repeatLimit } = await complianceConfig()
  const groups = await prisma.complianceCase.groupBy({ by: ["tenantId"], where: { status: { in: [...COUNTS_AGAINST] } }, _count: { _all: true } })
  const over = groups.filter((g) => g._count._all >= repeatLimit)
  if (!over.length) return []
  const farms = await prisma.tenant.findMany({ where: { id: { in: over.map((g) => g.tenantId) }, status: { not: "suspended" } }, select: { id: true, nameTa: true, nameEn: true } })
  return farms.map((f) => ({ ...f, count: over.find((g) => g.tenantId === f.id)!._count._all }))
}

/**
 * Farm For You's decision on a case:
 *   allowed      the product shows again as the farm had it, and the same word won't stop it again
 *   kept_hidden  it stays hidden; the farm sees why
 *   removed      the product is taken off the farm's list (kept for old orders)
 * A category can only be allowed or kept (noted); it's never hidden or removed from here.
 */
export async function decideCase(id: string, decision: CaseDecision, note: string | null, actor: Actor, now = new Date()) {
  const c = await prisma.complianceCase.findUnique({ where: { id } })
  if (!c) throw new OrderError("not_found")
  if (c.status !== "open" && !(c.status === "kept_hidden" && decision !== "kept_hidden")) throw new OrderError("case_closed")
  if (c.kind === "category" && decision === "removed") throw new OrderError("invalid_form")
  if (c.kind === "product") {
    if (decision === "allowed") await prisma.product.updateMany({ where: { id: c.subjectId, tenantId: c.tenantId }, data: { complianceHold: null, isActive: c.wasActive } })
    if (decision === "removed") await prisma.product.updateMany({ where: { id: c.subjectId, tenantId: c.tenantId }, data: { isActive: false, deletedAt: now } })
  }
  await prisma.complianceCase.update({ where: { id }, data: { status: decision, note: note?.trim() || null, decidedBy: actor.name, decidedAt: now } })
  await audit(actor, [{ tenantId: c.tenantId, action: `compliance.${decision}`, subject: c.subjectId, before: { status: c.status }, after: { status: decision, matched: c.matched, name: c.subjectName, note } }])
  await emitEvent(`compliance.${decision}`, c.tenantId, { caseId: id, subjectId: c.subjectId })
}

/** For the farm's catalogue: why each held product is hidden, in its words. */
export async function farmHolds(tenantId: string) {
  const held = await prisma.product.findMany({ where: { tenantId, complianceHold: { not: null }, deletedAt: null }, select: { id: true } })
  if (!held.length) return {}
  const cases = await prisma.complianceCase.findMany({ where: { subjectId: { in: held.map((p) => p.id) }, status: { in: ["open", "kept_hidden"] } }, orderBy: { createdAt: "desc" } })
  const items = await prisma.restrictedItem.findMany({ where: { id: { in: cases.map((c) => c.itemId).filter((x): x is string => !!x) } } })
  const out: Record<string, { status: string; action: string; reasonTa: string | null; reasonEn: string | null; note: string | null }> = {}
  for (const p of held) {
    const c = cases.find((x) => x.subjectId === p.id)
    const i = items.find((x) => x.id === c?.itemId)
    out[p.id] = { status: c?.status ?? "open", action: c?.action ?? "hold", reasonTa: i?.reasonTa ?? null, reasonEn: i?.reasonEn ?? null, note: c?.note ?? null }
  }
  return out
}
