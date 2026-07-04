/**
 * Email normalization per PRD §4c: lowercase + trim. Nothing cleverer —
 * no gmail-dot stripping, no plus-tag removal: the normalized value must
 * still round-trip to the address Uscreen has on file.
 */

/** Lowercase + trim (also strips stray wrapping quotes and a mailto: prefix VoiceInk/Excel exports sometimes leak in). */
export function normalizeEmail(input: string): string {
  let e = input.trim();
  if (e.toLowerCase().startsWith('mailto:')) e = e.slice(7);
  // strip symmetric wrapping quotes/angle brackets: "x@y.z", <x@y.z>
  while (
    (e.startsWith('"') && e.endsWith('"')) ||
    (e.startsWith("'") && e.endsWith("'")) ||
    (e.startsWith('<') && e.endsWith('>'))
  ) {
    e = e.slice(1, -1).trim();
  }
  return e.trim().toLowerCase();
}

/**
 * Basic structural validity — used by PRD §7 integrity checks
 * ("email format valid on all people/leads"). Deliberately loose:
 * local@domain.tld with no whitespace. We flag, we never "fix".
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
