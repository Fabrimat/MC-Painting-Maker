import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import EditorHeader from './EditorHeader.svelte';
import { project } from '../stores/project';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';
import { get } from 'svelte/store';

function seedWithPainting(name = 'Sunset'): string {
  const s = createEmptyProject();
  const p = createPaintingFromImage(name, { pngBase64: '', naturalW: 32, naturalH: 32 });
  s.paintings.push(p);
  project.set(s);
  return p.id;
}

describe('EditorHeader', () => {
  it('shows the painting name and a "click to rename" hint', () => {
    const id = seedWithPainting('Sunset');
    const { getByText } = render(EditorHeader, { props: { id } });
    expect(getByText('Sunset')).toBeTruthy();
    expect(getByText(/click to rename/i)).toBeTruthy();
  });

  it('click swaps the title for an input; Enter commits to the store', async () => {
    const id = seedWithPainting('Sunset');
    const { getByText, getByRole } = render(EditorHeader, { props: { id } });
    await fireEvent.click(getByText('Sunset'));
    const input = getByRole('textbox') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Dawn' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(get(project).paintings[0].name).toBe('Dawn');
  });

  it('Escape reverts to the old name and exits edit mode', async () => {
    const id = seedWithPainting('Sunset');
    const { getByText, getByRole, queryByRole } = render(EditorHeader, { props: { id } });
    await fireEvent.click(getByText('Sunset'));
    const input = getByRole('textbox') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Dawn' } });
    await fireEvent.keyDown(input, { key: 'Escape' });
    expect(get(project).paintings[0].name).toBe('Sunset');
    expect(queryByRole('textbox')).toBeNull();
  });

  it('rederivates the slug from the new name when the painting is unlocked', async () => {
    const id = seedWithPainting('Sunset');
    const { getByText, getByRole } = render(EditorHeader, { props: { id } });
    await fireEvent.click(getByText('Sunset'));
    const input = getByRole('textbox') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Mountain' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    const p = get(project).paintings[0];
    expect(p.name).toBe('Mountain');
    expect(p.slug).toMatch(/^mountain_[0-9a-f]{8}$/);
  });

  it('preserves the slug on rename when the painting is locked', async () => {
    const id = seedWithPainting('Sunset');
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id ? { ...p, slugLocked: true } : p),
    }));
    const beforeSlug = get(project).paintings[0].slug;
    const { getByText, getByRole } = render(EditorHeader, { props: { id } });
    await fireEvent.click(getByText('Sunset'));
    const input = getByRole('textbox') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Mountain' } });
    await fireEvent.keyDown(input, { key: 'Enter' });
    expect(get(project).paintings[0].name).toBe('Mountain');
    expect(get(project).paintings[0].slug).toBe(beforeSlug);
  });
});
