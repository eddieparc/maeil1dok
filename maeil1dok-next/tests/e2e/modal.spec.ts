import { test, expect } from '@playwright/test'
import path from 'path'
import { promises as fs } from 'fs'

const evidenceDir = path.resolve(process.cwd(), '..', '.sisyphus', 'evidence')

test.describe('Unified modal system', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test')
    await fs.mkdir(evidenceDir, { recursive: true })
  })

  test('open/close confirm and alert with ESC and overlay support', async ({ page }) => {
    await page.getByTestId('btn-modal-confirm').click()
    await expect(page.getByTestId('confirm-modal')).toBeVisible()

    await page.screenshot({
      path: path.join(evidenceDir, 'task-6-confirm-modal.png'),
      fullPage: true,
    })

    await page.getByTestId('confirm-modal-confirm').click()
    await expect(page.getByTestId('modal-result')).toContainText('confirm:true')

    await page.getByTestId('btn-modal-confirm').click()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('modal-result')).toContainText('confirm:false')
    await page.waitForTimeout(250)

    await page.getByTestId('btn-modal-confirm').click()
    await page.mouse.click(8, 8)
    await expect(page.getByTestId('modal-result')).toContainText('confirm:false')
    await page.waitForTimeout(250)

    await page.getByTestId('btn-modal-alert').click()
    await page.getByTestId('alert-modal-confirm').click()
    await expect(page.getByTestId('modal-result')).toContainText('alert:closed')
  })

  test('supports stacked modals and closes top first', async ({ page }) => {
    await page.getByTestId('btn-modal-stack').click()

    await expect(page.getByText('첫 번째 모달')).toBeVisible()
    await expect(page.getByTestId('alert-modal-title')).toHaveText('두 번째 모달')

    await page.screenshot({
      path: path.join(evidenceDir, 'task-6-modal-stack.png'),
      fullPage: true,
    })

    await page.getByTestId('alert-modal-confirm').click()
    await expect(page.getByText('첫 번째 모달')).toBeVisible()

    await page.getByTestId('confirm-modal-cancel').click()
    await expect(page.getByTestId('modal-result')).toContainText('stack:false')
  })
})
