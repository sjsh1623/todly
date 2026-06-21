import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createGroupViaUI, createTaskInGroup, signupViaUI } from './helpers'

const dir = path.dirname(fileURLToPath(import.meta.url))

/** Creates a group + task via UI and opens the task detail page. */
async function openTaskDetail(page: import('@playwright/test').Page, title: string) {
  const group = await createGroupViaUI(page)
  await createTaskInGroup(page, group, title)
  // Open detail by clicking the task title.
  await page.getByText(title, { exact: true }).click()
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible({ timeout: 15000 })
}

test.describe('Task detail (SCR-12)', () => {
  test('add subtask, toggle it, add a comment, upload a photo', async ({ page }) => {
    await signupViaUI(page)
    const title = `발표준비${Math.floor(Math.random() * 1e4)}`
    await openTaskDetail(page, title)

    // Add a checklist subtask.
    const subtask = '자료 조사'
    await page.getByLabel('체크리스트 항목 추가').fill(subtask)
    await page.getByRole('button', { name: '추가', exact: true }).click()
    const sub = page.getByRole('checkbox', { name: subtask })
    await expect(sub).toBeVisible({ timeout: 10000 })
    await expect(sub).toHaveAttribute('aria-checked', 'false')

    // Toggle subtask done.
    await sub.click()
    await expect(page.getByRole('checkbox', { name: subtask })).toHaveAttribute(
      'aria-checked',
      'true',
      { timeout: 10000 },
    )

    // Add a comment.
    const comment = '오늘 시작해요!'
    await page.getByLabel('댓글 입력').fill(comment)
    await page.getByRole('button', { name: '등록', exact: true }).click()
    await expect(page.getByText(comment)).toBeVisible({ timeout: 10000 })

    // Upload a photo via the hidden file input.
    const fixture = path.join(dir, 'fixtures', 'pixel.png')
    await page.locator('input[type="file"]').setInputFiles(fixture)
    // A photo thumbnail (aria-label "사진 보기") shows once uploaded.
    await expect(page.getByRole('button', { name: '사진 보기' }).first()).toBeVisible({
      timeout: 15000,
    })
  })

  test('mark complete and delete the task', async ({ page }) => {
    await signupViaUI(page)
    const title = `정리하기${Math.floor(Math.random() * 1e4)}`
    await openTaskDetail(page, title)

    // Mark complete (navigates back to group).
    await page.getByRole('button', { name: '완료로 등록' }).click()
    await expect(page.getByText(title)).toBeVisible({ timeout: 15000 })

    // Re-open and delete (auto-accept the confirm dialog).
    await page.getByText(title, { exact: true }).click()
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
    // Let async sections (comments/photos) settle so re-renders stop.
    await expect(page.getByText('체크리스트')).toBeVisible()
    await page.waitForLoadState('networkidle')
    // Delete via the bottom action bar (always present) and accept the confirm.
    page.on('dialog', (d) => d.accept())
    await page.getByRole('button', { name: '투두 삭제', exact: true }).click()

    // Back on group detail, the task is gone.
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 15000 })
  })
})
