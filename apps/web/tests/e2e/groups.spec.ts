import { test, expect } from '@playwright/test'
import { signupViaUI } from './helpers'

test.describe('Groups (SCR-04/17)', () => {
  test('first-group empty state → create group → detail', async ({ page }) => {
    await signupViaUI(page)
    await page.goto('/groups')

    // First-group onboarding empty state.
    await expect(page.getByText('첫 그룹을 만들어 함께 시작해보세요')).toBeVisible()
    await page.getByRole('button', { name: '그룹 만들기' }).first().click()
    await expect(page).toHaveURL(/\/groups\/new/)

    // Fill the create form: name + type chip + color.
    const name = `여행준비${Math.floor(Math.random() * 1e4)}`
    await page.getByLabel('그룹 이름').fill(name)
    await page.getByRole('radio', { name: '여행' }).click()
    await expect(page.getByRole('radio', { name: '여행' })).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('button', { name: '그룹 만들기' }).click()

    // Lands on the group detail header.
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/멤버 \d+명/)).toBeVisible()
    await expect(page.getByText('전체 진행률')).toBeVisible()
  })

  test('group detail: generate + copy invite link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await signupViaUI(page)

    const name = `이사준비${Math.floor(Math.random() * 1e4)}`
    await page.goto('/groups/new')
    await page.getByLabel('그룹 이름').fill(name)
    await page.getByRole('button', { name: '그룹 만들기' }).click()
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible({ timeout: 15000 })

    // A group may need an invite link generated first.
    const generate = page.getByRole('button', { name: '초대 링크 만들기' })
    if (await generate.isVisible().catch(() => false)) {
      await generate.click()
      await expect(page.getByText('초대 링크를 만들었어요')).toBeVisible({ timeout: 10000 })
    }

    await expect(page.getByText('초대 링크')).toBeVisible()
    await page.getByRole('button', { name: '복사' }).click()
    await expect(page.getByText('링크를 복사했어요')).toBeVisible({ timeout: 10000 })
  })
})
