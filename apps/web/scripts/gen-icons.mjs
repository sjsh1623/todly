/**
 * Generates todly PWA icons as valid PNGs without any image library.
 *
 * Renders a #2E86E6 rounded square with a white lowercase "t" wordmark into a
 * raw RGBA buffer, then encodes it as a PNG (zlib deflate of the scanlines).
 * Produces:
 *   public/pwa-192x192.png        (any)
 *   public/pwa-512x512.png        (any)
 *   public/maskable-512x512.png   (maskable — mark inset to the safe zone)
 *   public/apple-touch-icon.png   (180, opaque)
 *   public/favicon.ico-fallback   -> we ship favicon.svg separately
 *
 * Run: node scripts/gen-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '..', 'public')
mkdirSync(PUBLIC, { recursive: true })

const BRAND = [0x2e, 0x86, 0xe6] // #2E86E6
const DEEP = [0x13, 0x66, 0xce] // #1366CE (subtle vertical gradient bottom)
const WHITE = [0xff, 0xff, 0xff]

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t)
}

/** CRC32 for PNG chunks. */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  // raw scanlines with filter byte 0
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * Draws the icon into an RGBA buffer.
 * @param size canvas size
 * @param opts.maskable inset the rounded square mark to the maskable safe zone
 * @param opts.opaque fill transparent corners with brand (for apple-touch)
 */
function draw(size, { maskable = false, opaque = false } = {}) {
  const buf = Buffer.alloc(size * size * 4)
  // Mark geometry: for maskable, keep the visual within ~80% safe zone.
  const pad = maskable ? size * 0.14 : size * 0.06
  const x0 = pad
  const y0 = pad
  const sq = size - pad * 2
  const radius = sq * 0.24

  // "t" stroke geometry relative to the square.
  const stemW = sq * 0.13
  const stemX = x0 + sq * 0.46
  const stemTop = y0 + sq * 0.2
  const stemBot = y0 + sq * 0.78
  // crossbar
  const crossY = y0 + sq * 0.38
  const crossH = sq * 0.12
  const crossX0 = x0 + sq * 0.3
  const crossX1 = x0 + sq * 0.66
  // foot (the curl of the t)
  const footY = stemBot
  const footX1 = stemX + stemW + sq * 0.12

  const inRoundRect = (x, y) => {
    if (x < x0 || x > x0 + sq || y < y0 || y > y0 + sq) return false
    // rounded corners
    const rx = Math.min(x - x0, x0 + sq - x)
    const ry = Math.min(y - y0, y0 + sq - y)
    if (rx < radius && ry < radius) {
      const dx = radius - rx
      const dy = radius - ry
      return dx * dx + dy * dy <= radius * radius
    }
    return true
  }

  const inT = (x, y) => {
    // vertical stem
    if (x >= stemX && x <= stemX + stemW && y >= stemTop && y <= stemBot) return true
    // crossbar
    if (x >= crossX0 && x <= crossX1 && y >= crossY && y <= crossY + crossH) return true
    // foot curl
    if (
      y >= footY - crossH &&
      y <= footY &&
      x >= stemX + stemW * 0.4 &&
      x <= footX1
    )
      return true
    return false
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const inside = inRoundRect(x + 0.5, y + 0.5)
      if (inside) {
        if (inT(x + 0.5, y + 0.5)) {
          buf[i] = WHITE[0]
          buf[i + 1] = WHITE[1]
          buf[i + 2] = WHITE[2]
          buf[i + 3] = 255
        } else {
          const t = (y - y0) / sq
          buf[i] = lerp(BRAND[0], DEEP[0], t)
          buf[i + 1] = lerp(BRAND[1], DEEP[1], t)
          buf[i + 2] = lerp(BRAND[2], DEEP[2], t)
          buf[i + 3] = 255
        }
      } else if (opaque) {
        buf[i] = BRAND[0]
        buf[i + 1] = BRAND[1]
        buf[i + 2] = BRAND[2]
        buf[i + 3] = 255
      } else {
        buf[i + 3] = 0
      }
    }
  }
  return buf
}

function write(name, size, opts) {
  const png = encodePng(size, size, draw(size, opts))
  writeFileSync(join(PUBLIC, name), png)
  console.log(`wrote public/${name} (${png.length} bytes)`)
}

write('pwa-192x192.png', 192, {})
write('pwa-512x512.png', 512, {})
write('maskable-512x512.png', 512, { maskable: true, opaque: true })
write('apple-touch-icon.png', 180, { opaque: true })

// Simple SVG favicon (crisp at any size).
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="#2E86E6"/>
  <path d="M28 16h6v6h6v6h-6v14c0 2 1 3 3 3h3v6h-5c-5 0-7-3-7-8V28h-5v-6h5z" fill="#fff"/>
</svg>
`
writeFileSync(join(PUBLIC, 'favicon.svg'), favicon)
console.log('wrote public/favicon.svg')
