import { test, expect } from '@playwright/test'
import { loginViaUI, makeUser, signupViaUI } from './helpers'

test.describe('Auth', () => {
  test('signup with availability check, strength meter, color pick → logged in', async ({ page }) => {
    const user = makeUser('e2esign')
    await page.goto('/signup')

    await page.getByLabel('닉네임').fill(user.nickname)

    // Username availability check.
    await page.getByLabel('아이디').fill(user.username)
    await expect(page.getByText('사용 가능한 아이디예요')).toBeVisible({ timeout: 10000 })

    await page.getByLabel('이메일').fill(user.email)

    // Password strength meter appears and reflects strength.
    await page.getByLabel('비밀번호', { exact: true }).fill(user.password)
    const labelRow = page.locator('label', { hasText: '비밀번호' }).locator('..')
    await expect(labelRow).toContainText(/약함|보통|강함/)

    // Show/hide toggle flips the input type.
    const pwInput = page.getByLabel('비밀번호', { exact: true })
    await expect(pwInput).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: '비밀번호 보기' }).click()
    await expect(pwInput).toHaveAttribute('type', 'text')

    // Pick a profile color (the 4 swatches form a radiogroup of their own).
    await page.getByRole('radio').last().click()

    await page.getByRole('button', { name: '회원가입' }).click()
    await expect(page.getByRole('navigation', { name: '주요' })).toBeVisible({ timeout: 15000 })
  })

  test('logout then login again works', async ({ page }) => {
    const user = await signupViaUI(page)

    // Logout from profile.
    await page.goto('/profile')
    await page.getByRole('button', { name: '로그아웃' }).click()
    await expect(page).toHaveURL(/\/login$/, { timeout: 15000 })
    await expect(page.getByText('다시 오신 걸 환영해요')).toBeVisible()

    // Log back in (loginViaUI asserts the protected app is reached).
    await loginViaUI(page, user)
    await expect(page).not.toHaveURL(/\/login$/)
  })

  test('protected route redirects to /login when logged out', async ({ page }) => {
    await page.goto('/groups')
    await expect(page).toHaveURL(/\/login$/, { timeout: 10000 })
  })

  test('invalid login shows an error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('이메일').fill('nobody_definitely_not_real@todly.app')
    await page.getByLabel('비밀번호', { exact: true }).fill('wrongpassword123')
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page.getByText('이메일 또는 비밀번호가 올바르지 않습니다')).toBeVisible({
      timeout: 10000,
    })
  })

  test('login validation surfaces error for empty fields', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: '로그인' }).click()
    await expect(page.getByText('이메일을 입력해 주세요')).toBeVisible()
  })
})
