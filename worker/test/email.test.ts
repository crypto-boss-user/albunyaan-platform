import { describe, it, expect } from 'vitest';
import { normalizeEmail, isValidEmail } from '../lib/email.ts';

describe('normalizeEmail (PRD §4c: lowercase + trim, nothing cleverer)', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Daa3iyah@Hotmail.COM  ')).toBe('daa3iyah@hotmail.com');
  });
  it('strips wrapping quotes and angle brackets', () => {
    expect(normalizeEmail('"user@example.org"')).toBe('user@example.org');
    expect(normalizeEmail('<User@Example.org>')).toBe('user@example.org');
  });
  it('strips a mailto: prefix', () => {
    expect(normalizeEmail('mailto:User@Example.org')).toBe('user@example.org');
  });
  it('does NOT strip plus tags or gmail dots (must round-trip to Uscreen)', () => {
    expect(normalizeEmail('a.b+tag@Gmail.com')).toBe('a.b+tag@gmail.com');
  });
  it('handles tabs/newlines around the address', () => {
    expect(normalizeEmail('\tuser@example.org\n')).toBe('user@example.org');
  });
});

describe('isValidEmail', () => {
  it.each(['user@example.org', 'a.b+tag@sub.domain.co.uk', 'x_y-z@d.io'])('accepts %s', (e) => {
    expect(isValidEmail(e)).toBe(true);
  });
  it.each(['', '   ', 'not-an-email', 'a@b', 'a b@c.com', '@d.com', 'a@.com', 'a@@b.com'])(
    'rejects %j',
    (e) => {
      expect(isValidEmail(e)).toBe(false);
    },
  );
});
