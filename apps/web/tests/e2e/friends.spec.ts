import { test, expect } from '@playwright/test'
import { apiAs, apiSignup, makeUser, signupViaUI } from './helpers'

test.describe('Friends (SCR-18/19)', () => {
  test('search by @username → send request → 2nd user accepts → friend appears', async ({
    page,
    request,
  }) => {
    // Seed a 2nd user via REST to be searched + to accept the request.
    const other = await apiSignup(request, makeUser('e2efr'))

    // 1st user signs up via UI.
    await signupViaUI(page)
    await page.goto('/friends')
    await expect(page.getByRole('heading', { name: '친구' })).toBeVisible()

    // Search the 2nd user by username and send a request.
    await page.getByLabel('친구 검색').fill(other.username)
    await expect(page.getByText(other.nickname).first()).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: '추가' }).first().click()
    // The action flips to "요청됨".
    await expect(page.getByRole('button', { name: '요청됨' }).first()).toBeVisible({
      timeout: 10000,
    })

    // 2nd user accepts the request via REST.
    const otherApi = apiAs(request, other.accessToken)
    const reqsRes = await otherApi.get('/friends/requests')
    expect(reqsRes.ok()).toBeTruthy()
    const reqs = await reqsRes.json()
    const incoming = reqs.incoming?.[0]
    expect(incoming).toBeTruthy()
    const acceptRes = await otherApi.post(`/friends/requests/${incoming.id}/accept`)
    expect(acceptRes.ok()).toBeTruthy()

    // Reload the friends screen: the friend now shows in "내 친구".
    await page.reload()
    await expect(page.getByText(/내 친구/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(other.nickname).first()).toBeVisible({ timeout: 10000 })
  })

  test('invite friend to a group (multi-select → N명 초대하기)', async ({ page, request }) => {
    // Seed a friend and become friends via REST before driving the UI.
    const me = await apiSignup(request, makeUser('e2eme'))
    const friend = await apiSignup(request, makeUser('e2ebud'))
    const meApi = apiAs(request, me.accessToken)
    const friendApi = apiAs(request, friend.accessToken)

    const sendRes = await meApi.post('/friends/requests', { username: friend.username })
    expect(sendRes.ok()).toBeTruthy()
    const fReqs = await (await friendApi.get('/friends/requests')).json()
    await friendApi.post(`/friends/requests/${fReqs.incoming[0].id}/accept`)

    // Create a group as "me" via REST.
    const groupRes = await meApi.post('/groups', { name: '초대테스트', type: 'group', color: '#1366CE' })
    expect(groupRes.ok()).toBeTruthy()
    const group = await groupRes.json()

    // Log "me" into the UI via the seeded session (UI login).
    await page.goto('/login')
    await page.getByLabel('이메일').fill(me.email)
    await page.getByLabel('비밀번호', { exact: true }).fill(me.password)
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page.getByRole('navigation', { name: '주요' })).toBeVisible({ timeout: 15000 })

    // Go to the group's invite-friends screen.
    await page.goto(`/groups/${group.id}/invite`)
    await expect(page.getByRole('heading', { name: '친구 초대' })).toBeVisible()

    // Select the friend (checkbox row) and invite.
    await page.getByRole('checkbox', { name: new RegExp(friend.nickname) }).first().click()
    await expect(page.getByText('1명 선택됨')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: '1명 초대하기' }).click()

    // Returns to the group detail with a success toast.
    await expect(page).toHaveURL(new RegExp(`/groups/${group.id}$`), { timeout: 15000 })
  })
})
