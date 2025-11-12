/**
 * Prompt Manager
 *
 * Manages welcome and resume prompts shown in the file picker:
 * - Welcome prompt for first-time users
 * - Resume prompt to continue with last folder
 * - Workdir prompt for URL-based workspace opening
 */

import { appState } from '../state/app-state.js';
import { URLParamManager } from '../navigation/url-param-manager.js';

/**
 * Show welcome prompt for first-time users
 * Displays in the file picker area with option to open folder
 */
export function showWelcomePrompt() {
  const picker = document.getElementById('file-picker');
  picker.classList.remove('hidden');

  picker.innerHTML = `
        <div class="welcome-content">
            <p class="welcome-text">Welcome to hotnote</p>
            <p class="welcome-text">Open a folder to start browsing and editing files.</p>
            <div class="welcome-actions">
                <button id="welcome-folder-btn" class="welcome-btn">
                    <span class="material-symbols-outlined">folder_open</span>
                    Open Folder
                </button>
            </div>
        </div>
    `;

  document.getElementById('welcome-folder-btn').addEventListener('click', () => {
    appState.focusManager?.saveFocusState();

    // Call global functions (available in app context)

    if (typeof hideFilePicker !== 'undefined') {
      hideFilePicker();
    }

    if (typeof openFolder !== 'undefined') {
      // eslint-disable-next-line no-undef
      openFolder();
    }
  });
}

/**
 * Show resume prompt to continue with last folder
 * @param {string} folderName - Name of the last opened folder
 */
export function showResumePrompt(folderName) {
  const picker = document.getElementById('file-picker');
  picker.classList.remove('hidden');

  picker.innerHTML = `
        <div class="welcome-content">
            <p class="welcome-text">Continue where you left off?</p>
            <div class="welcome-actions">
                <button id="resume-folder-btn" class="welcome-btn">
                    <span class="material-symbols-outlined">folder_open</span>
                    Resume editing ${folderName}
                </button>
                <button id="new-folder-btn" class="welcome-btn">
                    <span class="material-symbols-outlined">folder</span>
                    Open Different Folder
                </button>
            </div>
        </div>
    `;

  document.getElementById('resume-folder-btn').addEventListener('click', () => {
    appState.focusManager?.saveFocusState();

    if (typeof hideFilePicker !== 'undefined') {
      hideFilePicker();
    }

    if (typeof openFolder !== 'undefined') {
      // eslint-disable-next-line no-undef
      openFolder();
    }
  });

  document.getElementById('new-folder-btn').addEventListener('click', () => {
    // Clear saved folder name and show welcome prompt
    appState.focusManager?.saveFocusState();
    localStorage.removeItem('lastFolderName');

    if (typeof hideFilePicker !== 'undefined') {
      hideFilePicker();
    }

    if (typeof openFolder !== 'undefined') {
      // eslint-disable-next-line no-undef
      openFolder();
    }
  });
}

/**
 * Show workdir prompt when URL has workdir parameter
 * @param {string} workdirPath - Full path to the workspace directory
 */
export function showWorkdirPrompt(workdirPath) {
  const picker = document.getElementById('file-picker');
  picker.classList.remove('hidden');

  // Extract just the folder name from the full path for display
  const folderName =
    workdirPath
      .split('/')
      .filter((p) => p)
      .pop() || 'workspace';

  picker.innerHTML = `
        <div class="welcome-content">
            <p class="welcome-text">Open workspace</p>
            <p class="welcome-text" style="font-size: 0.9em; opacity: 0.8; margin-top: 0.5em;">${workdirPath}</p>
            <div class="welcome-actions">
                <button id="open-workdir-btn" class="welcome-btn">
                    <span class="material-symbols-outlined">folder_open</span>
                    Select ${folderName}
                </button>
                <button id="cancel-workdir-btn" class="welcome-btn">
                    <span class="material-symbols-outlined">close</span>
                    Cancel
                </button>
            </div>
        </div>
    `;

  document.getElementById('open-workdir-btn').addEventListener('click', async () => {
    appState.focusManager?.saveFocusState();

    if (typeof hideFilePicker !== 'undefined') {
      hideFilePicker();
    }

    // Trigger folder picker - user must select the folder

    if (typeof openFolder !== 'undefined') {
      // eslint-disable-next-line no-undef
      await openFolder();
    }

    // After folder is selected, update URL with actual folder path
    // (It may differ from the URL param if user selected a different folder)
  });

  document.getElementById('cancel-workdir-btn').addEventListener('click', () => {
    appState.focusManager?.saveFocusState();

    // Clear URL params and show normal welcome
    URLParamManager.clear();

    if (typeof hideFilePicker !== 'undefined') {
      hideFilePicker();
    }

    // Show normal prompt based on whether we have lastFolderName
    const lastFolderName = localStorage.getItem('lastFolderName');
    setTimeout(() => {
      if (lastFolderName) {
        showResumePrompt(lastFolderName);
      } else {
        showWelcomePrompt();
      }
    }, 100);
  });
}
