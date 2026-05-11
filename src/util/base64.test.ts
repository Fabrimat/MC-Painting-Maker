import { describe, it, expect } from 'vitest';
import { uint8ToBase64, base64ToUint8 } from './base64';

describe('base64 helpers', () => {
  it('round-trips bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    const b64 = uint8ToBase64(bytes);
    const back = base64ToUint8(b64);
    expect(Array.from(back)).toEqual(Array.from(bytes));
  });

  it('round-trips a large array that exceeds the CHUNK size', () => {
    const big = new Uint8Array(40000);
    for (let i = 0; i < big.length; i++) big[i] = i & 0xff;
    const b64 = uint8ToBase64(big);
    const back = base64ToUint8(b64);
    expect(back.length).toBe(big.length);
    // Spot-check a handful of indices and the boundary
    expect(back[0]).toBe(big[0]);
    expect(back[0x8000 - 1]).toBe(big[0x8000 - 1]);
    expect(back[0x8000]).toBe(big[0x8000]);
    expect(back[big.length - 1]).toBe(big[big.length - 1]);
  });
});
