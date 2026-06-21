// Live-room messaging E2E: verify real-time chat send/receive over STOMP.
// A sends a message in the room UI; assert it renders for A, is delivered to B
// in real time (separate browser subscribed via STOMP), and is persisted (REST).
import { chromium, request as pwRequest } from '@playwright/test'

const BASE = 'https://mohe.today/todly'
const API = BASE + '/api/v1/'
const stamp = Date.now().toString(36)
const api = await pwRequest.newContext()
const mk = (p) => ({ nickname: `${p}${stamp.slice(-3)}`, username: `${p}_${stamp}`.slice(0, 20), email: `${p}_${stamp}@todly.local`, password: 'password123', profileColor: p === 'a' ? 'blue' : 'purple' })
async function call(m, path, tok, data) {
  const o = { headers: tok ? { Authorization: `Bearer ${tok}` } : {} }; if (data) o.data = data
  const r = await api[m](API + path, o); const ok = r.ok(); const body = await r.json().catch(() => ({}))
  if (!ok) console.log(`  ! ${m.toUpperCase()} ${path} -> ${r.status()} ${JSON.stringify(body).slice(0, 120)}`)
  return ok ? body : null
}
const ua = mk('a'), ub = mk('b')
const A = await call('post', 'auth/signup', null, ua)
const B = await call('post', 'auth/signup', null, ub)
const g = await call('post', 'groups', A.accessToken, { name: `방${stamp.slice(-3)}`, type: 'group', color: 'blue' })
// B must be a group member to join the room.
const inv = await call('post', `groups/${g.id}/invitations`, A.accessToken, { expiresInHours: 24 })
if (inv?.code) await call('post', `invitations/${inv.code}/accept`, B.accessToken)
const t = await call('post', 'tasks', A.accessToken, { groupId: g.id, title: '같이 청소', priority: 'medium' })
// Start a live session on the task (room is created around a live task).
await call('post', `tasks/${t.id}/live/start`, A.accessToken)
let room = await call('post', 'live-rooms', A.accessToken, { taskId: t.id })
if (!room) { console.log('room create failed; aborting'); process.exit(0) }
const roomId = room.id ?? room.room?.id
await call('post', `live-rooms/${roomId}/join`, B.accessToken)
console.log('room:', roomId)

const browser = await chromium.launch()
async function seeded(seed) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, serviceWorkers: 'block' })
  await ctx.addInitScript(([rt, user]) => { if (!localStorage.getItem('todly-auth')) localStorage.setItem('todly-auth', JSON.stringify({ state: { refreshToken: rt, user }, version: 0 })) },
    [seed.refreshToken, { id: seed.user.id, username: seed.user.username, nickname: seed.user.nickname, email: seed.user.email, profileColor: seed.user.profileColor, theme: 'ocean', darkMode: false, language: 'ko', avatarUrl: null }])
  const p = await ctx.newPage()
  return p
}
const MSG = '같이 화이팅이에요 ' + stamp.slice(-4)
const pB = await seeded(B)
await pB.goto(`${BASE}/rooms/${roomId}`, { waitUntil: 'networkidle' }).catch(() => {})
await pB.waitForTimeout(3500) // allow STOMP CONNECT + subscribe
const pA = await seeded(A)
await pA.goto(`${BASE}/rooms/${roomId}`, { waitUntil: 'networkidle' }).catch(() => {})
await pA.waitForTimeout(3500)

let sendErr = null
try {
  await pA.locator('#cheer-input').fill(MSG)
  await pA.getByRole('button', { name: '보내기', exact: true }).click()
} catch (e) { sendErr = String(e).slice(0, 150) }
await pA.waitForTimeout(3500)

const aHas = await pA.locator(`text=${MSG}`).count().catch(() => 0)
const bHas = await pB.locator(`text=${MSG}`).count().catch(() => 0)
const detail = await call('get', `live-rooms/${roomId}`, A.accessToken)
const persisted = JSON.stringify(detail?.messages ?? detail ?? {}).includes(MSG)

console.log('\n=== LIVE ROOM MESSAGING ===')
console.log('send error      :', sendErr ?? 'none')
console.log("sender (A) shows:", aHas > 0 ? '✓' : '✗')
console.log('receiver (B) RT :', bHas > 0 ? '✓ delivered in real time (STOMP)' : '✗ not received')
console.log('persisted (REST):', persisted ? '✓' : '✗')

await browser.close(); await api.dispose()
