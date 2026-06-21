import { test, expect } from '@playwright/test'

/**
 * Smoke test: the login screen renders its wordmark and primary action.
 * Run with: npx playwright install (once) then `npm run test:e2e`.
 */
test('login screen renders the wordmark and 로그인 button', async ({ page }) => {
  await page.goto('/login')

  // The "todly" Sora wordmark appears (header + body usages).
  await expect(page.getByText('todly').first()).toBeVisible()

  // The primary submit button.
  await expect(page.getByRole('button', { name: '로그인' })).toBeVisible()

  // Welcome copy is present.
  await expect(page.getByText('다시 오신 걸 환영해요')).toBeVisible()
})

test('login validation surfaces an error for empty fields', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page.getByText('이메일을 입력해 주세요')).toBeVisible()
})
