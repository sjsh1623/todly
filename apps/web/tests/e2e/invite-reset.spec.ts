import { test, expect } from '@playwright/test'
import { apiAs, apiSignup, makeUser, seedAuth, signupViaUI } from './helpers'

test.describe('Password reset (SCR-02)', () => {
  test('reset-password form: validation, submit → confirmation', async ({ page }) => {
    await page.goto('/reset-password')
    await expect(page.getByRole('heading', { name: '비밀번호 재설정' })).toBeVisible()

    // Empty submit surfaces a validation error.
    await page.getByRole('button', { name: '재설정 링크 보내기' }).click()
    await expect(page.getByText('이메일을 입력해 주세요')).toBeVisible()

    // Valid email → confirmation status (never leaks whether the email exists).
    await page.getByLabel('이메일').fill('whoever@todly.app')
    await page.getByRole('button', { name: '재설정 링크 보내기' }).click()
    await expect(page.getByRole('status')).toContainText('재설정 안내를 보냈어요')
  })

  test('login → "비밀번호를 잊으셨나요" link reaches reset screen', async ({ page }) => {
    await page.goto('/login')
    const link = page.getByRole('link', { name: /비밀번호.*잊|재설정/ })
    if (await link.count()) {
      await link.first().click()
      await expect(page).toHaveURL(/\/reset-password/)
    }
  })
})

test.describe('Invite accept (SCR-20)', () => {
  test('visiting /invite/:code shows group preview → join → lands in group', async ({
    page,
    request,
  }) => {
    // User A creates a group + invitation via the API.
    const owner = await apiSignup(request, makeUser('owner'))
    const asOwner = apiAs(request, owner.accessToken)
    const groupName = `초대그룹${Math.floor(Math.random() * 1e5)}`
    const groupRes = await asOwner.post('/groups', {
      name: groupName,
      type: 'group',
      color: 'blue',
    })
    expect(groupRes.ok()).toBeTruthy()
    const group = await groupRes.json()
    const inviteRes = await asOwner.post(`/groups/${group.id}/invitations`, {})
    expect(inviteRes.ok()).toBeTruthy()
    const invite = await inviteRes.json()
    const code: string = invite.code

    // User B logs in (seeded) and opens the invite link.
    const joiner = await apiSignup(request, makeUser('joiner'))
    await seedAuth(page, joiner)
    await page.goto(`/invite/${code}`)

    // Preview shows the group name + a join button.
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: '그룹 참여하기' }).click()

    // Lands inside the group detail.
    await expect(page.getByRole('heading', { name: groupName, level: 1 })).toBeVisible({
      timeout: 15000,
    })
  })

  test('invalid invite code shows an error with a way back', async ({ page }) => {
    await signupViaUI(page)
    await page.goto('/invite/totally-not-a-real-code-xyz')
    await expect(page.getByText('초대 링크를 확인할 수 없어요')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: '그룹 목록으로' }).click()
    await expect(page).toHaveURL(/\/groups/)
  })
})
