// Targeted DOM-level probes (no screenshots): dark mode application, 404
// handling for unknown routes, login error message, invalid invite preview.
import { chromium, request as pwRequest } from '@playwright/test'

const BASE = 'https://mohe.today/todly'
const API = BASE + '/api/v1/'
const stamp = Date.now().toString(36)
const api = await pwRequest.newContext()
const u = { nickname: `pb${stamp.slice(-3)}`, username: `pb_${stamp}`.slice(0, 20), email: `pb_${stamp}@todly.local`, password: 'password123', profileColor: 'blue' }
const A = await (await api.post(API + 'auth/signup', { data: u })).json()

const browser = await chromium.launch()

// ---- 1) Dark mode application ----
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, serviceWorkers: 'block' })
  await ctx.addInitScript(([rt, user]) => {
    if (!localStorage.getItem('todly-auth')) localStorage.setItem('todly-auth', JSON.stringify({ state: { refreshToken: rt, user }, version: 0 }))
  }, [A.refreshToken, { id: A.user.id, username: A.user.username, nickname: A.user.nickname, email: A.user.email, profileColor: A.user.profileColor, theme: 'ocean', darkMode: false, language: 'ko', avatarUrl: null }])
  const p = await ctx.newPage()
  await p.goto(`${BASE}/settings`, { waitUntil: 'networkidle' })
  const before = await p.evaluate(() => ({
    htmlClass: document.documentElement.className,
    htmlDataTheme: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
  }))
  await p.getByRole('switch', { name: '다크 모드' }).click()
  await p.waitForTimeout(600)
  const after = await p.evaluate(() => ({
    htmlClass: document.documentElement.className,
    htmlDataTheme: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
  }))
  console.log('DARK MODE:')
  console.log('  before:', JSON.stringify(before))
  console.log('  after :', JSON.stringify(after))
  console.log('  changed:', before.bg !== after.bg ? 'YES (bg changed)' : 'NO — dark mode had no visual effect')
  await ctx.close()
}

// ---- 2) Unknown route (404) ----
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, serviceWorkers: 'block' })
  await ctx.addInitScript(([rt, user]) => {
    if (!localStorage.getItem('todly-auth')) localStorage.setItem('todly-auth', JSON.stringify({ state: { refreshToken: rt, user }, version: 0 }))
  }, [A.refreshToken, { id: A.user.id, username: A.user.username, nickname: A.user.nickname, email: A.user.email, profileColor: A.user.profileColor, theme: 'ocean', darkMode: false, language: 'ko', avatarUrl: null }])
  const p = await ctx.newPage()
  await p.goto(`${BASE}/this-route-does-not-exist-xyz`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  const info = await p.evaluate(() => ({
    url: location.pathname,
    bodyText: (document.body.innerText || '').trim().slice(0, 200),
    rootChildCount: document.getElementById('root')?.childElementCount ?? -1,
  }))
  console.log('\nUNKNOWN ROUTE (/this-route-does-not-exist-xyz):')
  console.log('  url:', info.url)
  console.log('  rootChildCount:', info.rootChildCount)
  console.log('  visibleText:', JSON.stringify(info.bodyText) || '(empty)')
  console.log('  verdict:', info.bodyText.length < 2 ? '⚠️ BLANK PAGE — no 404/catch-all route' : 'renders something')
  await ctx.close()
}

// ---- 3) Login with wrong password ----
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, serviceWorkers: 'block' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await p.getByLabel('이메일').fill(u.email)
  await p.getByLabel('비밀번호', { exact: true }).fill('definitely-wrong-pw')
  await p.getByRole('button', { name: '로그인' }).click()
  await p.waitForTimeout(2500)
  const alert = await p.locator('[role="alert"]').allInnerTexts().catch(() => [])
  const stillLogin = await p.getByRole('button', { name: '로그인' }).isVisible().catch(() => false)
  console.log('\nLOGIN WRONG PASSWORD:')
  console.log('  inline alert(s):', JSON.stringify(alert))
  console.log('  stayed on login:', stillLogin)
  console.log('  verdict:', alert.some((t) => t.trim().length > 0) ? '✓ shows inline error' : '⚠️ no inline error message shown')
  await ctx.close()
}

// ---- 4) Invalid invite preview ----
{
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, serviceWorkers: 'block' })
  const p = await ctx.newPage()
  await p.goto(`${BASE}/invite/INVALIDCODE123`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  const txt = await p.evaluate(() => (document.body.innerText || '').trim().slice(0, 200))
  console.log('\nINVALID INVITE (/invite/INVALIDCODE123):')
  console.log('  visibleText:', JSON.stringify(txt))
  await ctx.close()
}

await browser.close()
await api.dispose()
console.log('\nprobe user:', u.username)
