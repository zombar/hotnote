/**
 * E2E tests for Ollama Settings
 * Tests Ollama configuration and settings persistence
 */

import { test, expect } from '@playwright/test';

// Helper to clear localStorage
async function clearStorage(page) {
  await page.evaluate(() => {
    localStorage.clear();
    /* global sessionStorage */
    sessionStorage.clear();
  });
}

// Helper to open settings panel
async function openSettings(page) {
  // Click the settings button
  await page.click('[data-testid="settings-btn"]');

  // Wait for settings panel to be visible
  await page.waitForSelector('.settings-panel', { state: 'visible' });
}

test.describe('Ollama Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3011');
    await clearStorage(page);
    await page.reload();
  });

  test('should show Ollama configuration fields', async ({ page }) => {
    await openSettings(page);

    // Should show endpoint URL field
    const endpointField = page.locator('input[name="endpoint"]');
    await expect(endpointField).toBeVisible();
    await expect(endpointField).toHaveValue('http://localhost:11434');

    // Should show help text for endpoint
    await expect(page.locator('text=Enter the URL of your local Ollama server')).toBeVisible();
  });

  test('should show model text input', async ({ page }) => {
    await openSettings(page);

    // Should be a text input
    const modelInput = page.locator('input[name="model"]');
    await expect(modelInput).toBeVisible();
    await expect(modelInput).toHaveAttribute('type', 'text');

    // Should have default value of llama2
    await expect(modelInput).toHaveValue('llama2');

    // Should have help text with examples
    await expect(page.locator('text=llama2, mistral, codellama')).toBeVisible();
  });

  test('should NOT show privacy banner when running locally', async ({ page }) => {
    await openSettings(page);

    // Privacy banner should NOT be visible when running locally
    const banner = page.locator('.settings-info-banner');
    await expect(banner).not.toBeVisible();
  });

  test('should save Ollama settings correctly', async ({ page }) => {
    await openSettings(page);

    // Change endpoint
    await page.fill('input[name="endpoint"]', 'http://localhost:8080');

    // Change model
    await page.fill('input[name="model"]', 'mistral');

    // Change system prompt
    await page.fill('textarea[name="systemPrompt"]', 'Custom test prompt for Ollama');

    // Save settings
    await page.click('button:has-text("Save")');

    // Wait for panel to close
    await expect(page.locator('.settings-panel')).not.toBeVisible();

    // Verify settings were saved
    const savedSettings = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('hotnote_settings'));
    });

    expect(savedSettings.endpoint).toBe('http://localhost:8080');
    expect(savedSettings.model).toBe('mistral');
    expect(savedSettings.systemPrompt).toBe('Custom test prompt for Ollama');
  });

  test('should validate Ollama endpoint URL', async ({ page }) => {
    await openSettings(page);

    // Enter invalid URL
    await page.fill('input[name="endpoint"]', 'not-a-valid-url');

    // Try to save
    await page.click('button:has-text("Save")');

    // Should show validation error
    await expect(page.locator('.settings-error')).toBeVisible();
    await expect(page.locator('#settings-endpoint-error')).toContainText('valid');
  });

  test('should allow custom Ollama model names', async ({ page }) => {
    await openSettings(page);

    const modelInput = page.locator('input[name="model"]');

    // Should allow entering custom models
    await modelInput.fill('');
    await modelInput.fill('llama3:70b');
    await expect(modelInput).toHaveValue('llama3:70b');

    await modelInput.fill('mistral:latest');
    await expect(modelInput).toHaveValue('mistral:latest');

    await modelInput.fill('custom-model');
    await expect(modelInput).toHaveValue('custom-model');
  });

  test('should maintain model selection after reopening settings', async ({ page }) => {
    await openSettings(page);

    // Enter a custom model
    await page.fill('input[name="model"]', 'codellama:13b');

    // Save
    await page.click('button:has-text("Save")');
    await expect(page.locator('.settings-panel')).not.toBeVisible();

    // Reopen settings
    await openSettings(page);

    // Model should still be the custom value
    await expect(page.locator('input[name="model"]')).toHaveValue('codellama:13b');
  });

  test('should preserve system prompt when changing models', async ({ page }) => {
    await openSettings(page);

    // Set custom system prompt
    const customPrompt = 'My custom system prompt';
    await page.fill('textarea[name="systemPrompt"]', customPrompt);

    // Change model
    const modelInput = page.locator('input[name="model"]');
    await modelInput.fill('mistral');

    // System prompt should remain
    await expect(page.locator('textarea[name="systemPrompt"]')).toHaveValue(customPrompt);
  });

  test('should close settings on cancel', async ({ page }) => {
    await openSettings(page);

    // Make a change
    await page.fill('textarea[name="systemPrompt"]', 'Changed prompt');

    // Click cancel
    await page.click('button:has-text("Cancel")');

    // Settings should close
    await expect(page.locator('.settings-panel')).not.toBeVisible();

    // Changes should not be saved
    const settings = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('hotnote_settings') || '{}');
    });

    expect(settings.systemPrompt).not.toBe('Changed prompt');
  });

  test('should close settings on overlay click', async ({ page }) => {
    await openSettings(page);

    // Click on overlay (outside panel)
    await page.click('.settings-overlay');

    // Settings should close
    await expect(page.locator('.settings-panel')).not.toBeVisible();
  });

  test('should close settings on ESC key', async ({ page }) => {
    await openSettings(page);

    // Press ESC
    await page.keyboard.press('Escape');

    // Settings should close
    await expect(page.locator('.settings-panel')).not.toBeVisible();
  });

  test('should show appropriate source code link', async ({ page }) => {
    await openSettings(page);

    const sourceLink = page.locator('[data-testid="settings-source-code-link"]');

    if (await sourceLink.isVisible()) {
      await expect(sourceLink).toHaveAttribute('href', 'https://github.com/zombar/hotnote.io');
      await expect(sourceLink).toHaveAttribute('target', '_blank');
      await expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  test('should have correct default model', async ({ page }) => {
    await openSettings(page);

    const modelInput = page.locator('input[name="model"]');
    const currentValue = await modelInput.inputValue();

    // Default Ollama model should be llama2
    expect(currentValue).toBe('llama2');
  });
});
