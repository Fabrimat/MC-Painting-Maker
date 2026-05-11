/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  base: './',
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
