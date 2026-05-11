import { describe, it, expect } from 'vitest';
import { generatePaintingSlug } from './slug';

const UUID = 'a3f8b1c2-1234-5678-9abc-deadbeefcafe';

describe('generatePaintingSlug', () => {
  it('builds <name>_<uuid8> for a simple alphanumeric name', () => {
    expect(generatePaintingSlug('Sunset', UUID)).toBe('sunset_a3f8b1c2');
  });

  it('lowercases the name part', () => {
    expect(generatePaintingSlug('MOUNTAIN', UUID)).toBe('mountain_a3f8b1c2');
  });

  it('replaces non-alphanumeric runs with a single underscore', () => {
    expect(generatePaintingSlug('Hello, World!', UUID)).toBe('hello_world_a3f8b1c2');
  });

  it('strips diacritics so accented letters reduce to ASCII base letters', () => {
    expect(generatePaintingSlug('Café au lait', UUID)).toBe('cafe_au_lait_a3f8b1c2');
  });

  it('trims leading and trailing underscores from the name part', () => {
    expect(generatePaintingSlug('---hello---', UUID)).toBe('hello_a3f8b1c2');
  });

  it('truncates the name part to 20 characters', () => {
    expect(generatePaintingSlug('the quick brown fox jumps over', UUID))
      .toBe('the_quick_brown_fox_a3f8b1c2');
  });

  it('trims a trailing underscore created by truncation', () => {
    // After replace + slice(0,20), this leaves "twenty_chars_long_na" - then truncated
    // results that end with _ should still be cleaned.
    expect(generatePaintingSlug('twenty_chars_long_x_zzz', UUID))
      .toBe('twenty_chars_long_x_a3f8b1c2');
    expect(generatePaintingSlug('abcdefghijklmnopqrst_uvw', UUID))
      .toBe('abcdefghijklmnopqrst_a3f8b1c2');
  });

  it('falls back to p_<uuid8> when the name sanitises to empty', () => {
    expect(generatePaintingSlug('🎨🎨', UUID)).toBe('p_a3f8b1c2');
    expect(generatePaintingSlug('!!!', UUID)).toBe('p_a3f8b1c2');
    expect(generatePaintingSlug('', UUID)).toBe('p_a3f8b1c2');
  });

  it('prefixes p_ when the sanitised name would start with a digit', () => {
    expect(generatePaintingSlug('123 paintings', UUID)).toBe('p_123_paintings_a3f8b1c2');
    expect(generatePaintingSlug('5', UUID)).toBe('p_5_a3f8b1c2');
  });

  it('uses the first 8 hex chars of the uuid, lowercased and de-hyphenated', () => {
    expect(generatePaintingSlug('x', 'DEADBEEF-1111-2222-3333-444455556666')).toBe('x_deadbeef');
  });
});
