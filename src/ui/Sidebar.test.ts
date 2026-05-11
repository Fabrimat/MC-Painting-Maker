import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Sidebar from './Sidebar.svelte';
import { project } from '../stores/project';
import { createEmptyProject, createPaintingFromImage } from '../paintings/defaults';

describe('Sidebar', () => {
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
});
