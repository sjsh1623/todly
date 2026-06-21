// Round 2 — deep, multi-user, real-data inspection of mohe.today/todly.
// Sets up a real collaboration scenario via the REST API (two users, group,
// task completion, comment, routine, friend request/accept, group invite/join)
// then drives the UI to verify rendering of the collaborative state, dark mode,
// theme switching, and error/edge screens. Captures console + API errors.
//
//   node scripts/inspect2.mjs
import { chromium, request as pwRequest } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.INSPECT_BASE ?? 'https://mohe.today/todly'
const API = BASE + '/api/v1/'
const OUT = new URL('../inspection-output2/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const stamp = Date.now().toString(36)
const findings = []
const screens = []
let current = 'setup'
function note(level, kind, detail) {
  findings.push({ screen: current, level, kind, detail })
  console.log(`[${level}] ${current} — ${kind}: ${detail}`)
}

function mkUser(p) {
  const id = `${stamp}${p}`.toLowerCase().replace(/[^a-z0-9]/g, '')
  return {
    nickname: `${p}${stamp.slice(-3)}`,
    username: `${p}_${id}`.slice(0, 20),
    email: `${p}_${id}@todly.local`,
    password: 'password123',
    profileColor: p === 'a' ? 'blue' : 'purple',
  }
}

const api = await pwRequest.newContext()
async function call(method, path, token, data) {
  const opts = { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  if (data) opts.data = data
  const r = await api[method](API + path, opts)
  if (!r.ok()) {
    const body = await r.text().catch(() => '')
    note('ERROR', 'api-setup', `${method.toUpperCase()} ${path} → ${r.status()} ${body.slice(0, 160)}`)
    return null
  }
  return r.json().catch(() => ({}))
}

// ---------------- API setup: real collaboration scenario ----------------
const ua = mkUser('a')
const ub = mkUser('b')
const A = await call('post', 'auth/signup', null, ua)
const B = await call('post', 'auth/signup', null, ub)
if (!A || !B) { note('ERROR', 'setup', 'signup failed; aborting'); process.exit(0) }

const group = await call('post', 'groups', A.accessToken, {
  name: `같이살기${stamp.slice(-3)}`, type: 'group', color: 'blue', icon: '🏠', description: '룸메이트 공동 생활',
})
const gid = group?.id
const task = await call('post', 'tasks', A.accessToken, {
  groupId: gid, title: '저녁 설거지', priority: 'high',
})
const tid = task?.id
if (tid) {
  await call('post', `tasks/${tid}/complete`, A.accessToken)
  await call('post', `tasks/${tid}/comments`, A.accessToken, { body: '오늘은 제가 했어요 👍' })
}
// second open task so group progress isn't 100%
await call('post', 'tasks', A.accessToken, { groupId: gid, title: '장보기', priority: 'medium' })
const routine = await call('post', 'routines', A.accessToken, {
  groupId: gid, title: '아침 물 한 잔', recurFreq: 'daily',
})
if (routine?.id) await call('post', `routines/${routine.id}/complete`, A.accessToken)

// Friend: B → A, A accepts
await call('post', 'friends/requests', B.accessToken, { username: ua.username })
const reqs = await call('get', 'friends/requests', A.accessToken)
const reqId = reqs?.incoming?.[0]?.id
if (reqId) await call('post', `friends/requests/${reqId}/accept`, A.accessToken)
else note('WARN', 'setup', '친구 요청이 A의 incoming에 없음')

// Group invite: A creates, B accepts
const inv = await call('post', `groups/${gid}/invitations`, A.accessToken, { expiresInHours: 24 })
const code = inv?.code
if (code) {
  const acc = await call('post', `invitations/${code}/accept`, B.accessToken)
  if (!acc) note('WARN', 'setup', '초대 수락 실패')
} else note('WARN', 'setup', '초대 코드 생성 실패')

console.log(`setup done: group=${gid} task=${tid} invite=${code}`)

// ---------------- UI verification ----------------
const browser = await chromium.launch()
async function newUserPage(seed) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, serviceWorkers: 'block' })
  await ctx.addInitScript(([rt, user]) => {
    // Seed only once. The app rotates the refresh token on bootstrap and
    // persists the new one; re-seeding on every navigation would clobber it
    // with the now-consumed original and force a logout on the next reload.
    if (!localStorage.getItem('todly-auth')) {
      localStorage.setItem('todly-auth', JSON.stringify({ state: { refreshToken: rt, user }, version: 0 }))
    }
  }, [seed.refreshToken, {
    id: seed.user.id, username: seed.user.username, nickname: seed.user.nickname,
    email: seed.user.email, profileColor: seed.user.profileColor,
    theme: 'ocean', darkMode: false, language: 'ko', avatarUrl: null,
  }])
  const page = await ctx.newPage()
  page.on('console', (m) => { if (m.type() === 'error') note('ERROR', 'console', m.text().slice(0, 220)) })
  page.on('pageerror', (e) => note('ERROR', 'pageerror', String(e).slice(0, 220)))
  page.on('response', (r) => {
    const u = r.url()
    if ((u.includes('/todly/api/') || u.includes('/todly/ws')) && r.status() >= 400) {
      note(r.status() >= 500 ? 'ERROR' : 'WARN', 'api', `${r.request().method()} ${r.status()} ${u.replace(BASE, '')}`)
    }
  })
  return page
}
async function shot(page, name) {
  await page.waitForTimeout(800)
  const file = `${OUT}${String(screens.length + 1).padStart(2, '0')}-${name}.png`
  await page.screenshot({ path: file, fullPage: true })
  screens.push({ name, url: page.url().replace(BASE, '') })
  console.log(`  📸 ${name}`)
}
async function go(page, path) {
  current = path
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => note('ERROR', 'nav', String(e).slice(0, 120)))
}

try {
  const pageA = await newUserPage(A)

  current = 'A/home'; await go(pageA, '/'); await shot(pageA, 'A-home')
  // Notification center
  current = 'A/notifications'
  const bell = pageA.getByRole('button', { name: /알림/ }).first()
  if (await bell.isVisible().catch(() => false)) { await bell.click(); await shot(pageA, 'A-notifications') }
  else note('WARN', 'ui', '알림 벨 버튼을 찾지 못함')

  current = 'A/activity'; await go(pageA, '/activity'); await shot(pageA, 'A-activity-multi')
  current = 'A/group'; await go(pageA, `/groups/${gid}`); await shot(pageA, 'A-group-detail')
  current = 'A/task'; await go(pageA, `/tasks/${tid}`); await shot(pageA, 'A-task-detail-completed')
  current = 'A/routine'; await go(pageA, '/routine'); await shot(pageA, 'A-routine')
  current = 'A/consistency'; await go(pageA, '/consistency'); await shot(pageA, 'A-consistency')
  current = 'A/friends'; await go(pageA, '/friends'); await shot(pageA, 'A-friends')
  current = 'A/profile'; await go(pageA, '/profile'); await shot(pageA, 'A-profile-stats')

  // Dark mode + theme
  current = 'A/settings'; await go(pageA, '/settings'); await shot(pageA, 'A-settings-light')
  const darkToggle = pageA.getByRole('switch', { name: '다크 모드' })
  if (await darkToggle.isVisible().catch(() => false)) {
    await darkToggle.click(); await pageA.waitForTimeout(500); await shot(pageA, 'A-settings-dark')
    current = 'A/home-dark'; await go(pageA, '/'); await shot(pageA, 'A-home-dark')
    current = 'A/settings'; await go(pageA, '/settings')
    const coral = pageA.getByRole('radio', { name: '코랄' })
    if (await coral.isVisible().catch(() => false)) { await coral.click(); await pageA.waitForTimeout(500); await shot(pageA, 'A-settings-coral-dark') }
    // revert dark for cleanliness of subsequent shots (not strictly needed)
  } else note('WARN', 'ui', '다크 모드 스위치를 찾지 못함')

  // ---- User B perspective ----
  const pageB = await newUserPage(B)
  current = 'B/groups'; await go(pageB, '/groups'); await shot(pageB, 'B-groups-joined')
  current = 'B/friends'; await go(pageB, '/friends'); await shot(pageB, 'B-friends')
  current = 'B/home'; await go(pageB, '/'); await shot(pageB, 'B-home')

  // ---- Error / edge states ----
  const pageE = await newUserPage(A)
  current = 'edge/invalid-invite'; await go(pageE, '/invite/INVALIDCODE123'); await shot(pageE, 'edge-invalid-invite')
  current = 'edge/unknown-route'; await go(pageE, '/this-route-does-not-exist'); await shot(pageE, 'edge-unknown-route')

  // login wrong password (fresh, unauthenticated)
  const ctxL = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, serviceWorkers: 'block' })
  const pageL = await ctxL.newPage()
  pageL.on('console', (m) => { if (m.type() === 'error') note('edge/login-error', 'ERROR', 'console', m.text().slice(0, 200)) })
  current = 'edge/login-error'
  await pageL.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await pageL.getByLabel('이메일').fill(ua.email)
  await pageL.getByLabel('비밀번호', { exact: true }).fill('wrong-password-xyz')
  await pageL.getByRole('button', { name: '로그인' }).click()
  await pageL.waitForTimeout(2500)
  await shot(pageL, 'edge-login-wrong-pw')
} catch (e) {
  note(current, 'ERROR', 'fatal', String(e).slice(0, 400))
} finally {
  writeFileSync(`${OUT}report.json`, JSON.stringify({
    base: BASE, users: { a: ua.username, b: ub.username }, group: gid, invite: code,
    screens, findings,
    summary: { errors: findings.filter((f) => f.level === 'ERROR').length, warnings: findings.filter((f) => f.level === 'WARN').length },
  }, null, 2))
  console.log(`\n=== DONE: ${screens.length} screens, ${findings.filter((f) => f.level === 'ERROR').length} errors, ${findings.filter((f) => f.level === 'WARN').length} warnings ===`)
  await browser.close()
  await api.dispose()
}
