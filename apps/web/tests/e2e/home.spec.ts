import { test, expect } from '@playwright/test'
import { signupViaUI } from './helpers'

test.describe('Home (SCR-03)', () => {
  test('greeting + empty state render; FAB navigates to task create', async ({ page }) => {
    await signupViaUI(page)
    await page.goto('/')

    // "Now active" section shows the resting empty state for a fresh user.
    await expect(page.getByText('지금 활동 중')).toBeVisible()
    await expect(page.getByText('지금은 모두 쉬는 중이에요')).toBeVisible()

    // Group-progress empty state.
    await expect(page.getByText('아직 함께하는 투두가 없어요')).toBeVisible()

    // FAB → task create.
    await page.getByRole('button', { name: '투두 추가', exact: true }).click()
    await expect(page).toHaveURL(/\/tasks\/new/)
    await expect(page.getByPlaceholder('무엇을 할까요?')).toBeVisible()
  })

  test('empty-state "그룹 만들기" navigates to group create', async ({ page }) => {
    await signupViaUI(page)
    await page.goto('/')
    await page.getByRole('button', { name: '+ 그룹 만들기' }).click()
    await expect(page).toHaveURL(/\/groups\/new/)
  })
})
