/**
 * Settings Panel
 * GitHub-inspired settings UI for configuring Ollama settings
 */

import { getSettings, updateSettings, validateEndpointUrl } from '../state/settings-manager.js';
import { isLocalEnvironment } from '../utils/environment.js';

export class SettingsPanel {
  constructor(options = {}) {
    this.panel = null;
    this.overlay = null;
    this.isOpen = false;
    this.getEditor = options.getEditor || null;
  }

  /**
   * Create the settings panel DOM structure
   */
  create() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'settings-overlay';
    this.overlay.addEventListener('click', () => this.close());

    // Create panel
    this.panel = document.createElement('div');
    this.panel.className = 'settings-panel';
    this.panel.addEventListener('click', (e) => e.stopPropagation());

    // Header
    const header = document.createElement('div');
    header.className = 'settings-header';

    const title = document.createElement('h2');
    title.textContent = 'Settings';

    const closeButton = document.createElement('button');
    closeButton.className = 'settings-close-button';
    closeButton.innerHTML = '&times;';
    closeButton.setAttribute('aria-label', 'Close settings');
    closeButton.addEventListener('click', () => this.close());

    header.appendChild(title);
    header.appendChild(closeButton);

    // Privacy info banner
    const infoBanner = document.createElement('div');
    infoBanner.className = 'settings-info-banner';

    const infoIcon = document.createElement('span');
    infoIcon.className = 'settings-info-icon';
    infoIcon.innerHTML = '🔒';

    const infoText = document.createElement('div');
    infoText.className = 'settings-info-text';

    const infoTitle = document.createElement('strong');
    infoTitle.textContent = 'Local-First & Private';

    const infoDescription = document.createElement('p');
    infoDescription.textContent =
      'Hotnote is local-first. Your data never leaves your device, and we will never attempt to collect or access your information.';

    const infoLink = document.createElement('p');
    infoLink.className = 'settings-info-link';
    const sourceLink = document.createElement('a');
    sourceLink.href = 'https://github.com/zombar/hotnote.io';
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    sourceLink.textContent = 'source code';
    sourceLink.setAttribute('data-testid', 'settings-source-code-link');
    infoLink.appendChild(sourceLink);

    infoText.appendChild(infoTitle);
    infoText.appendChild(infoDescription);
    infoText.appendChild(infoLink);

    infoBanner.appendChild(infoIcon);
    infoBanner.appendChild(infoText);

    // Content
    const content = document.createElement('div');
    content.className = 'settings-content';

    // Create form
    const form = this.createForm();
    content.appendChild(form);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'settings-footer';

    const saveButton = document.createElement('button');
    saveButton.className = 'settings-save-button';
    saveButton.textContent = 'Save';
    saveButton.setAttribute('data-testid', 'settings-save-button');
    saveButton.addEventListener('click', () => this.save());

    const cancelButton = document.createElement('button');
    cancelButton.className = 'settings-cancel-button';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => this.close());

    footer.appendChild(cancelButton);
    footer.appendChild(saveButton);

    // Assemble panel
    this.panel.appendChild(header);

    // Only show privacy banner when hosted (not running locally)
    // This emphasizes the local-first, privacy-preserving nature of Hotnote
    if (!isLocalEnvironment()) {
      this.panel.appendChild(infoBanner);
    }

    this.panel.appendChild(content);
    this.panel.appendChild(footer);

    return this;
  }

  /**
   * Create settings form
   */
  createForm() {
    const settings = getSettings();

    const form = document.createElement('form');
    form.className = 'settings-form';
    form.setAttribute('data-testid', 'settings-form');

    // Ollama Configuration Section
    const configSection = this.createSection('Ollama Configuration');

    // Endpoint URL
    const endpointGroup = this.createFormGroup(
      'endpoint',
      'Endpoint URL',
      'text',
      settings.endpoint || 'http://localhost:11434',
      'http://localhost:11434'
    );
    const endpointHelp = document.createElement('p');
    endpointHelp.className = 'settings-help-text';
    endpointHelp.textContent = 'Enter the URL of your local Ollama server';
    endpointGroup.appendChild(endpointHelp);
    configSection.appendChild(endpointGroup);

    // Model (text input)
    const modelGroup = this.createFormGroup(
      'model',
      'Model',
      'text',
      settings.model || 'llama2',
      'llama2'
    );
    const modelHelp = document.createElement('p');
    modelHelp.className = 'settings-help-text';
    modelHelp.textContent = 'Enter the model name (e.g., llama2, mistral, codellama)';
    modelGroup.appendChild(modelHelp);
    configSection.appendChild(modelGroup);

    form.appendChild(configSection);

    // Model Settings Section
    const modelSection = this.createSection('Model Settings');

    // System Prompt
    const promptGroup = this.createFormGroup(
      'systemPrompt',
      'System Prompt',
      'textarea',
      settings.systemPrompt || '',
      ''
    );
    modelSection.appendChild(promptGroup);

    form.appendChild(modelSection);

    return form;
  }

  /**
   * Create a form section
   */
  createSection(title) {
    const section = document.createElement('div');
    section.className = 'settings-section';

    const sectionTitle = document.createElement('h3');
    sectionTitle.className = 'settings-section-title';
    sectionTitle.textContent = title;

    section.appendChild(sectionTitle);

    return section;
  }

  /**
   * Create a form group (label + input)
   */
  createFormGroup(name, label, type, value, placeholder, attrs = {}) {
    const group = document.createElement('div');
    group.className = 'settings-form-group';

    const labelEl = document.createElement('label');
    labelEl.className = 'settings-label';
    labelEl.textContent = label;
    labelEl.setAttribute('for', `settings-${name}`);

    let input;
    if (type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 4;
      input.value = value;
    } else {
      input = document.createElement('input');
      input.type = type;
      input.value = value;

      // Apply additional attributes (for range inputs)
      Object.keys(attrs).forEach((key) => {
        input.setAttribute(key, attrs[key]);
      });
    }

    input.id = `settings-${name}`;
    input.name = name;
    input.className = 'settings-input';
    input.setAttribute('data-testid', `settings-${name}`);

    if (placeholder) {
      input.placeholder = placeholder;
    }

    // Show current value for range inputs
    if (type === 'range') {
      const valueDisplay = document.createElement('span');
      valueDisplay.className = 'settings-range-value';
      valueDisplay.textContent = value;
      input.addEventListener('input', () => {
        valueDisplay.textContent = input.value;
      });

      group.appendChild(labelEl);
      group.appendChild(input);
      group.appendChild(valueDisplay);
    } else {
      group.appendChild(labelEl);
      group.appendChild(input);
    }

    // Add validation error element
    const errorEl = document.createElement('div');
    errorEl.className = 'settings-error';
    errorEl.id = `settings-${name}-error`;
    group.appendChild(errorEl);

    return group;
  }

  /**
   * Validate Ollama form data
   */
  validate(data) {
    const errors = {};

    // Validate endpoint URL
    if (!data.endpoint || !validateEndpointUrl(data.endpoint)) {
      errors.endpoint = 'Please enter a valid HTTP or HTTPS URL';
    }

    // Validate model
    if (!data.model || data.model.trim() === '') {
      errors.model = 'Model is required';
    }

    return errors;
  }

  /**
   * Show validation errors
   */
  showErrors(errors) {
    // Clear all errors first
    const errorElements = this.panel.querySelectorAll('.settings-error');
    errorElements.forEach((el) => (el.textContent = ''));

    // Show new errors
    Object.keys(errors).forEach((field) => {
      const errorEl = this.panel.querySelector(`#settings-${field}-error`);
      if (errorEl) {
        errorEl.textContent = errors[field];
      }
    });
  }

  /**
   * Save Ollama settings
   */
  save() {
    const form = this.panel.querySelector('.settings-form');
    /* global FormData */
    const formData = new FormData(form);

    const data = {
      endpoint: formData.get('endpoint'),
      model: formData.get('model'),
      systemPrompt: formData.get('systemPrompt'),
    };

    // Validate
    const errors = this.validate(data);

    if (Object.keys(errors).length > 0) {
      this.showErrors(errors);
      return;
    }

    // Update settings
    updateSettings(data);

    this.close();
  }

  /**
   * Open the settings panel
   */
  open() {
    if (this.isOpen) {
      return;
    }

    if (!this.panel) {
      this.create();
    }

    // Blur the editor when settings panel opens
    if (this.getEditor) {
      const editor = this.getEditor();
      if (editor && editor.getActiveEditor) {
        const activeEditor = editor.getActiveEditor();
        if (activeEditor && activeEditor.view && activeEditor.view.dom) {
          activeEditor.view.dom.blur();
        }
      }
    }

    document.body.appendChild(this.overlay);
    document.body.appendChild(this.panel);

    this.isOpen = true;

    // Focus first input
    const firstInput = this.panel.querySelector('.settings-input');
    if (firstInput) {
      firstInput.focus();
    }

    // Handle ESC key
    this.escHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', this.escHandler);
  }

  /**
   * Close the settings panel
   */
  close() {
    if (!this.isOpen) {
      return;
    }

    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }

    if (this.panel && this.panel.parentNode) {
      this.panel.parentNode.removeChild(this.panel);
    }

    this.isOpen = false;

    // Remove ESC handler
    if (this.escHandler) {
      document.removeEventListener('keydown', this.escHandler);
      this.escHandler = null;
    }

    // Restore focus to the editor when settings panel closes
    if (this.getEditor) {
      const editor = this.getEditor();
      if (editor && editor.focus) {
        editor.focus();
      }
    }
  }

  /**
   * Destroy the panel
   */
  destroy() {
    this.close();
    this.panel = null;
    this.overlay = null;
  }
}
