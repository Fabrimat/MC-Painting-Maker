import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Topbar from './Topbar.svelte';
import { project } from '../stores/project';
import { packDrawerOpen } from '../stores/ui';
import { devMode } from '../stores/devMode';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';

describe('Topbar', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    devMode.set(false);
  });

  it('disables Build when there are no paintings', () => {
    project.set(createEmptyProject());
    const { getByRole } = render(Topbar);
    const btn = getByRole('button', { name: /Build/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('enables Build when at least one painting exists', () => {
    const s = createEmptyProject();
    s.paintings.push(createPaintingFromImage('Sunset', { pngBase64: '', naturalW: 32, naturalH: 32 }));
    project.set(s);
    const { getByRole } = render(Topbar);
    const btn = getByRole('button', { name: /Build/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('clicking the settings button flips packDrawerOpen', async () => {
    packDrawerOpen.set(false);
    const { getByRole } = render(Topbar);
    await fireEvent.click(getByRole('button', { name: /Pack settings/ }));
    expect(get(packDrawerOpen)).toBe(true);
  });

  it('clicking Build calls onbuild', async () => {
    const s = createEmptyProject();
    s.paintings.push(createPaintingFromImage('Sunset', { pngBase64: '', naturalW: 32, naturalH: 32 }));
    project.set(s);
    const onbuild = vi.fn();
    const { getByRole } = render(Topbar, { props: { onbuild } });
    await fireEvent.click(getByRole('button', { name: /Build/ }));
    expect(onbuild).toHaveBeenCalled();
  });

  it('exposes a how-to link that points at how-to.html', () => {
    project.set(createEmptyProject());
    const { getByRole } = render(Topbar);
    const link = getByRole('link', { name: /How to use/ }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('./how-to.html');
    expect(link.getAttribute('target')).toBeNull();
  });

  it('does not show the DEBUG badge or .zip button when debug mode is off', () => {
    project.set(createEmptyProject());
    const { queryByText, queryByRole } = render(Topbar);
    expect(queryByText('DEBUG')).toBeNull();
    expect(queryByRole('button', { name: /Download \.zip/ })).toBeNull();
  });

  it('shows the DEBUG badge and a .zip button when debug mode is on', () => {
    const s = createEmptyProject();
    s.paintings.push(createPaintingFromImage('Sunset', { pngBase64: '', naturalW: 32, naturalH: 32 }));
    project.set(s);
    devMode.set(true);
    const { getByText, getByRole } = render(Topbar);
    expect(getByText('DEBUG')).toBeTruthy();
    expect(getByRole('button', { name: /Download \.zip/ })).toBeTruthy();
  });

  it('clicking the .zip button calls ondownloadzip', async () => {
    const s = createEmptyProject();
    s.paintings.push(createPaintingFromImage('Sunset', { pngBase64: '', naturalW: 32, naturalH: 32 }));
    project.set(s);
    devMode.set(true);
    const ondownloadzip = vi.fn();
    const { getByRole } = render(Topbar, { props: { ondownloadzip } });
    await fireEvent.click(getByRole('button', { name: /Download \.zip/ }));
    expect(ondownloadzip).toHaveBeenCalled();
  });

  it('disables the .zip button when there are no paintings', () => {
    project.set(createEmptyProject());
    devMode.set(true);
    const { getByRole } = render(Topbar);
    const btn = getByRole('button', { name: /Download \.zip/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
