import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { devLog } from './devlog';
import { devMode } from '../stores/devMode';

describe('devLog', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    devMode.set(false);
  });

  afterEach(() => {
    spy.mockRestore();
    devMode.set(false);
  });

  it('is a no-op when dev mode is off', () => {
    devLog('test', 'hello');
    expect(spy).not.toHaveBeenCalled();
  });

  it('forwards to console.log when dev mode is on', () => {
    devMode.set(true);
    devLog('build', 'start', { paintings: 3 });
    expect(spy).toHaveBeenCalledTimes(1);
    const [prefix, ...rest] = spy.mock.calls[0];
    expect(String(prefix)).toMatch(/^\[debug \d{2}:\d{2}:\d{2}\.\d{3}\] \[build\]/);
    expect(rest).toEqual(['start', { paintings: 3 }]);
  });

  it('reads dev mode lazily so toggling at runtime works', () => {
    devLog('test', 'before');
    expect(spy).not.toHaveBeenCalled();
    devMode.set(true);
    devLog('test', 'after');
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
