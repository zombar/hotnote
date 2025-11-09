import { defineConfig } from 'vite';
import { copyFileSync, writeFileSync } from 'fs';
import { readFileSync } from 'fs';

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'));
const version = packageJson.version;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      external: ['/neutralino.js'],
      output: {
        // Copy service worker and create version file after build
        plugins: [
          {
            name: 'copy-sw',
            writeBundle() {
              copyFileSync('sw.js', 'dist/sw.js');
              // Generate version.json for runtime version checking
              writeFileSync('dist/version.json', JSON.stringify({ version }, null, 2));
            },
          },
        ],
      },
    },
  },
});
