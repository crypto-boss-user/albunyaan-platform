import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

// Inert until SENTRY_DSN exists (captureRequestError no-ops without a live
// Sentry.init dsn) — see instrumentation-client.ts.
export const onRequestError = Sentry.captureRequestError;
