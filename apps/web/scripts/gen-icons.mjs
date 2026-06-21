/**
 * Generates todly icons as valid PNGs without any image library.
 *
 * Renders a #2E86E6 rounded square with a white lowercase "t" wordmark into a
 * raw RGBA buffer, then encodes it as a PNG (zlib deflate of the scanlines).
 *
 * Produces the PWA icons (public/) AND the native source assets (assets/) that
 * `@capacitor/assets generate` expands into iOS AppIcon/Splash sets + Android
 * mipmaps/adaptive icons/splashes.
 *
 *   public/pwa-192x192.png        (any)
 *   public/pwa-512x512.png        (any)
 *   public/maskable-512x512.png   (maskable — mark inset to the safe zone)
 *   public/apple-touch-icon.png   (180, opaque)
 *   public/favicon.svg
 *   assets/icon-only.png          (1024, opaque — iOS/Android icon source)
 *   assets/icon-foreground.png    (1024, white "t" in the adaptive safe zone)
 *   assets/icon-background.png    (1024, solid brand — adaptive background)
 *   assets/splash.png             (2732, brand bg + centered mark)
 *   assets/splash-dark.png        (2732, deep bg + centered mark)
 *
 * Run: node scripts/gen-icons.mjs   (then: npx @capacitor/assets generate)
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '..', 'public')
const ASSETS = join(__dirname, '..', 'assets')
mkdirSync(PUBLIC, { recursive: true })
mkdirSync(ASSETS, { recursive: true })

const BRAND = [0x2e, 0x86, 0xe6] // #2E86E6
const DEEP = [0x13, 0x66, 0xce] // #1366CE (subtle vertical gradient bottom)
const NIGHT = [0x10, 0x1a, 0x2c] // dark splash background
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
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

function px(buf, w, x, y, rgb, a = 255) {
  const i = (y * w + x) * 4
  buf[i] = rgb[0]
  buf[i + 1] = rgb[1]
  buf[i + 2] = rgb[2]
  buf[i + 3] = a
}

/**
 * Composites the todly mark into `buf` within a square of side `sq` at (x0,y0).
 * @param opts.square draw the rounded brand square behind the "t"
 */
function paintMark(buf, w, x0, y0, sq, { square = true } = {}) {
  const radius = sq * 0.24
  const stemW = sq * 0.13
  const stemX = x0 + sq * 0.46
  const stemTop = y0 + sq * 0.2
  const stemBot = y0 + sq * 0.78
  const crossY = y0 + sq * 0.38
  const crossH = sq * 0.12
  const crossX0 = x0 + sq * 0.3
  const crossX1 = x0 + sq * 0.66
  const footY = stemBot
  const footX1 = stemX + stemW + sq * 0.12

  const inRoundRect = (x, y) => {
    if (x < x0 || x > x0 + sq || y < y0 || y > y0 + sq) return false
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
    if (x >= stemX && x <= stemX + stemW && y >= stemTop && y <= stemBot) return true
    if (x >= crossX0 && x <= crossX1 && y >= crossY && y <= crossY + crossH) return true
    if (y >= footY - crossH && y <= footY && x >= stemX + stemW * 0.4 && x <= footX1) return true
    return false
  }

  const yStart = Math.max(0, Math.floor(y0))
  const yEnd = Math.min(Math.ceil(y0 + sq), (buf.length / 4 / w) | 0)
  const xStart = Math.max(0, Math.floor(x0))
  const xEnd = Math.min(Math.ceil(x0 + sq), w)
  for (let y = yStart; y < yEnd; y++) {
    for (let x = xStart; x < xEnd; x++) {
      const cx = x + 0.5
      const cy = y + 0.5
      if (inT(cx, cy)) {
        px(buf, w, x, y, WHITE)
      } else if (square && inRoundRect(cx, cy)) {
        const t = (y - y0) / sq
        px(buf, w, x, y, [lerp(BRAND[0], DEEP[0], t), lerp(BRAND[1], DEEP[1], t), lerp(BRAND[2], DEEP[2], t)])
      }
    }
  }
}

/** Fills the whole buffer with a solid color (opaque). */
function fill(buf, rgb) {
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = rgb[0]
    buf[i + 1] = rgb[1]
    buf[i + 2] = rgb[2]
    buf[i + 3] = 255
  }
}

/** The classic app icon: rounded brand square + t, optionally opaque corners. */
function icon(size, { maskable = false, opaque = false } = {}) {
  const buf = Buffer.alloc(size * size * 4)
  if (opaque) fill(buf, BRAND)
  const pad = maskable ? size * 0.14 : size * 0.06
  paintMark(buf, size, pad, pad, size - pad * 2, { square: true })
  return buf
}

/** Adaptive foreground: white "t" only, centered in the inner 60% safe zone. */
function adaptiveForeground(size) {
  const buf = Buffer.alloc(size * size * 4) // transparent
  const sq = size * 0.6
  const off = (size - sq) / 2
  paintMark(buf, size, off, off, sq, { square: false })
  return buf
}

/** Splash: solid background with a centered, modestly sized brand square. */
function splash(size, dark) {
  const buf = Buffer.alloc(size * size * 4)
  fill(buf, dark ? NIGHT : BRAND)
  const sq = size * 0.26
  const off = (size - sq) / 2
  paintMark(buf, size, off, off, sq, { square: true })
  return buf
}

function writePng(dir, name, size, buf) {
  const png = encodePng(size, size, buf)
  writeFileSync(join(dir, name), png)
  console.log(`wrote ${dir === PUBLIC ? 'public' : 'assets'}/${name} (${png.length} bytes)`)
}

// --- PWA icons (public/) ----------------------------------------------------
writePng(PUBLIC, 'pwa-192x192.png', 192, icon(192))
writePng(PUBLIC, 'pwa-512x512.png', 512, icon(512))
writePng(PUBLIC, 'maskable-512x512.png', 512, icon(512, { maskable: true, opaque: true }))
writePng(PUBLIC, 'apple-touch-icon.png', 180, icon(180, { opaque: true }))

// --- Native source assets (assets/) for @capacitor/assets -------------------
writePng(ASSETS, 'icon-only.png', 1024, icon(1024, { opaque: true }))
writePng(ASSETS, 'icon-foreground.png', 1024, adaptiveForeground(1024))
const bg = Buffer.alloc(1024 * 1024 * 4)
fill(bg, BRAND)
writePng(ASSETS, 'icon-background.png', 1024, bg)
writePng(ASSETS, 'splash.png', 2732, splash(2732, false))
writePng(ASSETS, 'splash-dark.png', 2732, splash(2732, true))

// --- Favicon (crisp at any size) --------------------------------------------
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="16" fill="#2E86E6"/>
  <path d="M28 16h6v6h6v6h-6v14c0 2 1 3 3 3h3v6h-5c-5 0-7-3-7-8V28h-5v-6h5z" fill="#fff"/>
</svg>
`
writeFileSync(join(PUBLIC, 'favicon.svg'), favicon)
console.log('wrote public/favicon.svg')
