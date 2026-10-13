/**
 * Sentry en el navegador: se carga de forma diferida (idle) para no penalizar LCP/TBT y solo si hay DSN.
 * Siempre con scrubbing y sin PII por defecto.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn && !/REPLACE_ME/.test(dsn)) {
  const boot = () => {
    void Promise.all([import('@sentry/nextjs'), import('@/lib/observability/sentry-scrub')]).then(([Sentry, { scrubSentryEvent }]) => {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_APP_VERSION,
        tracesSampleRate: 0.05,
        maxBreadcrumbs: 20,
        integrations: [],
        beforeSend: (event) => scrubSentryEvent(event),
        beforeSendTransaction: (event) => scrubSentryEvent(event),
      });
    });
  };
  if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(boot);
  else setTimeout(boot, 2000);
}

export {};
