import * as Sentry from '@sentry/nextjs';

// Inert until SENTRY_DSN exists — see instrumentation-client.ts.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
