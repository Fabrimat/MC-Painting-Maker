import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import Topbar from './Topbar.svelte';
import { project } from '../stores/project';
import { packDrawerOpen } from '../stores/ui';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';

describe('Topbar', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
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

  it('clicking ⚙ flips packDrawerOpen', async () => {
    packDrawerOpen.set(false);
    const { getByRole } = render(Topbar);
    await fireEvent.click(getByRole('button', { name: /Pack settings/ }));
    expect(get(packDrawerOpen)).toBe(true);
  });

  it('clicking Build dispatches a build event', async () => {
    const s = createEmptyProject();
    s.paintings.push(createPaintingFromImage('Sunset', { pngBase64: '', naturalW: 32, naturalH: 32 }));
    project.set(s);
    const { getByRole, component } = render(Topbar);
    const fn = vi.fn();
    component.$on('build', fn);
    await fireEvent.click(getByRole('button', { name: /Build/ }));
    expect(fn).toHaveBeenCalled();
  });
});
