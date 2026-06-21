// Full real-data inspection of the deployed todly app (mohe.today/todly).
// Drives a fresh real account through every screen, captures a screenshot of
// each, and records console errors + failed (>=400) API responses so we can
// flag missing screens / broken features / awkward states.
//
//   node scripts/inspect.mjs
//
// Output: ./inspection-output/*.png  +  ./inspection-output/report.json
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.INSPECT_BASE ?? 'https://mohe.today/todly'
const OUT = new URL('../inspection-output/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const stamp = Date.now().toString(36)
const user = {
  nickname: `qa${stamp.slice(-4)}`,
  username: `qa_${stamp}`.slice(0, 20),
  email: `qa_${stamp}@todly.local`,
  password: 'password123',
}

const findings = [] // { screen, level, kind, detail }
const screens = [] // { name, url, ok, note }
function note(screen, level, kind, detail) {
  findings.push({ screen, level, kind, detail })
  console.log(`[${level}] ${screen} — ${kind}: ${detail}`)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 2,
  serviceWorkers: 'block', // observe every network call; no SW cache interference
})
const page = await ctx.newPage()

let current = 'boot'
const apiFailures = []
page.on('console', (m) => {
  if (m.type() === 'error') note(current, 'ERROR', 'console', m.text().slice(0, 300))
})
page.on('pageerror', (e) => note(current, 'ERROR', 'pageerror', String(e).slice(0, 300)))
page.on('response', async (r) => {
  const u = r.url()
  if (!u.includes('/todly/api/') && !u.includes('/todly/ws')) return
  if (r.status() >= 400) {
    apiFailures.push({ screen: current, status: r.status(), method: r.request().method(), url: u })
    note(current, r.status() >= 500 ? 'ERROR' : 'WARN', 'api', `${r.request().method()} ${r.status()} ${u.replace(BASE, '')}`)
  }
})

async function shot(name) {
  await page.waitForTimeout(700)
  const file = `${OUT}${String(screens.length + 1).padStart(2, '0')}-${name}.png`
  await page.screenshot({ path: file, fullPage: true })
  screens.push({ name, url: page.url().replace(BASE, ''), file })
  console.log(`  📸 ${name} (${page.url().replace(BASE, '')})`)
}

async function go(path) {
  current = path
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) =>
    note(path, 'ERROR', 'nav', String(e).slice(0, 150)),
  )
}

try {
  // ---------- Public screens ----------
  await go('/login'); current = 'login'; await shot('login')
  await go('/reset-password'); current = 'reset-password'; await shot('reset-password')
  await go('/signup'); current = 'signup'; await shot('signup')

  // ---------- Sign up a fresh real user ----------
  current = 'signup-submit'
  await page.getByLabel('닉네임').fill(user.nickname)
  await page.getByLabel('아이디').fill(user.username)
  await page.getByLabel('이메일').fill(user.email)
  await page.getByLabel('비밀번호', { exact: true }).fill(user.password)
  await page.waitForTimeout(800) // username availability check
  await page.getByRole('button', { name: '회원가입' }).click()
  await page.getByRole('navigation', { name: '주요' }).waitFor({ timeout: 20000 }).catch(() =>
    note('signup', 'ERROR', 'flow', '회원가입 후 메인 내비게이션이 보이지 않음'),
  )
  current = 'home'; await shot('home-empty')

  // ---------- Main tabs ----------
  await go('/groups'); current = 'groups'; await shot('groups-empty')
  await go('/activity'); current = 'activity'; await shot('activity-empty')
  await go('/routine'); current = 'routine'; await shot('routine-empty')
  await go('/profile'); current = 'profile'; await shot('profile')
  await go('/consistency'); current = 'consistency'; await shot('consistency')
  await go('/friends'); current = 'friends'; await shot('friends')

  // ---------- Settings ----------
  await go('/settings'); current = 'settings'; await shot('settings')
  await go('/settings/account'); current = 'settings-account'; await shot('settings-account')
  await go('/settings/notifications'); current = 'settings-notifications'; await shot('settings-notifications')
  await go('/settings/help'); current = 'settings-help'; await shot('settings-help')

  // ---------- Create real group ----------
  current = 'group-create'
  await go('/groups/new')
  const groupName = `점검그룹${stamp.slice(-3)}`
  const nameField = page.getByLabel('그룹 이름')
  if (await nameField.isVisible().catch(() => false)) {
    await shot('group-create')
    await nameField.fill(groupName)
    await page.getByRole('button', { name: '그룹 만들기' }).click()
    await page.getByRole('heading', { name: groupName, level: 1 }).waitFor({ timeout: 15000 }).catch(() =>
      note('group-create', 'ERROR', 'flow', '그룹 생성 후 상세 화면이 보이지 않음'),
    )
    current = 'group-detail'; await shot('group-detail')
    const groupUrl = page.url()

    // Invite screen
    const gid = (groupUrl.match(/groups\/([^/]+)/) || [])[1]
    if (gid) {
      await go(`/groups/${gid}/invite`); current = 'group-invite'; await shot('group-invite')
      await page.goto(groupUrl, { waitUntil: 'networkidle' })
    }

    // ---------- Create real task in group ----------
    current = 'task-create'
    const fab = page.getByRole('button', { name: '투두 추가', exact: true })
    if (await fab.isVisible().catch(() => false)) {
      await fab.click()
      await page.waitForURL(/\/tasks\/new/, { timeout: 15000 }).catch(() => {})
      await shot('task-create')
      await page.getByPlaceholder('무엇을 할까요?').fill('점검용 투두')
      const radio = page.getByRole('radio', { name: groupName })
      if (await radio.isVisible().catch(() => false)) await radio.click()
      await page.getByRole('button', { name: '투두 추가하기' }).click()
      await page.getByText('점검용 투두', { exact: true }).waitFor({ timeout: 15000 }).catch(() =>
        note('task-create', 'ERROR', 'flow', '투두 생성 후 목록에 보이지 않음'),
      )
      current = 'group-detail-with-task'; await shot('group-detail-with-task')

      // Open task detail
      await page.getByText('점검용 투두', { exact: true }).first().click().catch(() => {})
      await page.waitForURL(/\/tasks\/[^/]+$/, { timeout: 10000 }).catch(() => {})
      current = 'task-detail'; await shot('task-detail')
      const taskId = (page.url().match(/tasks\/([^/]+)$/) || [])[1]

      // Live moment for this task
      if (taskId) {
        await go(`/live/${taskId}`); current = 'live-moment'; await shot('live-moment')
      }
    } else {
      note('task-create', 'WARN', 'flow', '그룹 상세에서 "투두 추가" FAB를 찾지 못함')
    }
  } else {
    note('group-create', 'ERROR', 'flow', '그룹 생성 폼(그룹 이름)이 보이지 않음')
    await shot('group-create-missing')
  }

  // ---------- Home with data ----------
  await go('/'); current = 'home'; await shot('home-with-data')
  await go('/activity'); current = 'activity'; await shot('activity-with-data')
} catch (e) {
  note(current, 'ERROR', 'fatal', String(e).slice(0, 400))
} finally {
  const report = {
    base: BASE,
    user: { username: user.username, email: user.email },
    capturedScreens: screens.length,
    screens,
    apiFailures,
    findings,
    summary: {
      errors: findings.filter((f) => f.level === 'ERROR').length,
      warnings: findings.filter((f) => f.level === 'WARN').length,
    },
  }
  writeFileSync(`${OUT}report.json`, JSON.stringify(report, null, 2))
  console.log(`\n=== DONE: ${screens.length} screens, ${report.summary.errors} errors, ${report.summary.warnings} warnings ===`)
  console.log(`report: ${OUT}report.json`)
  await browser.close()
}
