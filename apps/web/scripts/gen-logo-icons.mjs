/**
 * Renders the real todly brand icon from the approved design
 * (Todly Logo.dc.html): white background + blue "todly" wordmark in Sora 800.
 *
 * Uses the Playwright Chromium that ships with the repo's test deps so the
 * wordmark is rendered with the actual Sora web font, then writes the native
 * icon sources (assets/) + PWA icons (public/). Run @capacitor/assets after to
 * expand assets/ into the iOS AppIcon + Android mipmap sets.
 *
 *   node scripts/gen-logo-icons.mjs
 *   npx @capacitor/assets generate --ios --android
 */
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PUBLIC = join(__dirname, '..', 'public')
const ASSETS = join(__dirname, '..', 'assets')

const BLUE = '#2563EB' // primary wordmark color from the design swatches
const WHITE = '#FFFFFF'

/**
 * One icon as an HTML page sized to `size`.
 * - `bg`: tile background (white, or 'transparent' for the adaptive foreground)
 * - `scale`: wordmark width as a fraction of the tile (smaller = more padding,
 *   used for the maskable / adaptive-foreground safe zone)
 */
function html({ size, bg, scale }) {
  const wordmarkWidth = Math.round(size * scale)
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@800&display=block" rel="stylesheet">
<style>
  html,body{margin:0;padding:0}
  .tile{width:${size}px;height:${size}px;background:${bg};
    display:flex;align-items:center;justify-content:center;overflow:hidden}
  .mark{font-family:'Sora',sans-serif;font-weight:800;color:${BLUE};
    line-height:1;letter-spacing:-0.03em;white-space:nowrap;
    /* size the wordmark to a target width, independent of font metrics */
    font-size:100px;transform-origin:center;}
</style></head>
<body>
  <div class="tile"><div class="mark" id="m">todly</div></div>
  <script>
    window.__fit = async (targetW) => {
      await document.fonts.ready
      const m = document.getElementById('m')
      const w = m.getBoundingClientRect().width
      m.style.transform = 'scale(' + (targetW / w) + ')'
      // settle
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    }
  </script>
</body></html>`
}

async function render(page, { size, bg, scale, out }) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(html({ size, bg, scale }), { waitUntil: 'networkidle' })
  await page.evaluate((w) => window.__fit(w), Math.round(size * scale))
  await page.screenshot({ path: out, omitBackground: bg === 'transparent' })
  console.log('wrote', out)
}

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })

// Native sources (consumed by @capacitor/assets)
await render(page, { size: 1024, bg: WHITE, scale: 0.70, out: join(ASSETS, 'icon-only.png') })
await render(page, { size: 1024, bg: 'transparent', scale: 0.56, out: join(ASSETS, 'icon-foreground.png') })
await render(page, { size: 1024, bg: WHITE, scale: 0.0001, out: join(ASSETS, 'icon-background.png') }) // plain white

// PWA / web icons
await render(page, { size: 512, bg: WHITE, scale: 0.70, out: join(PUBLIC, 'pwa-512x512.png') })
await render(page, { size: 192, bg: WHITE, scale: 0.70, out: join(PUBLIC, 'pwa-192x192.png') })
await render(page, { size: 512, bg: WHITE, scale: 0.56, out: join(PUBLIC, 'maskable-512x512.png') })
await render(page, { size: 180, bg: WHITE, scale: 0.70, out: join(PUBLIC, 'apple-touch-icon.png') })

await browser.close()
console.log('done')
