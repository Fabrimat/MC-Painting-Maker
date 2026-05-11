import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { activeTab, packDrawerOpen } from './ui';

describe('ui store', () => {
  it('defaults to the paintings tab and a closed drawer', () => {
    expect(get(activeTab)).toBe('paintings');
    expect(get(packDrawerOpen)).toBe(false);
  });

  it('lets activeTab move between the three tabs', () => {
    activeTab.set('edit');
    expect(get(activeTab)).toBe('edit');
    activeTab.set('properties');
    expect(get(activeTab)).toBe('properties');
    activeTab.set('paintings');
  });
});
