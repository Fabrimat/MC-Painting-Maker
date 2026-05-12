import { describe, it, expect, vi } from 'vitest';
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

  it('renders the In-game ID section showing namespace:slug', () => {
    const id = seed();
    const slug = get(project).paintings[0].slug;
    const ns = get(project).pack.namespace;
    const { getByText, getByLabelText } = render(PaintingProperties, { props: { id } });
    expect(getByText('In-game ID')).toBeTruthy();
    expect(getByText(`${ns}:`)).toBeTruthy();
    const input = getByLabelText('In-game slug') as HTMLInputElement;
    expect(input.value).toBe(slug);
  });

  it('reactively updates the namespace prefix when pack.namespace changes', async () => {
    const id = seed();
    const { getByText } = render(PaintingProperties, { props: { id } });
    expect(getByText('paintings:')).toBeTruthy();
    project.update((v) => ({ ...v, pack: { ...v.pack, namespace: 'custom_ns' } }));
    await Promise.resolve();
    expect(getByText('custom_ns:')).toBeTruthy();
  });

  it('Copy button writes "<namespace>:<slug>" to the clipboard', async () => {
    const id = seed();
    const ns = get(project).pack.namespace;
    const slug = get(project).paintings[0].slug;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const { getByRole } = render(PaintingProperties, { props: { id } });
    await fireEvent.click(getByRole('button', { name: 'Copy in-game ID' }));
    expect(writeText).toHaveBeenCalledWith(`${ns}:${slug}`);
  });

  it('lock button reflects slugLocked and toggles it on click', async () => {
    const id = seed();
    const { getByRole } = render(PaintingProperties, { props: { id } });
    const btn = getByRole('button', { name: /Lock|Unlock/ });
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    await fireEvent.click(btn);
    expect(get(project).paintings[0].slugLocked).toBe(true);
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    await fireEvent.click(btn);
    expect(get(project).paintings[0].slugLocked).toBe(false);
  });

  it('unlocking rederivates the slug from the current painting name', async () => {
    const id = seed();
    project.update((v) => ({
      ...v,
      paintings: v.paintings.map((p) => p.id === id
        ? { ...p, name: 'Mountain', slug: 'frozen_value', slugLocked: true }
        : p),
    }));
    const { getByRole } = render(PaintingProperties, { props: { id } });
    await fireEvent.click(getByRole('button', { name: /Unlock/ }));
    const p = get(project).paintings[0];
    expect(p.slugLocked).toBe(false);
    expect(p.slug).toMatch(/^mountain_[0-9a-f]{8}$/);
  });

  it('locking keeps the current slug unchanged', async () => {
    const id = seed();
    const before = get(project).paintings[0].slug;
    const { getByRole } = render(PaintingProperties, { props: { id } });
    await fireEvent.click(getByRole('button', { name: /Lock/ }));
    expect(get(project).paintings[0].slug).toBe(before);
    expect(get(project).paintings[0].slugLocked).toBe(true);
  });

  it('editing the slug auto-locks the painting and persists the value', async () => {
    const id = seed();
    const { getByLabelText } = render(PaintingProperties, { props: { id } });
    const input = getByLabelText('In-game slug') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'custom_slug' } });
    await fireEvent.blur(input);
    const p = get(project).paintings[0];
    expect(p.slug).toBe('custom_slug');
    expect(p.slugLocked).toBe(true);
  });

  it('shows an error and reverts on blur when the slug is invalid', async () => {
    const id = seed();
    const before = get(project).paintings[0].slug;
    const { getByLabelText, getByText } = render(PaintingProperties, { props: { id } });
    const input = getByLabelText('In-game slug') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Invalid-Slug!' } });
    expect(getByText(/lowercase a-z, 0-9, _/i)).toBeTruthy();
    await fireEvent.blur(input);
    expect(get(project).paintings[0].slug).toBe(before);
    expect(input.value).toBe(before);
  });

  it('rejects a slug longer than 32 characters', async () => {
    const id = seed();
    const before = get(project).paintings[0].slug;
    const { getByLabelText, getByText } = render(PaintingProperties, { props: { id } });
    const input = getByLabelText('In-game slug') as HTMLInputElement;
    const tooLong = 'a' + 'b'.repeat(32);
    await fireEvent.input(input, { target: { value: tooLong } });
    expect(getByText(/32 characters/i)).toBeTruthy();
    await fireEvent.blur(input);
    expect(get(project).paintings[0].slug).toBe(before);
  });

  it('rejects a slug that collides with another painting', async () => {
    const s = createEmptyProject();
    const a = createPaintingFromImage('A', { pngBase64: '', naturalW: 32, naturalH: 32 });
    const b = createPaintingFromImage('B', { pngBase64: '', naturalW: 32, naturalH: 32 });
    s.paintings.push(a, b);
    project.set(s);
    const beforeA = a.slug;
    const { getByLabelText, getByText } = render(PaintingProperties, { props: { id: a.id } });
    const input = getByLabelText('In-game slug') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: b.slug } });
    expect(getByText(/already used/i)).toBeTruthy();
    await fireEvent.blur(input);
    expect(get(project).paintings.find((p) => p.id === a.id)!.slug).toBe(beforeA);
  });

  it('accepts editing back to the existing slug (self is not a collision)', async () => {
    const id = seed();
    const before = get(project).paintings[0].slug;
    const { getByLabelText } = render(PaintingProperties, { props: { id } });
    const input = getByLabelText('In-game slug') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: before } });
    await fireEvent.blur(input);
    expect(get(project).paintings[0].slug).toBe(before);
  });
});
