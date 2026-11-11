import { describe, expect, it } from "vitest"
import { checkUpload, DEFAULT_VIDEO_SPACE_MB, fitsInSpace, MAX_ORIGINAL_BYTES, MAX_UPLOAD_BYTES, moveVideo, shopVideos, videoSpaceBytes, youtubeId, type FarmVideoRow } from "./videos"

describe("YouTube links", () => {
  it("finds the video in every usual kind of link", () => {
    for (const link of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?si=abc",
      "youtu.be/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/live/dQw4w9WgXcQ?feature=share",
      "dQw4w9WgXcQ",
    ]) {
      expect(youtubeId(link), link).toBe("dQw4w9WgXcQ")
    }
  })

  it("refuses anything that isn't a YouTube video", () => {
    for (const link of ["https://vimeo.com/123456", "https://www.youtube.com/@merryfarms", "https://www.youtube.com/watch?v=short", "not a link at all", "https://evil.com/watch?v=dQw4w9WgXcQ"]) {
      expect(youtubeId(link), link).toBeNull()
    }
  })
})

describe("uploads", () => {
  it("takes phone videos within the size limits", () => {
    expect(checkUpload({ type: "video/mp4", bytes: 5_000_000, shrunk: true })).toBeNull()
    expect(checkUpload({ type: "video/quicktime", bytes: 5_000_000, shrunk: false })).toBeNull()
    expect(checkUpload({ type: "image/png", bytes: 5000, shrunk: false })).toBe("video_type")
    expect(checkUpload({ type: "video/mp4", bytes: 0, shrunk: true })).toBe("video_empty")
    expect(checkUpload({ type: "video/mp4", bytes: MAX_UPLOAD_BYTES + 1, shrunk: true })).toBe("video_too_big")
    expect(checkUpload({ type: "video/mp4", bytes: MAX_ORIGINAL_BYTES + 1, shrunk: false })).toBe("video_too_big_original")
  })
})

describe("the shop's lists", () => {
  const v = (id: string, o: Partial<FarmVideoRow>): FarmVideoRow => ({ id, kind: "upload", src: id, posterUrl: null, title: null, banner: false, watch: true, sortOrder: 0, ...o })

  it("banners are uploads only (YouTube can't play silently on repeat), both lists in the farm's order", () => {
    const rows = [v("c", { sortOrder: 2, banner: true }), v("yt", { kind: "youtube", sortOrder: 0, banner: true }), v("a", { sortOrder: 1, banner: true, watch: false })]
    const { banner, watch } = shopVideos(rows)
    expect(banner.map((x) => x.id)).toEqual(["a", "c"])
    expect(watch.map((x) => x.id)).toEqual(["yt", "c"])
  })

  it("moves a video up or down, and leaves the ends alone", () => {
    expect(moveVideo(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"])
    expect(moveVideo(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"])
    expect(moveVideo(["a", "b", "c"], "a", "up")).toEqual(["a", "b", "c"])
    expect(moveVideo(["a", "b", "c"], "c", "down")).toEqual(["a", "b", "c"])
  })
})

describe("video space", () => {
  it("uses the farm's own limit, else the standard one", () => {
    expect(videoSpaceBytes(null)).toBe(DEFAULT_VIDEO_SPACE_MB * 1024 * 1024)
    expect(videoSpaceBytes(500)).toBe(500 * 1024 * 1024)
    expect(videoSpaceBytes(0)).toBe(0)
  })
  it("lets a file in only if it fits in what's left", () => {
    expect(fitsInSpace(90, 10, 100)).toBe(true)
    expect(fitsInSpace(90, 11, 100)).toBe(false)
    expect(fitsInSpace(0, 1, 0)).toBe(false)
  })
})
