import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

const { mockUpdateSW } = vi.hoisted(() => ({ mockUpdateSW: vi.fn() }));

vi.mock('virtual:pwa-register', () => ({
  registerSW: () => mockUpdateSW,
}));

import UpdateToast from './UpdateToast.svelte';
import { needRefresh } from '../pwa/register';

describe('UpdateToast', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    needRefresh.set(false);
    mockUpdateSW.mockClear();
  });

  it('renders nothing when no update is pending', () => {
    const { queryByRole } = render(UpdateToast);
    expect(queryByRole('status')).toBeNull();
  });

  it('renders the toast with reload button when needRefresh is true', () => {
    needRefresh.set(true);
    const { getByRole, getByText } = render(UpdateToast);
    expect(getByRole('status')).toBeTruthy();
    expect(getByText(/New version available/)).toBeTruthy();
    expect(getByRole('button', { name: /Reload/ })).toBeTruthy();
  });

  it('clicking the reload button calls updateSW(true)', async () => {
    needRefresh.set(true);
    const { getByRole } = render(UpdateToast);
    await fireEvent.click(getByRole('button', { name: /Reload/ }));
    expect(mockUpdateSW).toHaveBeenCalledWith(true);
  });
});
