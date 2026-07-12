/**
 * Signed Bunny Stream embed URLs — WS5 playback lockdown.
 *
 * Once "Embed View Token Authentication" is enabled on the Bunny library, the
 * iframe embed only loads with a valid `?token=&expires=` pair, where
 *   token = SHA256_HEX(tokenAuthKey + videoId + expires)
 * (Bunny's documented embed-signing scheme; proven against the real library by
 * worker/verify-playback-lockdown.ts before the flip is trusted.)
 *
 * The signing key is server-only (BUNNY_EMBED_TOKEN_KEY — never NEXT_PUBLIC_).
 * While it is unset (pre-flip environments), URLs are emitted unsigned, which
 * the library accepts until token auth is switched on; after the flip a
 * missing key fails VISIBLY (embed refuses to load), never silently open.
 */
import { createHash } from 'node:crypto';

/** Token lifetime. Validated when the embed LOADS — generous enough for long lectures. */
const EMBED_TOKEN_TTL_SECONDS = 6 * 60 * 60;

export function signedEmbedUrl(bunnyVideoId: string): string | null {
  const libraryId = process.env.NEXT_PUBLIC_BUNNY_LIBRARY_ID;
  if (!libraryId) return null;
  const base = `https://iframe.mediadelivery.net/embed/${libraryId}/${bunnyVideoId}?autoplay=false&preload=true`;

  const key = process.env.BUNNY_EMBED_TOKEN_KEY;
  if (!key) return base;

  const expires = Math.floor(Date.now() / 1000) + EMBED_TOKEN_TTL_SECONDS;
  const token = createHash('sha256').update(`${key}${bunnyVideoId}${expires}`).digest('hex');
  return `${base}&token=${token}&expires=${expires}`;
}
