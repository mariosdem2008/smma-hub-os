import { describe, expect, it } from 'vitest';
import { sanitizeText } from '../sanitize';

describe('sanitizeText', () => {
  it('returns null for blocked tokens', () => {
    expect(sanitizeText('pp compliance checklist')).toBeNull();
    expect(sanitizeText('Strong pr motion')).toBeNull();
  });

  it('returns null for short strings', () => {
    expect(sanitizeText('short')).toBeNull();
  });

  it('returns null for single word strings', () => {
    expect(sanitizeText('Wordenough')).toBeNull();
  });

  it('returns null for truncated endings', () => {
    expect(sanitizeText('This ends ab')).toBeNull();
  });

  it('returns normalized string for valid input', () => {
    expect(sanitizeText('  Clear value with spacing  ')).toBe('Clear value with spacing');
  });
});