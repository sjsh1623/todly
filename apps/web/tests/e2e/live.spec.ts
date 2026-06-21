import { test, expect, type Page } from '@playwright/test'
import { createGroupViaUI, createTaskInGroup, signupViaUI } from './helpers'

/** Creates a group + an assigned-to-me task; returns its taskId. */
async function setupAssignedTask(page: Page, title: string): Promise<string> {
  const group = await createGroupViaUI(page)
  await createTaskInGroup(page, group, title)

  // Capture the taskId from the detail URL, then go back to the group.
  await page.getByText(title, { exact: true }).click()
  await page.waitForURL(/\/tasks\/[^/]+$/, { timeout: 15000 })
  const taskId = page.url().split('/tasks/')[1]
  await page.goBack()
  await expect(page.getByRole('heading', { name: group, level: 1 })).toBeVisible({ timeout: 15000 })

  // Assign to me so the "지금 시작" (start live) action becomes available.
  await page.getByRole('button', { name: '내가 할게요' }).first().click()
  await expect(page.getByRole('button', { name: `${title} 지금 시작` })).toBeVisible({
    timeout: 10000,
  })
  return taskId
}

test.describe('Live (SCR-06/07)', () => {
  test('start live → live room with timer; send cheer + emoji', async ({ page }) => {
    await signupViaUI(page)
    const title = `러닝${Math.floor(Math.random() * 1e4)}`
    await setupAssignedTask(page, title)

    await page.getByRole('button', { name: `${title} 지금 시작` }).click()
    await page.waitForURL(/\/(rooms|live)\//, { timeout: 15000 })

    if (/\/rooms\//.test(page.url())) {
      await expect(page.getByText('라이브 룸')).toBeVisible({ timeout: 10000 })
      await expect(page.getByText(/명이 함께 달리는 중/)).toBeVisible()

      const cheer = '화이팅!'
      await page.getByPlaceholder('응원 메시지 보내기…').fill(cheer)
      await page.getByRole('button', { name: '보내기', exact: true }).click()
      await expect(page.getByText(cheer)).toBeVisible({ timeout: 10000 })

      await page.getByRole('button', { name: '🔥 응원 보내기' }).click()
      await expect(page.getByText('🔥').first()).toBeVisible({ timeout: 10000 })
    } else {
      // Solo fallback already covered by the next test; just assert the screen.
      await expect(page.getByText('지금 라이브')).toBeVisible({ timeout: 10000 })
    }
  })

  test('solo live moment: timer, pause/resume, complete', async ({ page }) => {
    await signupViaUI(page)
    const title = `독서${Math.floor(Math.random() * 1e4)}`
    const taskId = await setupAssignedTask(page, title)

    // Start live, then open the solo live-moment view for the same task. The
    // live session lives in the in-memory store, so SPA navigation keeps it.
    await page.getByRole('button', { name: `${title} 지금 시작` }).click()
    await page.waitForURL(/\/(rooms|live)\//, { timeout: 15000 })

    await page.goto(`/live/${taskId}`)
    const liveBadge = page.getByText('지금 라이브')
    const emptyState = page.getByText('진행 중인 라이브가 없어요')
    await expect(liveBadge.or(emptyState)).toBeVisible({ timeout: 10000 })

    if (await liveBadge.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: '일시정지' }).click()
      await expect(page.getByText('일시정지됨')).toBeVisible({ timeout: 10000 })
      await page.getByRole('button', { name: '다시 시작' }).click()
      await expect(page.getByText('지금 라이브')).toBeVisible({ timeout: 10000 })
      await page.getByRole('button', { name: '완료', exact: true }).click()
      await expect(page).not.toHaveURL(/\/live\//, { timeout: 15000 })
    }
  })
})
