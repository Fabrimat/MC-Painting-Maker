import { describe, it, expect } from 'vitest';
import { uint8ToBase64, base64ToUint8 } from './base64';

describe('base64 helpers', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const b64 = uint8ToBase64(bytes);
    const back = base64ToUint8(b64);
    expect(Array.from(back)).toEqual(Array.from(bytes));
  });
});
