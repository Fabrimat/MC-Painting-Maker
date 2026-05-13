import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

vi.mock('virtual:pwa-register', () => ({
  registerSW: () => vi.fn(),
}));

import UpdateToast from './UpdateToast.svelte';
import { needRefresh } from '../pwa/register';

describe('UpdateToast', () => {
  let reloadSpy: ReturnType<typeof vi.fn>;
  let originalLocation: PropertyDescriptor | undefined;

  beforeEach(() => {
    document.body.innerHTML = '';
    needRefresh.set(false);
    reloadSpy = vi.fn();
    originalLocation = Object.getOwnPropertyDescriptor(window, 'location');
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalLocation) {
      Object.defineProperty(window, 'location', originalLocation);
    }
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

  it('clicking the reload button triggers the page reload', async () => {
    needRefresh.set(true);
    const { getByRole } = render(UpdateToast);
    await fireEvent.click(getByRole('button', { name: /Reload/ }));
    expect(reloadSpy).toHaveBeenCalled();
  });
});
