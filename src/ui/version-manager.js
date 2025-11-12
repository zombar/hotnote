/**
 * Version Manager
 *
 * Manages version checking and update notifications:
 * - Periodic version checks against deployed version
 * - Update banner notifications
 * - Welcome message for first-time users
 * - Changelog viewing via GitHub reader
 */

// Module state
let versionBannerDismissed = false;
let versionCheckInterval = null;

/**
 * Initialize version manager
 * Creates banner, performs initial check, and sets up periodic checks
 */
export function initVersionManager() {
  // Create the version banner (hidden by default)
  createVersionBanner('update');

  // Perform initial version check
  performVersionCheck();

  // Set up periodic version checks (every 30 minutes)
  versionCheckInterval = setInterval(
    () => {
      performVersionCheck();
    },
    30 * 60 * 1000
  ); // 30 minutes
}

/**
 * Perform version check
 * Compares current version with deployed version and shows banner if different
 */
export async function performVersionCheck() {
  try {
    const hasNewVersion = await checkForNewVersion();
    if (hasNewVersion) {
      updateBannerContent('update');
      showVersionBanner();
    }
  } catch (err) {
    console.error('Error performing version check:', err);
  }
}

/**
 * Stop version checking
 * Clears periodic check interval
 */
export function stopVersionChecking() {
  if (versionCheckInterval) {
    clearInterval(versionCheckInterval);
    versionCheckInterval = null;
  }
}

/**
 * Show welcome message to first-time users
 * @returns {boolean} true if message was shown, false if already seen
 */
export function showWelcomeMessage() {
  const hasSeenWelcome = localStorage.getItem('hasSeenWelcome');
  if (!hasSeenWelcome) {
    updateBannerContent('welcome');
    showVersionBanner();
    return true;
  }
  return false;
}

/**
 * Check if a new version is available
 * @returns {Promise<boolean>} true if new version is available
 */
async function checkForNewVersion() {
  // Skip if banner is currently dismissed
  if (versionBannerDismissed) return false;

  try {
    const response = await fetch('/version.json?_=' + Date.now(), {
      cache: 'no-cache',
    });
    if (!response.ok) return false;

    const data = await response.json();
    // eslint-disable-next-line no-undef
    const currentVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
    const deployedVersion = data.version;

    // Check if deployed version is different from current
    return currentVersion !== deployedVersion;
  } catch (err) {
    console.log('Version check failed:', err);
    return false;
  }
}

/**
 * Create version banner DOM element
 * @param {string} type - 'update' or 'welcome'
 * @param {string|null} customMessage - optional custom message
 */
function createVersionBanner(type = 'update', customMessage = null) {
  try {
    // Check if banner already exists
    if (document.getElementById('version-banner')) return;

    const header = document.querySelector('header');
    if (!header) {
      console.warn('Header element not found, skipping version banner creation');
      return;
    }

    const banner = document.createElement('div');
    banner.id = 'version-banner';
    banner.className = 'version-banner hidden';

    let message, icon, showReloadBtn;
    if (type === 'welcome') {
      message = customMessage || getWelcomeMessage();
      icon = '👋';
      showReloadBtn = false;
    } else {
      // Create gitreader link to the changelog
      const changelogUrl = 'https://raw.githubusercontent.com/docutag/hotnote/main/CHANGELOG.md';
      const gitreaderLink = `/?gitreader=${encodeURIComponent(changelogUrl)}`;
      message = `New version available! <a href="${gitreaderLink}" style="color: inherit; text-decoration: underline;">View changelog</a>`;
      icon = 'ℹ';
      showReloadBtn = true;
    }

    banner.innerHTML = `
      <div class="version-banner-content">
        <span class="version-banner-message">
          <span class="version-banner-icon">${icon}</span>
          ${message}
        </span>
        <div class="version-banner-actions">
          ${
            showReloadBtn
              ? `<button id="version-reload-btn" class="version-banner-btn version-banner-btn-primary">
            Reload
          </button>`
              : ''
          }
          <button id="version-dismiss-btn" class="version-banner-btn version-banner-btn-secondary">
            ×
          </button>
        </div>
      </div>
    `;

    header.appendChild(banner);

    // Add event listeners
    if (showReloadBtn) {
      const reloadBtn = document.getElementById('version-reload-btn');
      if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
          window.location.reload();
        });
      }
    }

    const dismissBtn = document.getElementById('version-dismiss-btn');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        if (type === 'welcome') {
          localStorage.setItem('hasSeenWelcome', 'true');
        }
        hideVersionBanner();
      });
    }
  } catch (err) {
    console.error('Error creating version banner:', err);
  }
}

/**
 * Show version banner
 */
function showVersionBanner() {
  const banner = document.getElementById('version-banner');
  if (banner) {
    banner.classList.remove('hidden');
    versionBannerDismissed = false;
  }
}

/**
 * Hide version banner
 */
function hideVersionBanner() {
  const banner = document.getElementById('version-banner');
  if (banner) {
    banner.classList.add('hidden');
    versionBannerDismissed = true;
  }
}

/**
 * Update banner content for different message types
 * @param {string} type - 'update' or 'welcome'
 * @param {string|null} customMessage - optional custom message
 */
function updateBannerContent(type = 'update', customMessage = null) {
  try {
    const banner = document.getElementById('version-banner');
    if (!banner) return;

    let message, icon, showReloadBtn;
    if (type === 'welcome') {
      message = customMessage || getWelcomeMessage();
      icon = '👋';
      showReloadBtn = false;
    } else {
      // Create gitreader link to the changelog
      const changelogUrl = 'https://raw.githubusercontent.com/docutag/hotnote/main/CHANGELOG.md';
      const gitreaderLink = `/?gitreader=${encodeURIComponent(changelogUrl)}`;
      message = `New version available! <a href="${gitreaderLink}" style="color: inherit; text-decoration: underline;">View changelog</a>`;
      icon = 'ℹ';
      showReloadBtn = true;
    }

    const content = banner.querySelector('.version-banner-content');
    if (!content) return;

    content.innerHTML = `
      <span class="version-banner-message">
        <span class="version-banner-icon">${icon}</span>
        ${message}
      </span>
      <div class="version-banner-actions">
        ${
          showReloadBtn
            ? `<button id="version-reload-btn" class="version-banner-btn version-banner-btn-primary">
          Reload
        </button>`
            : ''
        }
        <button id="version-dismiss-btn" class="version-banner-btn version-banner-btn-secondary">
          ×
        </button>
      </div>
    `;

    // Re-attach event listeners
    if (showReloadBtn) {
      const reloadBtn = document.getElementById('version-reload-btn');
      if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
          window.location.reload();
        });
      }
    }

    const dismissBtn = document.getElementById('version-dismiss-btn');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        if (type === 'welcome') {
          localStorage.setItem('hasSeenWelcome', 'true');
        }
        hideVersionBanner();
      });
    }
  } catch (err) {
    console.error('Error updating banner content:', err);
  }
}

/**
 * Get a random welcome message
 * @returns {string} welcome message
 */
function getWelcomeMessage() {
  const messages = [
    'Welcome to hotnote! We promise not to auto-save your typos... oh wait, we totally will.',
    'Welcome! Now you can finally edit files without opening a bloated IDE. Your RAM will thank you.',
    "Welcome aboard! We're like Notepad, but with delusions of grandeur.",
    'Welcome! Warning: This editor may cause severe productivity. Side effects include getting things done.',
    'Welcome to hotnote! Where files are edited and your tab hoarding addiction is enabled.',
    "Welcome! Built by developers who couldn't find the perfect editor, so we made another one.",
    "Welcome to the club! You're now part of an elite group of people who know this exists.",
    'Welcome! This editor was coded with coffee, debugged with more coffee, and fueled entirely by caffeine.',
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}
