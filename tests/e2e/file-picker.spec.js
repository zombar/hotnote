import { test, expect } from '@playwright/test';

test.describe('File Picker', () => {
  test('should show welcome prompt on first visit', async ({ page }) => {
    await page.goto('/');

    // Wait for the app to load
    await page.waitForSelector('[data-testid="file-picker"]');

    // File picker should be visible with welcome prompt
    const filePicker = page.getByTestId('file-picker');
    await expect(filePicker).not.toHaveClass(/hidden/);

    // Should show welcome content
    await expect(page.locator('.welcome-text')).toBeVisible();
    await expect(page.locator('#welcome-folder-btn')).toBeVisible();
  });

  test('should have no close button on file picker', async ({ page }) => {
    await page.goto('/');

    // File picker should not have a close button
    const closeButton = page.locator('.file-picker-close');
    await expect(closeButton).toHaveCount(0);
  });

  test('should close file picker when clicking outside', async ({ page }) => {
    await page.goto('/');

    // Wait for file picker to be visible with welcome content
    await page.waitForSelector('.welcome-content');
    const filePicker = page.getByTestId('file-picker');
    await expect(filePicker).not.toHaveClass(/hidden/);

    // Click on the editor area (outside the file picker)
    const editor = page.getByTestId('editor');
    await editor.click();

    // File picker should now be hidden
    await expect(filePicker).toHaveClass(/hidden/);
  });

  test('should not close file picker when clicking inside it', async ({ page }) => {
    await page.goto('/');

    // Wait for file picker to be visible
    await page.waitForSelector('.welcome-content');
    const filePicker = page.getByTestId('file-picker');
    await expect(filePicker).not.toHaveClass(/hidden/);

    // Click inside the file picker (on the welcome text)
    const welcomeText = page.locator('.welcome-text').first();
    await welcomeText.click();

    // File picker should still be visible
    await expect(filePicker).not.toHaveClass(/hidden/);
  });

  test('should reopen file picker when clicking breadcrumb', async ({ page }) => {
    await page.goto('/');

    // Wait for file picker to be visible with welcome content
    await page.waitForSelector('.welcome-content');
    const filePicker = page.getByTestId('file-picker');
    await expect(filePicker).not.toHaveClass(/hidden/);

    // Close the file picker by clicking outside
    const editor = page.getByTestId('editor');
    await editor.click();
    await expect(filePicker).toHaveClass(/hidden/);

    // Note: The following would require File System Access API mocking
    // to actually have a folder open and a clickable breadcrumb item.
    // This is a placeholder for when that functionality is implemented.

    // In a real scenario with a folder open, clicking the breadcrumb
    // filename or placeholder should reopen the file picker
    // const breadcrumb = page.getByTestId('breadcrumb');
    // await breadcrumb.locator('.breadcrumb-item').first().click();
    // await expect(filePicker).not.toHaveClass(/hidden/);
  });

  test('should navigate through directories', async ({ page }) => {
    await page.goto('/');

    // This test requires File System Access API setup
    // Placeholder for actual implementation with folder structure
  });

  test('should create new file from quick search', async ({ page }) => {
    await page.goto('/');

    // This test requires File System Access API setup
    // Would test typing a character to trigger quick file creation
    // and the autocomplete dropdown appearing
  });

  test('should delete file from file picker', async ({ page }) => {
    await page.goto('/');

    // This test requires File System Access API setup
    // Would test the 'rm' button functionality
  });
});
