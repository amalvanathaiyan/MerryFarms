import { MAX_PHOTO_BYTES } from "@/domain/product-art"

/**
 * Shrinks a phone photo to at most 800 px on the long side before upload, so a
 * 4 MB camera picture becomes about 50 KB. WebP where the phone supports it, else JPEG.
 */
export async function shrinkPhoto(file: File, maxSide = 800): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  for (const quality of [0.82, 0.7, 0.55]) {
    let url = canvas.toDataURL("image/webp", quality)
    if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", quality)
    if ((url.length * 3) / 4 < MAX_PHOTO_BYTES) return url
  }
  throw new Error("photo_too_big")
}
