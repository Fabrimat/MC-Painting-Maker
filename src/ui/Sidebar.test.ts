import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { render, fireEvent } from '@testing-library/svelte';
import Sidebar from './Sidebar.svelte';
import { project } from '../stores/project';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';

describe('Sidebar', () => {
  let saEvent: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    saEvent = vi.fn();
    vi.stubGlobal('sa_event', saEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the Add images card and the painting count', () => {
    project.set(createEmptyProject());
    const { getByText } = render(Sidebar, { props: { selectedId: null } });
    expect(getByText('Add images')).toBeTruthy();
    expect(getByText(/Paintings · 0/)).toBeTruthy();
  });

  it('does NOT render any rename input', () => {
    const s = createEmptyProject();
    s.paintings.push(createPaintingFromImage('Sunset', { pngBase64: '', naturalW: 32, naturalH: 32 }));
    project.set(s);
    const { container } = render(Sidebar, { props: { selectedId: null } });
    expect(container.querySelectorAll('input[type="text"]').length).toBe(0);
  });

  it('emits painting_added with source=button when files are picked via the file input', async () => {
    vi.stubGlobal('createImageBitmap', async () => ({ width: 16, height: 16, close: () => {} }));
    project.set(createEmptyProject());
    const { container } = render(Sidebar, { props: { selectedId: null } });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([new Uint8Array([1, 2, 3])], 'pic.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    await fireEvent.change(input);
    await vi.waitFor(() => {
      expect(saEvent).toHaveBeenCalledWith('painting_added', { source: 'button', count: 1 });
    });
    expect(get(project).paintings).toHaveLength(1);
  });
});
