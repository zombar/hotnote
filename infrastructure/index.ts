import * as pulumi from '@pulumi/pulumi';
import * as digitalocean from '@pulumi/digitalocean';

// Get configuration
const config = new pulumi.Config();
const githubRepo = process.env.GITHUB_REPOSITORY || 'anthropics/hotnote';
const branch = config.get('branch') || 'main';

// Create a DigitalOcean App Platform app for static site
const app = new digitalocean.App('hotnote-app', {
  spec: {
    name: 'hotnote',
    region: 'fra', // Frankfurt
    staticSites: [
      {
        name: 'hotnote-web',
        github: {
          repo: githubRepo,
          branch: branch,
          deployOnPush: true,
        },
        buildCommand: 'npm ci && npm run build',
        outputDir: '/dist',
        envs: [
          {
            key: 'NODE_VERSION',
            value: '20',
          },
        ],
      },
    ],
  },
});

// Export the app's live URL
export const appUrl = app.liveUrl;
export const appId = app.id;
