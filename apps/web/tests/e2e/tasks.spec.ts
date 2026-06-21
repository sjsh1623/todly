import { test, expect } from '@playwright/test'
import { createGroupViaUI, createTaskInGroup, signupViaUI } from './helpers'

test.describe('Tasks (SCR-05/04/12)', () => {
  test('create task with group/due/priority → appears in group → toggle complete', async ({ page }) => {
    await signupViaUI(page)
    const group = await createGroupViaUI(page)

    // Create a task from the group detail (FAB).
    const fab = page.getByRole('button', { name: '투두 추가', exact: true })
    await expect(fab).toBeVisible()
    await fab.click()
    await page.waitForURL(/\/tasks\/new/, { timeout: 15000 })

    const title = `장보기${Math.floor(Math.random() * 1e4)}`
    await page.getByPlaceholder('무엇을 할까요?').fill(title)

    // Group should be preselected (came from group detail); pick explicitly to be safe.
    await page.getByRole('radio', { name: group }).click()

    // Due = today, priority = high.
    await page.getByRole('radio', { name: '오늘' }).click()
    await page.getByRole('radio', { name: '높음' }).click()

    await page.getByRole('button', { name: '투두 추가하기' }).click()

    // Back on group detail, the task is listed.
    await expect(page.getByRole('heading', { name: group, level: 1 })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(title)).toBeVisible()

    // Toggle complete: checkbox flips + progress updates.
    const checkbox = page.getByRole('button', { name: `${title} 완료` })
    await expect(checkbox).toHaveAttribute('aria-pressed', 'false')
    await checkbox.click()
    await expect(
      page.getByRole('button', { name: `${title} 완료 취소` }),
    ).toBeVisible({ timeout: 10000 })

    // Progress badge reflects 1/1 completion.
    await expect(page.getByText('100% 완료')).toBeVisible({ timeout: 10000 })
  })

  test('"내가 할게요" assigns the task to me', async ({ page }) => {
    const me = await signupViaUI(page)
    const group = await createGroupViaUI(page)

    const title = `청소${Math.floor(Math.random() * 1e4)}`
    await createTaskInGroup(page, group, title)

    // Assign self from the task row.
    await page.getByRole('button', { name: '내가 할게요' }).first().click()

    // After assigning, the assignee avatar (aria-label 담당 <nick>) appears.
    await expect(page.getByLabel(`담당 ${me.nickname}`)).toBeVisible({ timeout: 10000 })
  })
})
