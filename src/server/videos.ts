import "server-only"
import { randomUUID } from "node:crypto"
import { tenantDb } from "@/lib/tenant-db"
import { checkUpload, fitsInSpace, MAX_SECONDS, MAX_UPLOAD_BYTES, MAX_VIDEOS, moveVideo, youtubeId, youtubePoster } from "@/domain/videos"
import { publicUrl, removeStored, storedSize, uploadTarget } from "./media-store"
import { OrderError } from "./orders"

const EXT: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" }
const filePaths = (tenantId: string, id: string, type: string) => ({
  video: `${tenantId}/videos/${id}.${EXT[type] ?? "mp4"}`,
  poster: `${tenantId}/videos/${id}.jpg`,
})

export async function listVideos(tenantId: string) {
  return tenantDb(tenantId).farmVideo.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })
}

async function roomForOne(tenantId: string) {
  if ((await tenantDb(tenantId).farmVideo.count()) >= MAX_VIDEOS) throw new OrderError("video_limit")
}
/** Bytes the farm's uploaded videos take in storage (YouTube links take none). */
export async function usedVideoBytes(tenantId: string) {
  const r = await tenantDb(tenantId).farmVideo.aggregate({ where: { kind: "upload" }, _sum: { bytes: true } })
  return r._sum.bytes ?? 0
}

async function nextOrder(tenantId: string) {
  const last = await tenantDb(tenantId).farmVideo.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } })
  return (last?.sortOrder ?? -1) + 1
}

/**
 * Step 1 of an upload: checks it (type, size, count, the farm's storage space), and gives the phone one-time places
 * for the video and its picture. `spaceBytes` is the farm's space (videoSpaceBytes).
 */
export async function startUpload(tenantId: string, f: { type: string; bytes: number; shrunk: boolean }, spaceBytes: number) {
  const problem = checkUpload(f)
  if (problem) throw new OrderError(problem)
  await roomForOne(tenantId)
  if (!fitsInSpace(await usedVideoBytes(tenantId), f.bytes, spaceBytes)) throw new OrderError("video_space")
  const id = randomUUID()
  const p = filePaths(tenantId, id, f.type)
  return { id, video: await uploadTarget(p.video), poster: await uploadTarget(p.poster) }
}

/** Step 2: the phone has put the files; record the video (only if the file really arrived, and isn't too big). */
export async function finishUpload(
  tenantId: string,
  staffId: string,
  v: { id: string; type: string; seconds: number | null; title: string | null; banner: boolean; watch: boolean; withPoster: boolean },
  spaceBytes: number
) {
  // Sent twice (a double tap, or a retry after a weak signal): it is already saved.
  const saved = await tenantDb(tenantId).farmVideo.findFirst({ where: { id: v.id } })
  if (saved) return saved
  await roomForOne(tenantId)
  const p = filePaths(tenantId, v.id, v.type)
  const size = await storedSize(p.video)
  if (size == null || size === 0) throw new OrderError("video_not_uploaded")
  if (size > MAX_UPLOAD_BYTES) {
    await removeStored([p.video, p.poster])
    throw new OrderError("video_too_big")
  }
  // Checked again on the real file: the phone could send more than it said at step 1.
  if (!fitsInSpace(await usedVideoBytes(tenantId), size, spaceBytes)) {
    await removeStored([p.video, p.poster])
    throw new OrderError("video_space")
  }
  const poster = v.withPoster && (await storedSize(p.poster)) ? p.poster : null
  return tenantDb(tenantId).farmVideo.create({
    data: {
      id: v.id,
      tenantId,
      kind: "upload",
      src: publicUrl(p.video),
      storagePath: p.video,
      posterPath: poster,
      posterUrl: poster ? publicUrl(poster) : null,
      title: v.title,
      banner: v.banner,
      watch: v.watch,
      sortOrder: await nextOrder(tenantId),
      seconds: v.seconds == null ? null : Math.min(MAX_SECONDS, Math.round(v.seconds)),
      bytes: size,
      byStaffId: staffId,
    },
  })
}

/** A YouTube video in "Watch our farm" (YouTube can't be a silent banner). */
export async function addYoutube(tenantId: string, staffId: string, link: string, title: string | null) {
  const id = youtubeId(link)
  if (!id) throw new OrderError("youtube_link")
  const db = tenantDb(tenantId)
  if (await db.farmVideo.findFirst({ where: { kind: "youtube", src: id }, select: { id: true } })) throw new OrderError("video_already")
  await roomForOne(tenantId)
  return db.farmVideo.create({
    data: { tenantId, kind: "youtube", src: id, posterUrl: youtubePoster(id), title, banner: false, watch: true, sortOrder: await nextOrder(tenantId), byStaffId: staffId },
  })
}

export async function updateVideo(tenantId: string, id: string, change: { title?: string | null; banner?: boolean; watch?: boolean }) {
  const db = tenantDb(tenantId)
  const v = await db.farmVideo.findFirst({ where: { id } })
  if (!v) throw new OrderError("video_not_found")
  if (change.banner && v.kind !== "upload") throw new OrderError("video_banner_upload_only")
  await db.farmVideo.updateMany({ where: { id }, data: change })
}

export async function moveFarmVideo(tenantId: string, id: string, dir: "up" | "down") {
  const db = tenantDb(tenantId)
  const ids = (await listVideos(tenantId)).map((v) => v.id)
  if (!ids.includes(id)) throw new OrderError("video_not_found")
  const order = moveVideo(ids, id, dir)
  await Promise.all(order.map((vid, i) => db.farmVideo.updateMany({ where: { id: vid }, data: { sortOrder: i } })))
}

/** Removes the video and its files. */
export async function deleteVideo(tenantId: string, id: string) {
  const db = tenantDb(tenantId)
  const v = await db.farmVideo.findFirst({ where: { id } })
  if (!v) throw new OrderError("video_not_found")
  await db.farmVideo.deleteMany({ where: { id } })
  await removeStored([v.storagePath, v.posterPath].filter((x): x is string => !!x))
}
