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
});
