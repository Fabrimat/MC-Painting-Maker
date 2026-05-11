import { writable } from 'svelte/store';

export type Tab = 'paintings' | 'edit' | 'properties';

export const activeTab = writable<Tab>('paintings');
export const packDrawerOpen = writable<boolean>(false);
