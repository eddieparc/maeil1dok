import { test as setup } from '@playwright/test'

// Auth setup: stores auth state for reuse across tests
// In a real environment, this would log in with test credentials
// For now, it's a placeholder that tests can use
setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/login')
  // Note: actual auth requires real Supabase credentials
  // Tests that need auth should handle the login themselves
})
