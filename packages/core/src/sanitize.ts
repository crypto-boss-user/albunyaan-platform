/**
 * Server-side HTML sanitizer for video/collection descriptions.
 *
 * The descriptions were scraped from Uscreen as rich-text HTML and are
 * rendered with dangerouslySetInnerHTML on an origin that carries auth
 * cookies (and soon billing) — so anything short of a strict allowlist is
 * account-takeover-grade stored XSS. This module is the single source of
 * truth for what description HTML may contain; both the web render path
 * (apps/web/lib/sanitize.ts) and the cloud backfill
 * (worker/sanitize-descriptions.ts) import it.
 *
 * Kept in @albunyaan/core (pure Node, no DOM deps) under its own subpath
 * export so client bundles that import @albunyaan/core/data never pull in
 * sanitize-html.
 */
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'p', 'br', 'b', 'strong', 'i', 'em', 'u',
  'ul', 'ol', 'li', 'a', 'h3', 'h4', 'blockquote',
];

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  // No style/class/id anywhere. <a> may only carry href/rel and target="_blank".
  allowedAttributes: {
    a: ['href', 'rel', { name: 'target', values: ['_blank'] }],
  },
  allowedSchemes: ['http', 'https'],
  allowProtocolRelative: false,
  // Disallowed tags collapse to their text content (default 'discard' keeps
  // inner text; script/style/textarea/option content is dropped entirely via
  // sanitize-html's nonTextTags default — code is not prose).
  disallowedTagsMode: 'discard',
  transformTags: {
    // Force safe rel on every link; keep target only when it is _blank.
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...(attribs.href ? { href: attribs.href } : {}),
        ...(attribs.target === '_blank' ? { target: '_blank' } : {}),
        rel: 'noopener noreferrer nofollow',
      },
    }),
  },
  // decodeEntities (htmlparser2 default via sanitize-html) decodes input
  // entities; output escaping only touches & < > " — Arabic/RTL text passes
  // through byte-identical, never entity-encoded.
  parser: { decodeEntities: true },
};

/** Sanitize scraped rich-text description HTML down to the allowlist above. */
export function sanitizeDescription(html: string): string {
  if (!html) return '';
  return sanitizeHtml(html, OPTIONS);
}
