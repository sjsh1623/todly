import { test, expect } from '@playwright/test'
import { signupViaUI } from './helpers'

test.describe('Profile / Stats (SCR-10/13)', () => {
  test('stats tiles, 16-week heatmap, 최근 활동, consistency link', async ({ page }) => {
    const me = await signupViaUI(page)
    await page.goto('/profile')

    // Header shows the user's nickname.
    await expect(page.getByRole('heading', { name: me.nickname })).toBeVisible({ timeout: 15000 })

    // Stat tiles.
    await expect(page.getByText('완료율')).toBeVisible()
    await expect(page.getByText('연속 일수')).toBeVisible()
    await expect(page.getByText('라이프 점수')).toBeVisible()
    await expect(page.getByText('루틴 점수')).toBeVisible()

    // 16-week heatmap renders (role=img with aria-label).
    await expect(page.getByRole('img', { name: '최근 16주 동안의 활동' })).toBeVisible()

    // 최근 활동 section.
    await expect(page.getByText('최근 활동')).toBeVisible()

    // 꾸준함 자세히 → consistency screen.
    await page.getByRole('button', { name: '꾸준함 자세히' }).click()
    await expect(page).toHaveURL(/\/consistency/)
    await expect(page.getByRole('heading', { name: '꾸준함' })).toBeVisible({ timeout: 10000 })
  })
})
