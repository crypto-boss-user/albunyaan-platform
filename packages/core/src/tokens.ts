/**
 * Albunyaan brand tokens — single source of truth for all app targets (web, mobile, TV).
 * Norm since SR 4 stap 1 (2026-09-05, B13): the MEASURED albunyaan.tv storefront (Uscreen theme "Glow",
 * reference/storefront-2026-09/sr2b-2026-09-04/admin/thema/theme-customization.json): primary #447525,
 * colour scheme Light (white background, no dark sections), heading + body font Cairo.
 * The earlier "saraev rebuild" skin is no longer the norm (plan §1 rule 9). One swap for every target (§7 T16).
 * Web consumes these via the @theme block in apps/web/app/globals.css (keep in sync);
 * React Native targets import this module directly.
 */
export const colors = {
  brand: {
    DEFAULT: '#447525',
    light: '#5a9e32',
    dark: '#335a1c',
    soft: '#e8f5e0',
    muted: '#f0f7ec',
  },
  surface: {
    /** Light scheme (Uscreen "Glow", Theme Customization → Color scheme: Light): page background is white. */
    DEFAULT: '#ffffff',
    warm: '#f5f5f0',
    card: '#ffffff',
    dark: '#0c1a08',
    deep: '#091406',
  },
  text: {
    primary: '#1a1a1a',
    secondary: '#555555',
    muted: '#888888',
    inverse: '#ffffff',
  },
} as const;

/** Dark hero gradient removed 2026-09-05 (SR 4 stap 1, B13: Light scheme — the storefront has no dark hero/footer). */
export const gradients = {
  textGreen: 'linear-gradient(135deg, #7bc74a, #447525)',
} as const;

/** Measured on albunyaan.tv (SR 2b Theme Customization): heading font Cairo, body font Cairo. */
export const fonts = {
  sans: 'Cairo',
  serif: 'Cairo',
} as const;
