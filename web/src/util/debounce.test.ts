import { describe, it, expect, vi } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  it('calls only once after rapid invocations', async () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const fn = debounce(spy, 100);
    fn();
    fn();
    fn();
    vi.advanceTimersByTime(99);
    expect(spy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('passes the latest arguments through', () => {
    vi.useFakeTimers();
    const spy = vi.fn();
    const fn = debounce(spy, 50);
    fn(1);
    fn(2);
    vi.advanceTimersByTime(50);
    expect(spy).toHaveBeenCalledWith(2);
    vi.useRealTimers();
  });
});
