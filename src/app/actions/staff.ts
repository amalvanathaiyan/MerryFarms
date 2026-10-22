"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { ROLES } from "@/domain/staff"
import { normaliseIndianMobile } from "@/domain/phone"
import { OrderError } from "@/server/orders"
import { addStaff, resetStaffPassword, setStaffActive, updateStaff } from "@/server/staff"

type Result = { ok: true; password?: string | null } | { ok: false; error: string }

const roles = z.array(z.enum(ROLES as [string, ...string[]])).min(1)
const base = {
  name: z.string().trim().min(1).max(60),
  phone: z.string().trim().max(20).optional(),
  roles,
}

async function attempt(fn: () => Promise<Result>): Promise<Result> {
  try {
    const r = await fn()
    revalidatePath("/farm/staff")
    return r
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    console.error("[staff]", (e as Error).message)
    return { ok: false, error: "staff_login_failed" }
  }
}

const phoneOf = (raw?: string) => (raw ? (normaliseIndianMobile(raw) ?? "bad") : undefined)

export async function addStaffAction(raw: unknown): Promise<Result> {
  const parsed = z.object({ ...base, email: z.string().trim().email().max(120) }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const phone = phoneOf(parsed.data.phone)
  if (phone === "bad") return { ok: false, error: "phone_invalid" }
  const { tenant } = await requireStaff(OWNER_ONLY)
  return attempt(async () => {
    const { password } = await addStaff(tenant.id, { ...parsed.data, phone, roles: parsed.data.roles as never })
    return { ok: true, password }
  })
}

export async function updateStaffAction(raw: unknown): Promise<Result> {
  const parsed = z.object({ ...base, id: z.string().min(1) }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const phone = phoneOf(parsed.data.phone)
  if (phone === "bad") return { ok: false, error: "phone_invalid" }
  const { tenant, staff } = await requireStaff(OWNER_ONLY)
  return attempt(async () => {
    await updateStaff(tenant.id, staff.id, parsed.data.id, { ...parsed.data, phone, roles: parsed.data.roles as never })
    return { ok: true }
  })
}

export async function setStaffActiveAction(id: string, active: boolean): Promise<Result> {
  const { tenant, staff } = await requireStaff(OWNER_ONLY)
  return attempt(async () => {
    await setStaffActive(tenant.id, staff.id, id, active)
    return { ok: true }
  })
}

export async function resetStaffPasswordAction(id: string): Promise<Result> {
  const { tenant } = await requireStaff(OWNER_ONLY)
  return attempt(async () => ({ ok: true, password: await resetStaffPassword(tenant.id, id) }))
}
