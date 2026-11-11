"use client"

import { MAX_ORIGINAL_BYTES, MAX_SECONDS, UPLOAD_VIDEO, VIDEO_TYPES } from "@/domain/videos"
import { createClient } from "@/lib/supabase/client"

export interface PreparedVideo {
  blob: Blob
  type: (typeof VIDEO_TYPES)[number]
  /** True when the phone made it smaller (720p); false when it is the file as recorded. */
  shrunk: boolean
  seconds: number | null
  poster: Blob | null
}

/** How long a video file plays, from the browser itself. */
function videoInfo(blob: Blob): Promise<{ seconds: number | null; poster: Blob | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const v = document.createElement("video")
    v.muted = true
    v.playsInline = true
    v.preload = "auto"
    v.src = url
    const done = (r: { seconds: number | null; poster: Blob | null }) => (URL.revokeObjectURL(url), resolve(r))
    const timer = setTimeout(() => done({ seconds: Number.isFinite(v.duration) ? v.duration : null, poster: null }), 15_000)
    v.onerror = () => (clearTimeout(timer), done({ seconds: null, poster: null }))
    v.onloadedmetadata = () => {
      // A frame a little way in makes a better picture than the first (often dark or blurred).
      v.currentTime = Math.min(1.5, (v.duration || 3) / 3)
    }
    v.onseeked = () => {
      // 'seeked' can fire before the frame is drawn (giving a black picture): wait for the frame itself.
      const draw = () => grab()
      const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => void }).requestVideoFrameCallback
      if (rvfc) rvfc.call(v, draw)
      else setTimeout(draw, 200)
    }
    const grab = () => {
      clearTimeout(timer)
      const w = Math.min(960, v.videoWidth || 960)
      const h = Math.round(((v.videoHeight || 540) / (v.videoWidth || 960)) * w)
      const c = document.createElement("canvas")
      c.width = w
      c.height = h
      c.getContext("2d")?.drawImage(v, 0, 0, w, h)
      c.toBlob((b) => done({ seconds: Number.isFinite(v.duration) ? v.duration : null, poster: b }), "image/jpeg", 0.8)
    }
  })
}

/** A picture from a little way into the video (the first frame is often dark or blurred), straight from the file. */
async function frameOf(mb: typeof import("mediabunny"), blob: Blob): Promise<Blob | null> {
  try {
    const input = new mb.Input({ source: new mb.BlobSource(blob), formats: mb.ALL_FORMATS })
    const track = await input.getPrimaryVideoTrack()
    if (!track) return null
    const seconds = await input.computeDuration()
    const frame = await new mb.CanvasSink(track, { width: 960 }).getCanvas(Math.min(1.5, seconds / 3))
    if (!frame) return null
    const c = frame.canvas
    if ("convertToBlob" in c) return await c.convertToBlob({ type: "image/jpeg", quality: 0.8 })
    return await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/jpeg", 0.8))
  } catch {
    return null
  }
}

/**
 * Gets a phone video ready to upload: made smaller on the phone (720p, sound kept as recorded, cut to the longest
 * allowed), with a picture for before it plays. A phone that can't make video smaller sends small files as they are.
 * Throws "video_type" / "video_too_big_original" when it can't be used.
 */
export async function prepareVideo(file: File, onProgress: (share: number) => void): Promise<PreparedVideo> {
  const type = (VIDEO_TYPES as readonly string[]).includes(file.type) ? (file.type as PreparedVideo["type"]) : file.name.toLowerCase().endsWith(".mov") ? "video/quicktime" : null
  if (!type && !file.type.startsWith("video/")) throw new Error("video_type")

  if (typeof VideoEncoder !== "undefined") {
    try {
      const mb = await import("mediabunny")
      if (await mb.canEncode("avc")) {
        const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })
        const track = await input.getPrimaryVideoTrack()
        const seconds = await input.computeDuration().catch(() => null)
        // Already small and in the format every phone plays (H.264 MP4): send it as it is, never bigger.
        const target = (UPLOAD_VIDEO.bitrate / 8) * Math.min(seconds ?? MAX_SECONDS, MAX_SECONDS) * 1.2 + 200_000
        if (track && (await track.getCodec()) === "avc" && file.type === "video/mp4" && seconds != null && seconds <= MAX_SECONDS + 1 && file.size <= target) {
          onProgress(1)
          return { blob: file, type: "video/mp4", shrunk: true, seconds, poster: await frameOf(mb, file) }
        }
        const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() })
        const conv = await mb.Conversion.init({
          input,
          output,
          video: { width: UPLOAD_VIDEO.width, height: UPLOAD_VIDEO.height, fit: "contain", bitrate: UPLOAD_VIDEO.bitrate, codec: "avc" },
          trim: { end: MAX_SECONDS },
        })
        if (conv.isValid) {
          conv.onProgress = (p) => onProgress(p)
          await conv.execute()
          const blob = new Blob([output.target.buffer!], { type: "video/mp4" })
          const info = await videoInfo(blob)
          return { blob, type: "video/mp4", shrunk: true, seconds: info.seconds, poster: (await frameOf(mb, blob)) ?? info.poster }
        }
      }
    } catch (e) {
      console.warn("[video] could not make it smaller, trying as it is:", (e as Error).message)
    }
  }
  if (!type) throw new Error("video_type")
  if (file.size > MAX_ORIGINAL_BYTES) throw new Error("video_too_big_original")
  onProgress(1)
  return { blob: file, type, shrunk: false, ...(await videoInfo(file)) }
}

export type UploadTarget = { kind: "supabase"; path: string; token: string } | { kind: "local"; path: string; url: string }

/** Puts a file at the place the app gave out: straight into storage (or the demo stand-in). */
export async function uploadTo(target: UploadTarget, blob: Blob, contentType: string) {
  if (target.kind === "supabase") {
    const { error } = await createClient().storage.from("farm-media").uploadToSignedUrl(target.path, target.token, blob, { contentType, upsert: false })
    if (error) throw new Error(error.message)
    return
  }
  const r = await fetch(target.url, { method: "PUT", body: blob, headers: { "content-type": contentType } })
  if (!r.ok) throw new Error(`upload ${r.status}`)
}
