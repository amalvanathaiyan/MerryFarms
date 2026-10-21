// Writes the app icons (a cream egg on field green) as PNGs, with no image library.
// Run once: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib"
import { writeFileSync, mkdirSync } from "node:fs"

const GREEN = [45, 106, 62]
const EGG = [252, 239, 211]

function crc32(buf) {
  let c = ~0
  for (const b of buf) {
    c ^= b
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function icon(size) {
  const rows = []
  const cx = size / 2, cy = size * 0.54, rx = size * 0.22, ry = size * 0.29
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3) // filter byte 0, then RGB
    for (let x = 0; x < size; x++) {
      // An egg: narrower at the top than the bottom.
      const dy = (y - cy) / ry
      const widen = dy < 0 ? 1 + 0.2 * dy : 1 // tapers smoothly towards the top
      const dx = (x - cx) / (rx * widen)
      const [r, g, b] = dx * dx + dy * dy <= 1 ? EGG : GREEN
      row.set([r, g, b], 1 + x * 3)
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 2, 0, 0, 0], 8) // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

mkdirSync("public/icons", { recursive: true })
for (const s of [192, 512]) writeFileSync(`public/icons/icon-${s}.png`, icon(s))
console.log("Wrote public/icons/icon-192.png and icon-512.png")
