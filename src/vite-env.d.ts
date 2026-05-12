/// <reference types="svelte" />
/// <reference types="vite/client" />

declare global {
  const __BUILD_SHA__: string;
  const __BUILD_DATE__: string;

  interface Window {
    sa_event?: (name: string, metadata?: Record<string, unknown>) => void;
  }
}

export {};
