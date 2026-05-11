import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import PaintingProperties from './PaintingProperties.svelte';
import { project } from '../stores/project';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';

function seed(): string {
  const s = createEmptyProject();
  const p = createPaintingFromImage('Sunset', { pngBase64: '', naturalW: 32, naturalH: 32 });
  s.paintings.push(p);
  project.set(s);
  return p.id;
}

describe('PaintingProperties', () => {
  it('renders the three friendly section titles', () => {
    const id = seed();
    const { getByText } = render(PaintingProperties, { props: { id } });
    expect(getByText('Canvas size')).toBeTruthy();
    expect(getByText('Texture quality')).toBeTruthy();
    expect(getByText('Transparency')).toBeTruthy();
  });

  it('Cutout / Blended pill writes alphatest / alphablend to the schema', async () => {
    const id = seed();
    const { getByRole } = render(PaintingProperties, { props: { id } });
    await fireEvent.click(getByRole('radio', { name: /Blended/ }));
    expect(get(project).paintings[0].material).toBe('alphablend');
    await fireEvent.click(getByRole('radio', { name: /Cutout/ }));
    expect(get(project).paintings[0].material).toBe('alphatest');
  });

  it('Smooth / Pixel art pill writes smooth / pixelated to the schema', async () => {
    const id = seed();
    const { getByRole } = render(PaintingProperties, { props: { id } });
    await fireEvent.click(getByRole('radio', { name: /Pixel art/ }));
    expect(get(project).paintings[0].resampling).toBe('pixelated');
    await fireEvent.click(getByRole('radio', { name: /Smooth/ }));
    expect(get(project).paintings[0].resampling).toBe('smooth');
  });

  it('Width input updates canvasW16 to round(blocks * 16)', async () => {
    const id = seed();
    const { getByLabelText } = render(PaintingProperties, { props: { id } });
    const w = getByLabelText(/Width in blocks/) as HTMLInputElement;
    await fireEvent.input(w, { target: { value: '2.5' } });
    expect(get(project).paintings[0].canvasW16).toBe(40);
  });
});
