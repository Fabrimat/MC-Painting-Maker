/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { execSync } from 'node:child_process';

function resolveBuildSha(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
}

export default defineConfig({
  plugins: [svelte()],
  base: './',
  define: {
    __BUILD_SHA__: JSON.stringify(resolveBuildSha()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    // Force the client Svelte bundle when running under Vitest so @testing-library
    // can mount components. Without this, Vitest's SSR-style resolution picks
    // svelte/index-server.js, which only exposes the server render API.
    conditions: process.env.VITEST ? ['browser'] : undefined,
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.ts'],
  },
});
