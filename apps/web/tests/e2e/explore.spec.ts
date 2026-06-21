import { test, expect, type Page } from '@playwright/test'
import { apiAs, apiSignup, makeUser, seedAuth, signupViaUI } from './helpers'

/**
 * Exploratory coverage: interactive flows + buttons not exercised by the
 * feature specs, plus a console-error sweep across every route. Catches
 * "the button does nothing / throws" regressions the happy-path specs miss.
 */

test.describe('Group owner/member management', () => {
  test('owner deletes group via 더보기 menu → returns to /groups', async ({ page }) => {
    await signupViaUI(page)
    const name = `삭제그룹${Math.floor(Math.random() * 1e5)}`
    await page.goto('/groups/new')
    await page.getByLabel('그룹 이름').fill(name)
    await page.getByRole('button', { name: '그룹 만들기' }).click()
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible({ timeout: 15000 })

    // Auto-accept the window.confirm.
    page.on('dialog', (d) => d.accept())
    await page.getByRole('button', { name: '더보기' }).click()
    await page.getByRole('menuitem', { name: '그룹 삭제' }).click()

    await expect(page).toHaveURL(/\/groups$/, { timeout: 15000 })
    await expect(page.getByText(name)).toHaveCount(0)
  })

  test('member leaves group via 더보기 menu → returns to /groups', async ({ page, request }) => {
    // Owner creates a group + invite via API.
    const owner = await apiSignup(request, makeUser('lvowner'))
    const asOwner = apiAs(request, owner.accessToken)
    const name = `나갈그룹${Math.floor(Math.random() * 1e5)}`
    const group = await (
      await asOwner.post('/groups', { name, type: 'group', color: '#1366CE' })
    ).json()
    const invite = await (await asOwner.post(`/groups/${group.id}/invitations`, {})).json()

    // Member joins via API, then drives the UI to leave.
    const member = await apiSignup(request, makeUser('lvmember'))
    const asMember = apiAs(request, member.accessToken)
    const acc = await asMember.post(`/invitations/${invite.code}/accept`)
    expect(acc.ok()).toBeTruthy()

    await seedAuth(page, member)
    await page.goto(`/groups/${group.id}`)
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible({ timeout: 15000 })

    page.on('dialog', (d) => d.accept())
    await page.getByRole('button', { name: '더보기' }).click()
    await page.getByRole('menuitem', { name: '그룹 나가기' }).click()
    await expect(page).toHaveURL(/\/groups$/, { timeout: 15000 })
  })
})

test.describe('Friends: accept / decline incoming via UI', () => {
  test('incoming request → 수락 turns it into a friend', async ({ page, request }) => {
    // A 2nd user sends ME a request via API; I accept it in the UI.
    const me = makeUser('frme')
    const meSeed = await apiSignup(request, me)
    const sender = await apiSignup(request, makeUser('frsend'))
    const asSender = apiAs(request, sender.accessToken)
    const sent = await asSender.post('/friends/requests', { username: me.username })
    expect(sent.ok()).toBeTruthy()

    await seedAuth(page, meSeed)
    await page.goto('/friends')
    await expect(page.getByText(sender.nickname).first()).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: '수락' }).first().click()
    // Sender now appears under my friends list.
    await expect(page.getByText(/내 친구/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(sender.nickname).first()).toBeVisible()
  })

  test('incoming request → 거절 removes it', async ({ page, request }) => {
    const me = makeUser('dcme')
    const meSeed = await apiSignup(request, me)
    const sender = await apiSignup(request, makeUser('dcsend'))
    const asSender = apiAs(request, sender.accessToken)
    await asSender.post('/friends/requests', { username: me.username })

    await seedAuth(page, meSeed)
    await page.goto('/friends')
    const decline = page.getByRole('button', { name: new RegExp(`${sender.nickname} 요청 거절`) })
    await expect(decline).toBeVisible({ timeout: 15000 })
    await decline.click()
    await expect(decline).toHaveCount(0, { timeout: 10000 })
  })
})

/**
 * Navigate every route as a logged-in user and assert no uncaught page errors
 * or React error-boundary crashes. Resource 404s/aborts are ignored.
 */
test('no console/page errors across all routes', async ({ page, request }) => {
  const seed = await apiSignup(request, makeUser('sweep'))
  // Give the user one group so detail-ish routes have data to render.
  const asUser = apiAs(request, seed.accessToken)
  const group = await (
    await asUser.post('/groups', { name: '스윕그룹', type: 'group', color: '#1366CE' })
  ).json()

  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const t = msg.text()
      // Ignore network-layer noise (failed fetch, aborted, 4xx/5xx logging).
      if (/Failed to load resource|net::ERR|status of 4|status of 5|WebSocket/i.test(t)) return
      consoleErrors.push(t)
    }
  })

  await seedAuth(page, seed)

  const routes = [
    '/',
    '/groups',
    '/activity',
    '/routine',
    '/profile',
    '/consistency',
    '/friends',
    `/groups/${group.id}`,
    '/tasks/new',
    '/settings',
    '/settings/account',
    '/settings/notifications',
    '/settings/help',
  ]

  for (const route of routes) {
    await navigateAndSettle(page, route)
    // The app shell or a page heading should be present (i.e. not a blank crash).
    await expect(page.locator('body')).not.toBeEmpty()
  }

  expect(pageErrors, `page errors:\n${pageErrors.join('\n')}`).toEqual([])
  expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([])
})

async function navigateAndSettle(page: Page, route: string) {
  await page.goto(route)
  // Let lazy data/queries settle so late-rendering errors surface.
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(250)
}
