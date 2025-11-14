import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSettings,
  saveSettings,
  getSettings,
  updateSettings,
  resetSettings,
  validateEndpointUrl,
} from '../../src/state/settings-manager.js';

describe('Settings Manager', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('Default Settings', () => {
    it('should return default Ollama settings when no settings are stored', () => {
      const settings = getSettings();

      expect(settings.endpoint).toBe('http://localhost:11434');
      expect(settings.model).toBe('llama2');
      expect(settings.systemPrompt).toBe(
        'You are a helpful AI assistant. Improve the provided text while maintaining its original meaning and tone. Include only the replacement text in your response.'
      );
      expect(settings.temperature).toBe(0.7);
      expect(settings.topP).toBe(0.9);
    });

    it('should have valid default endpoint URL', () => {
      const settings = getSettings();
      expect(validateEndpointUrl(settings.endpoint)).toBe(true);
    });

    it('should have temperature between 0 and 1', () => {
      const settings = getSettings();
      expect(settings.temperature).toBeGreaterThanOrEqual(0);
      expect(settings.temperature).toBeLessThanOrEqual(1);
    });

    it('should have topP between 0 and 1', () => {
      const settings = getSettings();
      expect(settings.topP).toBeGreaterThanOrEqual(0);
      expect(settings.topP).toBeLessThanOrEqual(1);
    });
  });

  describe('loadSettings', () => {
    it('should load settings from localStorage', () => {
      const customSettings = {
        endpoint: 'http://custom:8080',
        model: 'mistral',
        systemPrompt: 'Custom prompt',
        temperature: 0.5,
        topP: 0.8,
      };

      localStorage.setItem('hotnote_settings', JSON.stringify(customSettings));

      const loaded = loadSettings();
      expect(loaded).toEqual(customSettings);
    });

    it('should return default settings if localStorage is empty', () => {
      const settings = loadSettings();

      expect(settings.endpoint).toBe('http://localhost:11434');
      expect(settings.model).toBe('llama2');
    });

    it('should return default settings if localStorage contains invalid JSON', () => {
      localStorage.setItem('hotnote_settings', '{ invalid json');

      const settings = loadSettings();
      expect(settings.endpoint).toBe('http://localhost:11434');
    });

    it('should merge with defaults if settings are incomplete', () => {
      const partialSettings = {
        endpoint: 'http://custom:9000',
      };

      localStorage.setItem('hotnote_settings', JSON.stringify(partialSettings));

      const settings = loadSettings();
      expect(settings.endpoint).toBe('http://custom:9000');
      expect(settings.model).toBe('llama2'); // Default value
    });
  });

  describe('saveSettings', () => {
    it('should save settings to localStorage', () => {
      const settings = {
        endpoint: 'http://test:1234',
        model: 'codellama',
        systemPrompt: 'Test prompt',
        temperature: 0.3,
        topP: 0.7,
      };

      saveSettings(settings);

      const stored = JSON.parse(localStorage.getItem('hotnote_settings'));
      expect(stored).toEqual(settings);
    });

    it('should validate and normalize endpoint URL', () => {
      const settings = {
        endpoint: 'http://localhost:1234/',
        model: 'llama2',
      };

      saveSettings(settings);

      const stored = JSON.parse(localStorage.getItem('hotnote_settings'));
      expect(stored.endpoint).toBe('http://localhost:1234'); // Trailing slash removed
    });

    it('should clamp temperature to 0-1 range', () => {
      const settingsTooHigh = {
        endpoint: 'http://localhost:11434',
        model: 'llama2',
        temperature: 1.5,
      };

      saveSettings(settingsTooHigh);

      const stored = JSON.parse(localStorage.getItem('hotnote_settings'));
      expect(stored.temperature).toBe(1); // Clamped to max

      const settingsTooLow = {
        endpoint: 'http://localhost:11434',
        model: 'llama2',
        temperature: -0.5,
      };

      saveSettings(settingsTooLow);

      const stored2 = JSON.parse(localStorage.getItem('hotnote_settings'));
      expect(stored2.temperature).toBe(0); // Clamped to min
    });

    it('should clamp topP to 0-1 range', () => {
      const settingsTooHigh = {
        endpoint: 'http://localhost:11434',
        model: 'llama2',
        topP: 2.0,
      };

      saveSettings(settingsTooHigh);

      const stored = JSON.parse(localStorage.getItem('hotnote_settings'));
      expect(stored.topP).toBe(1); // Clamped to max
    });
  });

  describe('updateSettings', () => {
    it('should update specific settings fields', () => {
      // Start with defaults
      const initial = getSettings();
      expect(initial.model).toBe('llama2');

      // Update only model
      updateSettings({ model: 'mistral' });

      const updated = getSettings();
      expect(updated.model).toBe('mistral');
      expect(updated.endpoint).toBe('http://localhost:11434'); // Other settings unchanged
    });

    it('should merge updates with existing settings', () => {
      // Set initial settings
      saveSettings({
        endpoint: 'http://test:8080',
        model: 'llama2',
        systemPrompt: 'Original prompt',
      });

      // Update only endpoint
      updateSettings({ endpoint: 'http://new:9000' });

      const settings = getSettings();
      expect(settings.endpoint).toBe('http://new:9000');
      expect(settings.model).toBe('llama2');
      expect(settings.systemPrompt).toBe('Original prompt');
    });
  });

  describe('resetSettings', () => {
    it('should reset to default settings', () => {
      // Set custom settings
      saveSettings({
        endpoint: 'http://custom:8080',
        model: 'mistral',
        systemPrompt: 'Custom',
      });

      // Reset
      resetSettings();

      const settings = getSettings();
      expect(settings.endpoint).toBe('http://localhost:11434');
      expect(settings.model).toBe('llama2');
    });

    it('should clear localStorage', () => {
      saveSettings({ endpoint: 'http://test:1234' });
      resetSettings();

      const stored = localStorage.getItem('hotnote_settings');
      expect(stored).toBeNull();
    });
  });

  describe('Endpoint URL Validation', () => {
    it('should accept valid HTTP URLs', () => {
      expect(validateEndpointUrl('http://localhost:11434')).toBe(true);
      expect(validateEndpointUrl('http://192.168.1.1:8080')).toBe(true);
    });

    it('should accept valid HTTPS URLs', () => {
      expect(validateEndpointUrl('https://api.example.com')).toBe(true);
      expect(validateEndpointUrl('https://localhost:11434')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(validateEndpointUrl('not-a-url')).toBe(false);
      expect(validateEndpointUrl('ftp://invalid.com')).toBe(false);
      expect(validateEndpointUrl('')).toBe(false);
      expect(validateEndpointUrl(null)).toBe(false);
    });

    it('should reset invalid endpoint to default on save', () => {
      const settings = {
        endpoint: 'invalid-url',
        model: 'llama2',
      };

      saveSettings(settings);

      const stored = JSON.parse(localStorage.getItem('hotnote_settings'));
      expect(stored.endpoint).toBe('http://localhost:11434'); // Reset to default
    });
  });

  describe('Model Name Validation', () => {
    it('should trim whitespace from model names', () => {
      const settings = {
        endpoint: 'http://localhost:11434',
        model: '  mistral  ',
      };

      saveSettings(settings);

      const stored = JSON.parse(localStorage.getItem('hotnote_settings'));
      expect(stored.model).toBe('mistral');
    });

    it('should accept various model name formats', () => {
      const modelNames = ['llama2', 'mistral', 'codellama', 'llama3:70b', 'mistral:latest'];

      modelNames.forEach((modelName) => {
        updateSettings({ model: modelName });
        const settings = getSettings();
        expect(settings.model).toBe(modelName);
      });
    });
  });

  describe('Legacy Settings Migration', () => {
    it('should migrate from old nested structure to new flat structure', () => {
      // Old structure with nested ollama object
      const legacySettings = {
        provider: 'ollama',
        ollama: {
          endpoint: 'http://custom:8080',
          model: 'mistral',
          systemPrompt: 'Legacy prompt',
          temperature: 0.5,
          topP: 0.8,
        },
        apiKeys: {
          claude: 'sk-ant-test',
          openai: 'sk-test',
        },
      };

      localStorage.setItem('hotnote_settings', JSON.stringify(legacySettings));

      const settings = loadSettings();

      // Should extract ollama settings to top level
      expect(settings.ollama).toBeDefined();
      expect(settings.ollama.endpoint).toBe('http://custom:8080');
    });
  });
});
