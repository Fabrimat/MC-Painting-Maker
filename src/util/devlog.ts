import { get } from 'svelte/store';
import { devMode } from '../stores/devMode';

function timestamp(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function devLog(category: string, ...args: unknown[]): void {
  if (!get(devMode)) return;
  console.log(`[debug ${timestamp()}] [${category}]`, ...args);
}
