import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from '@/lib/observability/sentry-scrub';

/** Sentry en servidor (Node y Edge) con scrubbing obligatorio. Sin DSN queda desactivado. */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || /REPLACE_ME/.test(dsn)) return;
  Sentry.init({
    dsn,
    enabled: true,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.APP_VERSION,
    tracesSampleRate: 0.1,
    maxBreadcrumbs: 20,
    beforeSend: (event) => scrubSentryEvent(event),
    beforeSendTransaction: (event) => scrubSentryEvent(event),
  });
}

export const onRequestError = Sentry.captureRequestError;
