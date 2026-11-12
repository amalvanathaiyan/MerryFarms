"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { MAX_SECONDS, VIDEO_TYPES, videoSpaceBytes } from "@/domain/videos"
import type { FeatureKey } from "@/domain/features"
import { featuresOf } from "@/lib/features"
import { addYoutube, deleteVideo, finishUpload, moveFarmVideo, startUpload, updateVideo } from "@/server/videos"
import type { UploadTarget } from "@/server/media-store"
import { OrderError } from "@/server/orders"
import { planLimits } from "@/lib/features"

type Fail = { ok: false; error: string }

async function run<T extends object>(fn: () => Promise<T>): Promise<({ ok: true } & T) | Fail> {
  try {
    const out = await fn()
    revalidatePath("/", "layout")
    return { ok: true, ...out }
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.code }
    throw e
  }
}

/** The owner of a farm with this feature on: YouTube links need farmVideos, uploads need videoUploads too. */
async function owner(feature: FeatureKey) {
  const ctx = await requireStaff(OWNER_ONLY)
  if (!featuresOf(ctx.tenant)[feature]) throw new OrderError(feature === "videoUploads" ? "video_uploads_plan" : "feature_off")
  return { ...ctx, space: videoSpaceBytes(ctx.tenant.videoSpaceMb ?? planLimits(ctx.tenant).videoSpaceMb) }
}

const type = z.enum(VIDEO_TYPES)
const title = z.string().trim().max(80).optional()

/** Owner: the start of an upload. Returns where the phone should put the video and its picture. */
export async function startVideoUploadAction(raw: unknown): Promise<({ ok: true } & { id: string; video: UploadTarget; poster: UploadTarget }) | Fail> {
  const parsed = z.object({ type, bytes: z.number().int().positive(), shrunk: z.boolean() }).safeParse(raw)
  if (!parsed.success) return { ok: false, error: "invalid_form" }
  return run(async () => {
    const { tenant, space } = await owner("videoUploads")
    return startUpload(tenant.id, parsed.data, space)
  })
}

/** Owner: the files are up; record the video. */
export async function finishVideoUploadAction(raw: unknown) {
  const parsed = z
    .object({ id: z.string().uuid(), type, seconds: z.number().min(0).max(MAX_SECONDS + 5).nullable(), title, banner: z.boolean(), watch: z.boolean(), withPoster: z.boolean() })
    .safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: "invalid_form" }
  return run(async () => {
    const { tenant, staff, space } = await owner("videoUploads")
    const d = parsed.data
    await finishUpload(tenant.id, staff.id, { ...d, title: d.title || null }, space)
    return {}
  })
}

export async function addYoutubeAction(raw: unknown) {
  const parsed = z.object({ link: z.string().trim().min(5).max(300), title }).safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: "youtube_link" }
  return run(async () => {
    const { tenant, staff } = await owner("farmVideos")
    await addYoutube(tenant.id, staff.id, parsed.data.link, parsed.data.title || null)
    return {}
  })
}

export async function updateVideoAction(id: string, raw: unknown) {
  const parsed = z.object({ title: z.string().trim().max(80).nullable().optional(), banner: z.boolean().optional(), watch: z.boolean().optional() }).safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: "invalid_form" }
  return run(async () => {
    const { tenant } = await owner("farmVideos")
    await updateVideo(tenant.id, id, { ...parsed.data, title: parsed.data.title === undefined ? undefined : parsed.data.title || null })
    return {}
  })
}

export async function moveVideoAction(id: string, dir: "up" | "down") {
  return run(async () => {
    const { tenant } = await owner("farmVideos")
    await moveFarmVideo(tenant.id, id, dir === "up" ? "up" : "down")
    return {}
  })
}

export async function deleteVideoAction(id: string) {
  return run(async () => {
    const { tenant } = await owner("farmVideos")
    await deleteVideo(tenant.id, id)
    return {}
  })
}
