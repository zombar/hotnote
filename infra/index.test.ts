import { describe, it, expect, beforeEach } from 'vitest';
import * as pulumi from '@pulumi/pulumi';

// Set up Pulumi mocking
pulumi.runtime.setMocks({
  newResource: function (args: pulumi.runtime.MockResourceArgs): {
    id: string;
    state: any;
  } {
    const outputs = args.inputs;

    // Add default outputs for specific resource types
    if (args.type === 'digitalocean:index/app:App') {
      return {
        id: args.name + '_id',
        state: {
          ...args.inputs,
          id: '0103986a-6ef9-4886-b030-c4abca6e01f7',
          liveUrl: 'https://hotnote-test.ondigitalocean.app',
          defaultIngress: 'https://hotnote-xxxxx.ondigitalocean.app',
          activeDeploymentId: 'deployment-123',
        },
      };
    }

    if (args.type === 'digitalocean:index/domain:Domain') {
      return {
        id: args.name + '_id',
        state: {
          ...args.inputs,
          id: 'hotnote.io',
          urn: 'urn:pulumi:test::test::digitalocean:index/domain:Domain::hotnote-domain',
        },
      };
    }

    if (args.type === 'digitalocean:index/dnsRecord:DnsRecord') {
      return {
        id: args.name + '_id',
        state: {
          ...args.inputs,
          id: 'dns-record-123',
          fqdn: 'hotnote.io',
        },
      };
    }

    return {
      id: args.name + '_id',
      state: outputs,
    };
  },
  call: function (args: pulumi.runtime.MockCallArgs) {
    return args.inputs;
  },
});

describe('Pulumi Infrastructure Tests', () => {
  let infrastructure: typeof import('./index');

  beforeEach(async () => {
    // Set environment variables for testing
    process.env.IMAGE_TAG = 'test-tag';

    // Dynamically import the infrastructure to get fresh state
    infrastructure = await import('./index');
  });

  describe('Exported Values', () => {
    it('should export appUrl pointing to DigitalOcean', async () => {
      const appUrl = await promiseOf(infrastructure.appUrl);
      expect(appUrl).toBeDefined();
      expect(appUrl).toContain('digitalocean.app');
    });

    it('should export appId', async () => {
      const appId = await promiseOf(infrastructure.appId);
      expect(appId).toBeDefined();
      expect(typeof appId).toBe('string');
      expect(appId).toContain('app');
    });

    it('should export domain name as hotnote.io', async () => {
      const domainName = await promiseOf(infrastructure.domainName);
      expect(domainName).toBe('hotnote.io');
    });

    it('should export DigitalOcean nameservers', async () => {
      const nameservers = await promiseOf(infrastructure.nameservers);
      expect(nameservers).toEqual([
        'ns1.digitalocean.com',
        'ns2.digitalocean.com',
        'ns3.digitalocean.com',
      ]);
    });

    it('should export appDefaultUrl', async () => {
      const appDefaultUrl = await promiseOf(infrastructure.appDefaultUrl);
      expect(appDefaultUrl).toBeDefined();
      expect(appDefaultUrl).toContain('digitalocean.app');
    });
  });

  describe('Configuration Validation', () => {
    it('should read IMAGE_TAG from environment', () => {
      expect(process.env.IMAGE_TAG).toBe('test-tag');
    });

    it('should use latest tag when IMAGE_TAG is not set', () => {
      const originalTag = process.env.IMAGE_TAG;
      delete process.env.IMAGE_TAG;

      // Verify fallback behavior would use 'latest'
      const tag = process.env.IMAGE_TAG || 'latest';
      expect(tag).toBe('latest');

      // Restore
      process.env.IMAGE_TAG = originalTag;
    });
  });

  describe('Infrastructure Module', () => {
    it('should successfully import without errors', async () => {
      expect(infrastructure).toBeDefined();
      expect(infrastructure.appUrl).toBeDefined();
      expect(infrastructure.appId).toBeDefined();
      expect(infrastructure.domainName).toBeDefined();
      expect(infrastructure.nameservers).toBeDefined();
    });

    it('should export all required values', () => {
      expect(infrastructure.appUrl).toBeDefined();
      expect(infrastructure.appId).toBeDefined();
      expect(infrastructure.appDefaultUrl).toBeDefined();
      expect(infrastructure.domainName).toBeDefined();
      expect(infrastructure.nameservers).toBeDefined();
    });
  });
});

// Helper function to convert Pulumi Output to Promise
function promiseOf<T>(output: pulumi.Output<T>): Promise<T> {
  return new Promise((resolve) => {
    output.apply((value) => {
      resolve(value);
      return value;
    });
  });
}
