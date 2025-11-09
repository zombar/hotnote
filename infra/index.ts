import * as pulumi from '@pulumi/pulumi';
import * as digitalocean from '@pulumi/digitalocean';

// Get configuration
const config = new pulumi.Config();
const imageTag = process.env.IMAGE_TAG || 'latest';

// Use existing DigitalOcean Container Registry (registry.digitalocean.com/hotnote)
const registry = 'hotnote';
const repository = 'hotnote'; // This is the repository within the registry

// Debug: Log the image configuration
console.log(`Image configuration:`);
console.log(`  Registry: ${registry}`);
console.log(`  Repository: ${repository}`);
console.log(`  Tag: ${imageTag}`);
console.log(
  `  Full path would be: registry.digitalocean.com/${registry}/${repository}:${imageTag}`
);

// Create a DigitalOcean App Platform app
const app = new digitalocean.App('hotnote-app', {
  spec: {
    name: 'hotnote',
    region: 'fra1', // Frankfurt
    domains: [
      {
        name: 'hotnote.io',
        type: 'PRIMARY',
      },
    ],
    services: [
      {
        name: 'hotnote-web',
        instanceCount: 1,
        instanceSizeSlug: 'basic-xxs',
        image: {
          registryType: 'DOCR',
          registry: registry,
          repository: repository,
          tag: imageTag,
        },
        httpPort: 80,
        healthCheck: {
          httpPath: '/',
        },
        routes: [
          {
            path: '/',
          },
        ],
      },
    ],
  },
});

// Note: The domain 'hotnote.io' is already configured in the App Platform spec above.
// DigitalOcean App Platform will automatically handle the DNS configuration
// when you add the domain in the DO console and point your nameservers to DO.
//
// Manual DNS setup (if needed):
// 1. Go to DigitalOcean Networking → Domains
// 2. Add hotnote.io if not already added
// 3. The App Platform will provide you with CNAME/A records to add
// 4. For the root domain, you'll need to use DO's A records pointing to the app

// Export the app's live URL and domain info
export const appUrl = app.liveUrl;
export const appId = app.id;
export const appDefaultUrl = app.defaultIngress;
