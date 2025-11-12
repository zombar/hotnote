import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initVersionManager,
  performVersionCheck,
  stopVersionChecking,
  showWelcomeMessage,
} from '../../src/ui/version-manager.js';

describe('Version Manager', () => {
  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<header></header>';

    // Clear localStorage
    localStorage.clear();

    // Mock fetch
    global.fetch = vi.fn();

    // Mock APP_VERSION
    global.__APP_VERSION__ = '1.0.0';

    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: {
        reload: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    stopVersionChecking();
    document.body.innerHTML = '';
    localStorage.clear();
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('initVersionManager', () => {
    it('should create version banner element', () => {
      initVersionManager();

      const banner = document.getElementById('version-banner');
      expect(banner).not.toBeNull();
      expect(banner.classList.contains('hidden')).toBe(true);
    });

    it('should not create duplicate banners', () => {
      initVersionManager();
      initVersionManager();

      const banners = document.querySelectorAll('#version-banner');
      expect(banners.length).toBe(1);
    });

    it('should perform initial version check', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '1.0.0' }),
      });

      initVersionManager();

      // Wait for async check
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/version.json'),
        expect.any(Object)
      );
    });

    it('should setup periodic version checks', () => {
      vi.useFakeTimers();
      initVersionManager();

      const spy = vi.spyOn(global, 'fetch');

      // Fast-forward 30 minutes
      vi.advanceTimersByTime(30 * 60 * 1000);

      expect(spy).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('performVersionCheck', () => {
    beforeEach(() => {
      initVersionManager();
    });

    it('should show banner when new version is available', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '2.0.0' }),
      });

      await performVersionCheck();

      const banner = document.getElementById('version-banner');
      expect(banner.classList.contains('hidden')).toBe(false);
    });

    it('should not show banner when version is same', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '1.0.0' }),
      });

      await performVersionCheck();

      const banner = document.getElementById('version-banner');
      expect(banner.classList.contains('hidden')).toBe(true);
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(performVersionCheck()).resolves.not.toThrow();

      const banner = document.getElementById('version-banner');
      expect(banner.classList.contains('hidden')).toBe(true);
    });

    it('should handle non-ok response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
      });

      await performVersionCheck();

      const banner = document.getElementById('version-banner');
      expect(banner.classList.contains('hidden')).toBe(true);
    });

    it('should include cache-busting parameter', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '1.0.0' }),
      });

      await performVersionCheck();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/version\.json\?_=\d+/),
        expect.any(Object)
      );
    });
  });

  describe('Version banner interactions', () => {
    beforeEach(() => {
      initVersionManager();
    });

    it('should show reload button for update banner', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '2.0.0' }),
      });

      await performVersionCheck();

      const reloadBtn = document.getElementById('version-reload-btn');
      expect(reloadBtn).not.toBeNull();
    });

    it('should reload page when reload button clicked', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '2.0.0' }),
      });

      await performVersionCheck();

      const reloadBtn = document.getElementById('version-reload-btn');
      reloadBtn.click();

      expect(window.location.reload).toHaveBeenCalled();
    });

    it('should hide banner when dismiss button clicked', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '2.0.0' }),
      });

      await performVersionCheck();

      const banner = document.getElementById('version-banner');
      const dismissBtn = document.getElementById('version-dismiss-btn');

      dismissBtn.click();

      expect(banner.classList.contains('hidden')).toBe(true);
    });

    it('should include changelog link in update message', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '2.0.0' }),
      });

      await performVersionCheck();

      const banner = document.getElementById('version-banner');
      expect(banner.innerHTML).toContain('View changelog');
      expect(banner.innerHTML).toContain('gitreader');
    });
  });

  describe('showWelcomeMessage', () => {
    beforeEach(() => {
      initVersionManager();
    });

    it('should show welcome banner with random message', () => {
      showWelcomeMessage();

      const banner = document.getElementById('version-banner');
      expect(banner.classList.contains('hidden')).toBe(false);

      const message = banner.querySelector('.version-banner-message');
      expect(message.textContent).toContain('Welcome');
    });

    it('should not show reload button for welcome banner', () => {
      showWelcomeMessage();

      const reloadBtn = document.getElementById('version-reload-btn');
      expect(reloadBtn).toBeNull();
    });

    it('should show welcome icon', () => {
      showWelcomeMessage();

      const banner = document.getElementById('version-banner');
      expect(banner.innerHTML).toContain('👋');
    });

    it('should save hasSeenWelcome when dismissed', () => {
      showWelcomeMessage();

      const dismissBtn = document.getElementById('version-dismiss-btn');
      dismissBtn.click();

      expect(localStorage.getItem('hasSeenWelcome')).toBe('true');
    });

    it('should not show if already seen', () => {
      localStorage.setItem('hasSeenWelcome', 'true');

      const result = showWelcomeMessage();

      expect(result).toBe(false);

      const banner = document.getElementById('version-banner');
      expect(banner.classList.contains('hidden')).toBe(true);
    });

    it('should return true if shown', () => {
      const result = showWelcomeMessage();

      expect(result).toBe(true);
    });
  });

  describe('stopVersionChecking', () => {
    it('should clear interval', () => {
      vi.useFakeTimers();
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      initVersionManager();
      stopVersionChecking();

      expect(clearIntervalSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should allow reinitialization after stop', () => {
      initVersionManager();
      stopVersionChecking();

      expect(() => {
        initVersionManager();
      }).not.toThrow();
    });
  });

  describe('Banner persistence', () => {
    beforeEach(() => {
      initVersionManager();
    });

    it('should not check version if banner is dismissed', async () => {
      // First check shows banner
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '2.0.0' }),
      });

      await performVersionCheck();

      // Dismiss banner
      const dismissBtn = document.getElementById('version-dismiss-btn');
      dismissBtn.click();

      // Second check should not show banner
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '3.0.0' }),
      });

      await performVersionCheck();

      const banner = document.getElementById('version-banner');
      expect(banner.classList.contains('hidden')).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should handle missing header element', () => {
      document.body.innerHTML = ''; // No header

      expect(() => {
        initVersionManager();
      }).not.toThrow();

      const banner = document.getElementById('version-banner');
      expect(banner).toBeNull();
    });

    it('should handle invalid JSON response', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      initVersionManager();
      await expect(performVersionCheck()).resolves.not.toThrow();
    });
  });
});
