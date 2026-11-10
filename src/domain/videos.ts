/**
 * The farm's videos: short clips uploaded from the farm app, or YouTube links. Each can be a banner (plays silently
 * and on repeat on the shop's home page) and/or be in "Watch our farm" (plays with sound when tapped).
 * Pure, so it is tested.
 */

/** A clip is shrunk on the phone to about this (720p) before upload. */
export const UPLOAD_VIDEO = { width: 1280, height: 720, bitrate: 1_200_000 }
/** Longest clip kept; anything longer is cut to this. */
export const MAX_SECONDS = 60
/** Biggest file accepted after shrinking (a minute at 720p is about 10 MB). */
export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024
/** Biggest file accepted as it is, when a phone can't shrink video. */
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024
/** Most videos a farm keeps. */
export const MAX_VIDEOS = 12
/** Storage space for a farm's uploaded videos, unless the platform gives that farm more (or less). */
export const DEFAULT_VIDEO_SPACE_MB = 150
const MB = 1024 * 1024

/** The farm's space in bytes: its own limit if the platform set one, else the default. */
export const videoSpaceBytes = (farmLimitMb: number | null | undefined) => (farmLimitMb ?? DEFAULT_VIDEO_SPACE_MB) * MB

/** Whether a file of `adding` bytes still fits in the farm's space. */
export const fitsInSpace = (usedBytes: number, adding: number, spaceBytes: number) => usedBytes + adding <= spaceBytes

export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const

export type VideoKind = "upload" | "youtube"

export interface FarmVideoRow {
  id: string
  kind: VideoKind
  /** The file's public address for uploads; the 11-character video id for YouTube. */
  src: string
  posterUrl: string | null
  title: string | null
  banner: boolean
  watch: boolean
  sortOrder: number
}

/** The id in any usual YouTube link (watch, youtu.be, shorts, embed, live), or null. */
export function youtubeId(link: string): string | null {
  const s = link.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^(www|m|music)\./, "")
  let id: string | null = null
  if (host === "youtu.be") id = u.pathname.split("/")[1] ?? null
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v")
    else {
      const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/)
      id = m?.[1] ?? null
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null
}

/** Where a YouTube video plays (the privacy-friendly player, no related videos from other channels). */
export const youtubeEmbed = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`
export const youtubePoster = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

/** Why an upload can't go ahead, or null. `shrunk` says whether the phone shrank it first. */
export function checkUpload(f: { type: string; bytes: number; shrunk: boolean }): string | null {
  if (!(VIDEO_TYPES as readonly string[]).includes(f.type)) return "video_type"
  if (f.bytes <= 0) return "video_empty"
  if (f.bytes > (f.shrunk ? MAX_UPLOAD_BYTES : MAX_ORIGINAL_BYTES)) return f.shrunk ? "video_too_big" : "video_too_big_original"
  return null
}

/** The shop's two lists, in the farm's order: silent banners (uploads only) and "Watch our farm". */
export function shopVideos<T extends FarmVideoRow>(rows: T[]): { banner: T[]; watch: T[] } {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder)
  return { banner: sorted.filter((v) => v.banner && v.kind === "upload"), watch: sorted.filter((v) => v.watch) }
}

/** Swap a video with its neighbour; returns the new order of ids. */
export function moveVideo(ids: string[], id: string, dir: "up" | "down"): string[] {
  const i = ids.indexOf(id)
  const j = dir === "up" ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= ids.length) return ids
  const out = [...ids]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}
