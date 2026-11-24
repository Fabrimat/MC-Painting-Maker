import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import NewsBanner from './NewsBanner.svelte';

describe('NewsBanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('announces floor/ceiling placement until dismissed, then stays hidden', async () => {
    const first = render(NewsBanner);
    expect(first.getByRole('status').textContent).toMatch(/floors and ceilings/);
    await fireEvent.click(first.getByLabelText('Dismiss'));
    expect(first.queryByRole('status')).toBeNull();
    first.unmount();

    const second = render(NewsBanner);
    expect(second.queryByRole('status')).toBeNull();
  });
});
