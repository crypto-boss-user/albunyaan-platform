import * as Sentry from '@sentry/nextjs';

// Inert until SENTRY_DSN exists (founder hasn't created the Sentry project
// yet — see docs/founder-runbook.md). Sentry.init() with dsn=undefined is a
// documented no-op: no network calls, no console noise.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Session replay is off by default (extra script weight + PII surface on
  // a family-content site) — enable deliberately later if it's wanted.
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
