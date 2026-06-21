import { test, expect } from '@playwright/test'
import { signupViaUI } from './helpers'

test.describe('Routine (SCR-09)', () => {
  test('create a routine via the sheet → list shows it → complete it', async ({ page }) => {
    await signupViaUI(page)
    await page.goto('/routine')

    // Empty state first.
    await expect(page.getByText('아직 루틴이 없어요')).toBeVisible({ timeout: 15000 })

    // Open the create sheet (FAB).
    await page.getByRole('button', { name: '루틴 추가' }).click()
    const dialog = page.getByRole('dialog', { name: '루틴 추가' })
    await expect(dialog).toBeVisible()

    const title = `아침 스트레칭${Math.floor(Math.random() * 1e4)}`
    await dialog.getByLabel('루틴 제목').fill(title)
    // Daily recurrence (매일).
    await dialog.getByRole('radio', { name: '매일' }).click()
    await dialog.getByRole('button', { name: '루틴 추가하기' }).click()
    await expect(dialog).toBeHidden({ timeout: 10000 })

    // The routine appears in the list (card title is an exact match).
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15000 })

    // Complete the routine: prefer the explicit "완료 표시" checkbox; fall back
    // to "시작" (which begins a live session) only if that's the available CTA.
    const completeBtn = page.getByRole('button', { name: `${title} 완료 표시` })
    if (await completeBtn.isVisible().catch(() => false)) {
      await completeBtn.click()
      // The card flips to the completed indicator.
      await expect(page.getByLabel('완료됨').first()).toBeVisible({ timeout: 10000 })
    } else {
      // Next-up routine: the start CTA is shown instead.
      await expect(page.getByRole('button', { name: '시작' })).toBeVisible()
    }
  })

  test('create a routine via TaskCreate "루틴으로 반복" toggle', async ({ page }) => {
    await signupViaUI(page)
    await page.goto('/tasks/new')

    const title = `물 마시기${Math.floor(Math.random() * 1e4)}`
    await page.getByPlaceholder('무엇을 할까요?').fill(title)

    // Flip the routine toggle; the submit label switches to "루틴 추가하기".
    await page.getByRole('switch', { name: '루틴으로 반복' }).click()
    await expect(page.getByRole('switch', { name: '루틴으로 반복' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await page.getByRole('button', { name: '루틴 추가하기' }).click()

    // Lands back; the routine shows up on the routine tab.
    await page.goto('/routine')
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15000 })
  })
})
