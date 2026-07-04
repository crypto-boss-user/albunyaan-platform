/**
 * Albunyaan brand tokens — single source of truth for all app targets (web, mobile, TV).
 * Source: saraev landing rebuild (claude-course-saraev-ALBUNYAAN-rebuild) + docs/brand-manhaj.md.
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
    DEFAULT: '#fafaf8',
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

export const gradients = {
  hero: 'linear-gradient(165deg, #0c1a08 0%, #152e0c 40%, #1a3a10 70%, #0c1a08 100%)',
  textGreen: 'linear-gradient(135deg, #7bc74a, #447525)',
} as const;

export const fonts = {
  sans: 'Inter',
  serif: 'Playfair Display',
} as const;
