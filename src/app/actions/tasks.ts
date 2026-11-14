"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requireStaff } from "@/lib/auth"
import { REPEAT_UNITS } from "@/domain/tasks"
import { OrderError } from "@/server/orders"
import { markTaskDone, removeTask, saveTask, undoTask } from "@/server/tasks"

/** My farm · Jobs: the owner and a manager plan them; whoever a job is for can mark it done. */

type Result = { ok: true } | { ok: false; error: string }
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const id = z.string().uuid()

async function attempt(fn: () => Promise<unknown>): Promise<Result> {
  try {
    await fn()
    revalidatePath("/farm", "layout")
    return { ok: true }
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    console.error("[tasks]", (e as Error).message)
    return { ok: false, error: "generic" }
  }
}

export async function saveTaskAction(raw: unknown): Promise<Result> {
  const parsed = z
    .object({
      id: id.nullable(),
      title: z.string().trim().min(1).max(80),
      note: z.string().trim().max(300).nullable(),
      dueOn: ymd,
      repeatEvery: z.number().int().min(1).max(365).nullable(),
      repeatUnit: z.enum(REPEAT_UNITS).nullable(),
      placeId: id.nullable(),
      assetId: id.nullable(),
      forStaffId: id.nullable(),
    })
    .safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  const { db, tenant, staff } = await requireStaff(["owner", "manager"])
  const { id: taskId, ...f } = parsed.data
  return attempt(() => saveTask(db, tenant.id, taskId, f, staff.id))
}

export async function removeTaskAction(taskId: string): Promise<Result> {
  if (!id.safeParse(taskId).success) return { ok: false, error: "invalid_form" }
  const { db } = await requireStaff(["owner", "manager"])
  return attempt(() => removeTask(db, taskId))
}

export async function markTaskDoneAction(taskId: string): Promise<Result> {
  if (!id.safeParse(taskId).success) return { ok: false, error: "invalid_form" }
  const { db, staff } = await requireStaff()
  return attempt(() => markTaskDone(db, taskId, staff))
}

export async function undoTaskAction(taskId: string): Promise<Result> {
  if (!id.safeParse(taskId).success) return { ok: false, error: "invalid_form" }
  const { db } = await requireStaff(["owner", "manager"])
  return attempt(() => undoTask(db, taskId))
}
