import { test, expect } from '@playwright/test'
import { createGroupViaUI, createTaskInGroup, signupViaUI } from './helpers'

test.describe('Activity (SCR-08)', () => {
  test('timeline shows events after activity; filter chips work', async ({ page }) => {
    await signupViaUI(page)
    const group = await createGroupViaUI(page)

    // Create + complete a task to generate timeline events.
    const title = `운동${Math.floor(Math.random() * 1e4)}`
    await createTaskInGroup(page, group, title)
    await page.getByRole('button', { name: `${title} 완료` }).click()
    await expect(page.getByRole('button', { name: `${title} 완료 취소` })).toBeVisible({
      timeout: 10000,
    })

    // Activity tab shows the timeline.
    await page.goto('/activity')
    await expect(page.getByRole('heading', { name: '활동' })).toBeVisible()

    // The completed task appears in the timeline.
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 15000 })

    // Filter chips: "전체" + the group chip exist and are selectable.
    const allChip = page.getByRole('tab', { name: '전체' })
    await expect(allChip).toBeVisible()
    const groupChip = page.getByRole('tab', { name: group })
    await expect(groupChip).toBeVisible()
    await groupChip.click()
    await expect(groupChip).toHaveAttribute('aria-selected', 'true')
    await allChip.click()
    await expect(allChip).toHaveAttribute('aria-selected', 'true')
  })

  test('empty activity state for a brand-new user', async ({ page }) => {
    await signupViaUI(page)
    await page.goto('/activity')
    await expect(page.getByText('아직 활동이 없어요')).toBeVisible({ timeout: 15000 })
  })
})
