/**
 * Thin re-export so app code has a stable local import path; the actual
 * sanitizer lives in @albunyaan/core/sanitize (shared with the worker's
 * cloud backfill, worker/sanitize-descriptions.ts).
 */
export { sanitizeDescription } from '@albunyaan/core/sanitize';
