import { test, expect } from '@playwright/test'
import { makeUser, signupViaUI } from './helpers'

test.describe('Settings (SCR-11/15/16)', () => {
  test('switch theme recolors (data-theme) and dark mode toggles data-dark', async ({ page }) => {
    await signupViaUI(page)
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: '설정' })).toBeVisible()

    const html = page.locator('html')
    // Default theme is ocean.
    await expect(html).toHaveAttribute('data-theme', 'ocean')

    // Switch to 민트 (mint) → data-theme flips + persists.
    await page.getByRole('radio', { name: '민트' }).click()
    await expect(html).toHaveAttribute('data-theme', 'mint')

    // Toggle dark mode → data-dark flips to true.
    await expect(html).toHaveAttribute('data-dark', 'false')
    await page.getByRole('switch', { name: '다크 모드' }).click()
    await expect(html).toHaveAttribute('data-dark', 'true')

    // Persisted: reload keeps the choices.
    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'mint')
    await expect(html).toHaveAttribute('data-dark', 'true')
  })

  test('account: edit nickname + change password + export button present', async ({ page }) => {
    const me = await signupViaUI(page)
    await page.goto('/settings/account')
    await expect(page.getByRole('heading', { name: '계정' })).toBeVisible()

    // Edit nickname.
    await page.getByRole('button', { name: '편집' }).click()
    const newNick = `n${Math.floor(Math.random() * 1e4)}`
    await page.getByLabel('닉네임').fill(newNick)
    await page.getByRole('button', { name: '저장' }).click()
    await expect(page.getByText(newNick).first()).toBeVisible({ timeout: 10000 })

    // Change password sheet.
    await page.getByRole('button', { name: '비밀번호 변경' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('현재 비밀번호').fill(me.password)
    await dialog.getByLabel('새 비밀번호', { exact: true }).fill('newpassword123')
    await dialog.getByLabel('새 비밀번호 확인').fill('newpassword123')
    await dialog.getByRole('button', { name: '변경' }).click()
    await expect(page.getByText('비밀번호가 변경되었어요.')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: '확인' }).click()

    // Data export button is present (we don't assert the download here).
    await expect(page.getByText('데이터 내보내기')).toBeVisible()
  })

  test('delete account (throwaway user) logs out to /login', async ({ page }) => {
    await signupViaUI(page, makeUser('e2edel'))
    await page.goto('/settings/account')

    await page.getByRole('button', { name: '계정 삭제' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    // Confirm with the password (account has a password set).
    const pwField = dialog.getByLabel('비밀번호 확인')
    if (await pwField.isVisible().catch(() => false)) {
      await pwField.fill('password123')
    }
    await dialog.getByRole('button', { name: '삭제' }).click()

    // Deletion logs the user out → redirected to login.
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
  })

  test('help FAQ expands and 문의하기 submits', async ({ page }) => {
    await signupViaUI(page)
    await page.goto('/settings/help')
    await expect(page.getByRole('heading', { name: '도움말' })).toBeVisible()

    // Expand an FAQ item.
    const faq = page.getByRole('button', { name: /라이브는 어떻게 시작하나요/ })
    await expect(faq).toHaveAttribute('aria-expanded', 'false')
    await faq.click()
    await expect(faq).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText(/라이브 시작.*버튼을 누르면/)).toBeVisible()

    // Open the contact form and submit.
    await page.getByRole('button', { name: '문의하기' }).click()
    await page.getByLabel('제목').fill('테스트 문의')
    await page.locator('#contact-body').fill('E2E 테스트 문의 내용입니다.')
    await page.getByRole('button', { name: '전송' }).click()
    await expect(page.getByText('문의가 접수되었어요. 빠르게 답변드릴게요!')).toBeVisible({
      timeout: 10000,
    })
  })

  test('notification settings: toggle persists', async ({ page }) => {
    await signupViaUI(page)
    await page.goto('/settings/notifications')
    await expect(page.getByRole('heading', { name: '알림' })).toBeVisible()

    const liveToggle = page.getByRole('switch', { name: '라이브 시작 알림' })
    await expect(liveToggle).toBeVisible({ timeout: 10000 })
    const before = await liveToggle.getAttribute('aria-checked')
    await liveToggle.click()
    const after = before === 'true' ? 'false' : 'true'
    await expect(liveToggle).toHaveAttribute('aria-checked', after, { timeout: 10000 })

    // Persisted across reload.
    await page.reload()
    await expect(page.getByRole('switch', { name: '라이브 시작 알림' })).toHaveAttribute(
      'aria-checked',
      after,
      { timeout: 10000 },
    )
  })

  test('notification center: bell opens, mark all read', async ({ page }) => {
    await signupViaUI(page)
    await page.goto('/')
    // The bell lives in the home header.
    await page.getByRole('button', { name: /알림/ }).first().click()
    const dialog = page.getByRole('dialog', { name: '알림' })
    await expect(dialog).toBeVisible()
    // Either there are notifications (mark all read) or an empty state.
    const markAll = dialog.getByRole('button', { name: '모두 읽음' })
    const empty = dialog.getByText('새 알림이 없어요')
    await expect(markAll.or(empty)).toBeVisible({ timeout: 10000 })
    if (await markAll.isVisible().catch(() => false)) {
      await markAll.click()
    }
  })
})
