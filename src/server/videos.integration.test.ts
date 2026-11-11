/**
 * Farm videos against a real Postgres (PGlite over a local socket) with files in a temporary folder (the demo
 * stand-in for storage): the two-step upload, YouTube links, the limit, order, staying inside the farm, and files
 * going with the video.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { PGLiteSocketServer } from "@electric-sql/pglite-socket"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const PORT = 54339
const DIR = mkdtempSync(path.join(os.tmpdir(), "farm-media-"))

let pg: PGlite
let server: PGLiteSocketServer
let prisma: typeof import("@/lib/prisma").prisma
let videos: typeof import("./videos")

const tenantRow = (id: string) => ({
  id,
  slug: id,
  nameTa: id,
  nameEn: id,
  status: "active" as const,
  plan: "pro" as const,
  defaultLanguage: "ta" as const,
  phone: "+919000050001",
  invoicePrefix: "MF",
  whatsappMode: "lite" as const,
  deliveryFeePaise: 0,
  freeAbovePaise: 0,
})

const code = async (p: Promise<unknown>) => {
  try {
    await p
    return null
  } catch (e) {
    return (e as { code?: string }).code ?? String(e)
  }
}

/** What the phone does between the two steps: put the bytes where it was told. */
function phonePuts(target: { kind: string; path: string }, bytes: number) {
  const file = path.join(DIR, target.path)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, Buffer.alloc(bytes, 7))
}

beforeAll(async () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.MEDIA_DIR_FOR_TESTS = DIR
  pg = new PGlite()
  await pg.exec(readFileSync(path.join(__dirname, "../../prisma/sql/schema.generated.sql"), "utf8"))
  server = new PGLiteSocketServer({ db: pg, port: PORT, host: "127.0.0.1", maxConnections: 10 })
  await server.start()
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`
  ;({ prisma } = await import("@/lib/prisma"))
  videos = await import("./videos")
  await prisma.tenant.createMany({ data: [tenantRow("t1"), tenantRow("t2")] })
}, 60_000)

afterAll(async () => {
  await prisma?.$disconnect()
  await server?.stop()
  await pg?.close()
  rmSync(DIR, { recursive: true, force: true })
})

/** A farm's space for uploads in these tests: plenty, except where a test says otherwise. */
const SPACE = 150 * 1024 * 1024

describe("farm videos", () => {
  let first: string

  it("uploads in two steps, and only records a video whose file really arrived", async () => {
    const begun = await videos.startUpload("t1", { type: "video/mp4", bytes: 5_000_000, shrunk: true }, SPACE)
    expect(begun.video).toMatchObject({ kind: "local", path: `t1/videos/${begun.id}.mp4` })
    expect(begun.poster.path).toBe(`t1/videos/${begun.id}.jpg`)
    // Nothing arrived yet.
    expect(await code(videos.finishUpload("t1", "s1", { id: begun.id, type: "video/mp4", seconds: 12, title: null, banner: true, watch: true, withPoster: true }, SPACE))).toBe("video_not_uploaded")
    phonePuts(begun.video, 4_000)
    phonePuts(begun.poster, 300)
    const v = await videos.finishUpload("t1", "s1", { id: begun.id, type: "video/mp4", seconds: 12.4, title: "Morning eggs", banner: true, watch: true, withPoster: true }, SPACE)
    expect(v).toMatchObject({ kind: "upload", title: "Morning eggs", banner: true, watch: true, seconds: 12, bytes: 4_000, sortOrder: 0, storagePath: `t1/videos/${begun.id}.mp4` })
    expect(v.src).toBe(`/api/demo-media?path=${encodeURIComponent(`t1/videos/${begun.id}.mp4`)}`)
    expect(v.posterUrl).toContain(".jpg")
    first = v.id
  })

  it("saves a video sent twice only once", async () => {
    const again = await videos.finishUpload("t1", "s1", { id: first, type: "video/mp4", seconds: 12.4, title: "Morning eggs", banner: true, watch: true, withPoster: true }, SPACE)
    expect(again.id).toBe(first)
    expect(await videos.listVideos("t1")).toHaveLength(1)
  })

  it("keeps each farm inside its own video space", async () => {
    // t2 has 10 KB of space: a 6 KB video fits, a second one doesn't, whatever the phone claimed at the start.
    const small = 10_000
    const one = await videos.startUpload("t2", { type: "video/mp4", bytes: 6_000, shrunk: true }, small)
    phonePuts(one.video, 6_000)
    await videos.finishUpload("t2", "s2", { id: one.id, type: "video/mp4", seconds: 5, title: null, banner: false, watch: true, withPoster: false }, small)
    expect(await videos.usedVideoBytes("t2")).toBe(6_000)
    expect(await code(videos.startUpload("t2", { type: "video/mp4", bytes: 6_000, shrunk: true }, small))).toBe("video_space")
    const two = await videos.startUpload("t2", { type: "video/mp4", bytes: 1_000, shrunk: true }, small)
    phonePuts(two.video, 6_000)
    expect(await code(videos.finishUpload("t2", "s2", { id: two.id, type: "video/mp4", seconds: 5, title: null, banner: false, watch: true, withPoster: false }, small))).toBe("video_space")
    expect(existsSync(path.join(DIR, two.video.path))).toBe(false)
    // The other farm's uploads don't count against it.
    expect(await videos.usedVideoBytes("t1")).toBe(4_000)
    await videos.deleteVideo("t2", one.id)
    expect(await videos.usedVideoBytes("t2")).toBe(0)
  })

  it("refuses files that can't be used before anything is uploaded", async () => {
    expect(await code(videos.startUpload("t1", { type: "image/png", bytes: 100, shrunk: false }, SPACE))).toBe("video_type")
    expect(await code(videos.startUpload("t1", { type: "video/quicktime", bytes: 30 * 1024 * 1024, shrunk: false }, SPACE))).toBe("video_too_big_original")
  })

  it("adds YouTube videos to Watch our farm only, once each", async () => {
    const yt = await videos.addYoutube("t1", "s1", "https://youtu.be/dQw4w9WgXcQ?si=x", "Our farm tour")
    expect(yt).toMatchObject({ kind: "youtube", src: "dQw4w9WgXcQ", banner: false, watch: true, sortOrder: 1, posterUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" })
    expect(await code(videos.addYoutube("t1", "s1", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", null))).toBe("video_already")
    expect(await code(videos.addYoutube("t1", "s1", "https://vimeo.com/1", null))).toBe("youtube_link")
    expect(await code(videos.updateVideo("t1", yt.id, { banner: true }))).toBe("video_banner_upload_only")
  })

  it("keeps the farm's order, and stays inside the farm", async () => {
    const [a, b] = (await videos.listVideos("t1")).map((v) => v.id)
    await videos.moveFarmVideo("t1", b, "up")
    expect((await videos.listVideos("t1")).map((v) => v.id)).toEqual([b, a])
    expect(await videos.listVideos("t2")).toEqual([])
    expect(await code(videos.deleteVideo("t2", a))).toBe("video_not_found")
    expect(await code(videos.updateVideo("t2", a, { watch: false }))).toBe("video_not_found")
  })

  it("stops at the limit of 12 videos", async () => {
    for (let n = 0; n < 10; n++) await videos.addYoutube("t1", "s1", `https://youtu.be/abcdefghi${String(n).padStart(2, "0")}`, null)
    expect(await videos.listVideos("t1")).toHaveLength(12)
    expect(await code(videos.startUpload("t1", { type: "video/mp4", bytes: 1000, shrunk: true }, SPACE))).toBe("video_limit")
    expect(await code(videos.addYoutube("t1", "s1", "https://youtu.be/zzzzzzzzzzz", null))).toBe("video_limit")
  })

  it("deletes the video and its files", async () => {
    const v = (await videos.listVideos("t1")).find((x) => x.id === first)!
    expect(existsSync(path.join(DIR, v.storagePath!))).toBe(true)
    await videos.deleteVideo("t1", first)
    expect(existsSync(path.join(DIR, v.storagePath!))).toBe(false)
    expect(existsSync(path.join(DIR, v.posterPath!))).toBe(false)
  })
})
