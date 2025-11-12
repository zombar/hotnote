import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  showWelcomePrompt,
  showResumePrompt,
  showWorkdirPrompt,
} from '../../src/ui/prompt-manager.js';
import { appState } from '../../src/state/app-state.js';
import { URLParamManager } from '../../src/navigation/url-param-manager.js';

describe('Prompt Manager', () => {
  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '<div id="file-picker" class="hidden"></div>';

    // Clear localStorage
    localStorage.clear();

    // Mock appState
    appState.focusManager = {
      saveFocusState: vi.fn(),
    };

    // Mock global functions
    globalThis.hideFilePicker = vi.fn();
    globalThis.openFolder = vi.fn();

    // Mock URLParamManager
    vi.spyOn(URLParamManager, 'clear');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    delete globalThis.hideFilePicker;
    delete globalThis.openFolder;
    vi.clearAllMocks();
  });

  describe('showWelcomePrompt', () => {
    it('should show welcome prompt with correct content', () => {
      showWelcomePrompt();

      const picker = document.getElementById('file-picker');
      expect(picker.classList.contains('hidden')).toBe(false);
      expect(picker.innerHTML).toContain('Welcome to hotnote');
      expect(picker.innerHTML).toContain('Open a folder to start browsing');
    });

    it('should create welcome button with correct icon', () => {
      showWelcomePrompt();

      const welcomeBtn = document.getElementById('welcome-folder-btn');
      expect(welcomeBtn).not.toBeNull();
      expect(welcomeBtn.innerHTML).toContain('folder_open');
    });

    it('should trigger openFolder when welcome button clicked', () => {
      showWelcomePrompt();

      const welcomeBtn = document.getElementById('welcome-folder-btn');
      welcomeBtn.click();

      expect(appState.focusManager.saveFocusState).toHaveBeenCalled();
      expect(globalThis.hideFilePicker).toHaveBeenCalled();
      expect(globalThis.openFolder).toHaveBeenCalled();
    });
  });

  describe('showResumePrompt', () => {
    it('should show resume prompt with folder name', () => {
      showResumePrompt('my-project');

      const picker = document.getElementById('file-picker');
      expect(picker.classList.contains('hidden')).toBe(false);
      expect(picker.innerHTML).toContain('Continue where you left off?');
      expect(picker.innerHTML).toContain('Resume editing my-project');
    });

    it('should create resume and new folder buttons', () => {
      showResumePrompt('test-folder');

      const resumeBtn = document.getElementById('resume-folder-btn');
      const newFolderBtn = document.getElementById('new-folder-btn');

      expect(resumeBtn).not.toBeNull();
      expect(newFolderBtn).not.toBeNull();
    });

    it('should resume folder when resume button clicked', () => {
      showResumePrompt('test-folder');

      const resumeBtn = document.getElementById('resume-folder-btn');
      resumeBtn.click();

      expect(appState.focusManager.saveFocusState).toHaveBeenCalled();
      expect(globalThis.hideFilePicker).toHaveBeenCalled();
      expect(globalThis.openFolder).toHaveBeenCalled();
    });

    it('should clear lastFolderName when new folder button clicked', () => {
      localStorage.setItem('lastFolderName', 'old-folder');
      showResumePrompt('old-folder');

      const newFolderBtn = document.getElementById('new-folder-btn');
      newFolderBtn.click();

      expect(localStorage.getItem('lastFolderName')).toBeNull();
      expect(appState.focusManager.saveFocusState).toHaveBeenCalled();
      expect(globalThis.hideFilePicker).toHaveBeenCalled();
      expect(globalThis.openFolder).toHaveBeenCalled();
    });

    it('should display folder name with special characters', () => {
      showResumePrompt('my-folder-with-dashes');

      const picker = document.getElementById('file-picker');
      expect(picker.innerHTML).toContain('my-folder-with-dashes');
    });
  });

  describe('showWorkdirPrompt', () => {
    it('should show workdir prompt with path', () => {
      showWorkdirPrompt('/home/user/workspace');

      const picker = document.getElementById('file-picker');
      expect(picker.classList.contains('hidden')).toBe(false);
      expect(picker.innerHTML).toContain('Open workspace');
      expect(picker.innerHTML).toContain('/home/user/workspace');
    });

    it('should extract folder name from path', () => {
      showWorkdirPrompt('/home/user/my-project');

      const picker = document.getElementById('file-picker');
      expect(picker.innerHTML).toContain('Select my-project');
    });

    it('should handle root paths', () => {
      showWorkdirPrompt('/workspace');

      const picker = document.getElementById('file-picker');
      expect(picker.innerHTML).toContain('Select workspace');
    });

    it('should use default name for empty path', () => {
      showWorkdirPrompt('');

      const picker = document.getElementById('file-picker');
      expect(picker.innerHTML).toContain('Select workspace');
    });

    it('should create open and cancel buttons', () => {
      showWorkdirPrompt('/test/path');

      const openBtn = document.getElementById('open-workdir-btn');
      const cancelBtn = document.getElementById('cancel-workdir-btn');

      expect(openBtn).not.toBeNull();
      expect(cancelBtn).not.toBeNull();
    });

    it('should trigger openFolder when open button clicked', async () => {
      showWorkdirPrompt('/test/path');

      const openBtn = document.getElementById('open-workdir-btn');
      await openBtn.click();

      expect(appState.focusManager.saveFocusState).toHaveBeenCalled();
      expect(globalThis.hideFilePicker).toHaveBeenCalled();
      expect(globalThis.openFolder).toHaveBeenCalled();
    });

    it('should clear URL params and show normal prompt when cancel clicked', async () => {
      localStorage.setItem('lastFolderName', 'test-folder');
      showWorkdirPrompt('/test/path');

      const cancelBtn = document.getElementById('cancel-workdir-btn');
      cancelBtn.click();

      expect(appState.focusManager.saveFocusState).toHaveBeenCalled();
      expect(URLParamManager.clear).toHaveBeenCalled();
      expect(globalThis.hideFilePicker).toHaveBeenCalled();

      // Wait for setTimeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should show resume prompt since lastFolderName exists
      const picker = document.getElementById('file-picker');
      expect(picker.innerHTML).toContain('Continue where you left off?');
    });

    it('should show welcome prompt when cancel clicked without lastFolderName', async () => {
      showWorkdirPrompt('/test/path');

      const cancelBtn = document.getElementById('cancel-workdir-btn');
      cancelBtn.click();

      // Wait for setTimeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      const picker = document.getElementById('file-picker');
      expect(picker.innerHTML).toContain('Welcome to hotnote');
    });

    it('should handle paths with trailing slashes', () => {
      showWorkdirPrompt('/home/user/workspace/');

      const picker = document.getElementById('file-picker');
      expect(picker.innerHTML).toContain('Select workspace');
    });

    it('should handle Windows-style paths', () => {
      showWorkdirPrompt('C:/Users/Name/Project');

      const picker = document.getElementById('file-picker');
      expect(picker.innerHTML).toContain('Select Project');
    });
  });

  describe('DOM manipulation', () => {
    it('should show file picker element', () => {
      const picker = document.getElementById('file-picker');
      picker.classList.add('hidden');

      showWelcomePrompt();

      expect(picker.classList.contains('hidden')).toBe(false);
    });

    it('should replace existing content in file picker', () => {
      const picker = document.getElementById('file-picker');
      picker.innerHTML = '<div>old content</div>';

      showWelcomePrompt();

      expect(picker.innerHTML).not.toContain('old content');
      expect(picker.innerHTML).toContain('Welcome to hotnote');
    });

    it('should create proper HTML structure', () => {
      showWelcomePrompt();

      const picker = document.getElementById('file-picker');
      const welcomeContent = picker.querySelector('.welcome-content');
      const welcomeText = picker.querySelector('.welcome-text');
      const welcomeActions = picker.querySelector('.welcome-actions');

      expect(welcomeContent).not.toBeNull();
      expect(welcomeText).not.toBeNull();
      expect(welcomeActions).not.toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should handle missing file-picker element gracefully', () => {
      document.body.innerHTML = ''; // Remove file-picker

      expect(() => {
        showWelcomePrompt();
      }).toThrow(); // Will throw because picker is null
    });
  });
});
