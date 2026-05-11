import { describe, it, expect } from 'vitest';
import { sanitizeId, entityId, paintingFileBase } from './identifiers';

describe('identifiers', () => {
  it('sanitizes a UUID to snake_case', () => {
    expect(sanitizeId('a3f8b1c2-1234-5678-9abc-deadbeefcafe'))
      .toBe('a3f8b1c2_1234_5678_9abc_deadbeefcafe');
  });

  it('builds the entity identifier as <ns>:painting_<sanitized>', () => {
    expect(entityId('myart', 'a3f8-12'))
      .toBe('myart:painting_a3f8_12');
  });

  it('builds the file base as painting_<sanitized>', () => {
    expect(paintingFileBase('a3f8-12')).toBe('painting_a3f8_12');
  });
});
