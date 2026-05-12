import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PaintingList from './PaintingList.svelte';
import type { Painting } from '../paintings/types';

function painting(id: string, name: string): Painting {
  return {
    id,
    name,
    canvasW16: 32,
    canvasH16: 32,
    transform: { x16: 0, y16: 0, w16: 32, h16: 32, rotation: 0, flipX: false, flipY: false },
    source: null,
    textureDensity: 'auto',
    resampling: 'smooth',
    material: 'alphatest',
  } as Painting;
}

describe('PaintingList', () => {
  beforeEach(() => {
    // Clean up DOM between tests
    document.body.innerHTML = '';
  });

  it('renders one row per painting with name and size', () => {
    const { getByText, getAllByText } = render(PaintingList, {
      props: {
        paintings: [painting('a', 'Sunset'), painting('b', 'Forest')],
        selectedId: null,
      },
    });
    expect(getByText('Sunset')).toBeTruthy();
    expect(getByText('Forest')).toBeTruthy();
    expect(getAllByText('2.00 × 2.00 blocks').length).toBe(2);
  });

  it('does NOT render a rename input on rows', () => {
    const { container } = render(PaintingList, {
      props: { paintings: [painting('a', 'Sunset')], selectedId: null },
    });
    expect(container.querySelectorAll('input[type="text"]').length).toBe(0);
  });

  it('calls onselect when a row is clicked', async () => {
    const onselect = vi.fn();
    const { getByRole } = render(PaintingList, {
      props: { paintings: [painting('a', 'Sunset')], selectedId: null, onselect },
    });
    await fireEvent.click(
      getByRole('button', { name: /Select Sunset/ })
    );
    expect(onselect).toHaveBeenCalledWith('a');
  });

  it('calls onremove when the delete button is clicked', async () => {
    const onremove = vi.fn();
    const { getAllByRole } = render(PaintingList, {
      props: { paintings: [painting('a', 'Sunset')], selectedId: 'a', onremove },
    });
    const deleteButtons = getAllByRole('button', { name: /Delete Sunset/ });
    await fireEvent.click(deleteButtons[0]);
    expect(onremove).toHaveBeenCalledWith('a');
  });
});
