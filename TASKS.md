# TASKS · MorrowAge M0–M5

## M0 · Scaffold y contratos
- [ ] Next.js App Router + TypeScript strict.
- [ ] Tailwind + shadcn/ui + next-intl.
- [ ] ESLint, Prettier, Vitest, Playwright.
- [ ] Cargar `.env.example` con validación de env.
- [ ] Copiar `spec/db_schema.sql` a migración Supabase.
- [ ] Generar/usar tipos para inputs/outputs.
- [ ] Implementar headers de seguridad base.
**Aceptación:** `npm run lint`, `typecheck`, `build` pasan; AT-31 base.

## M1 · Motor + Drive
- [ ] Portar engine v2.1 a TS.
- [ ] Tests 18/18 golden vectors.
- [ ] Conversiones unidades y display guardrails.
- [ ] Drive loader por path/nombre + SHA-256.
- [ ] Cache 24h + last-known-good.
- [ ] `scripts/drive-sync.ts` + `npm run drive:sync`.
**Aceptación:** AT-03–08, AT-22–23.

## M2 · Funnel validation + report
- [ ] Landing/scope/8-step assessment.
- [ ] Reaction test versionado.
- [ ] Processing + preview.
- [ ] Email gate con consentimientos.
- [ ] Persistencia `calculations`/`leads`.
- [ ] Report web + PDF.
- [ ] Resend al usuario.
- [ ] Owner email con asunto, inputs, resultados y PDF.
- [ ] Tokens hash + expiración.
**Aceptación:** AT-01–14.

## M3 · Admin, privacidad, analítica, i18n
- [ ] Supabase Auth admin + safe view.
- [ ] Leads/funnel/re-send.
- [ ] Delete request.
- [ ] PostHog allowlist.
- [ ] Sentry scrub.
- [ ] Turnstile + rate limit.
- [ ] ES/EN/PT completo.
- [ ] Accessibility WCAG 2.2 AA.
**Aceptación:** AT-15–17, AT-20–21, AT-25–27, AT-32–33.

## M4 · Stripe detrás de feature flag
- [ ] `MONETIZATION_MODE` + `STRIPE_ENABLED`.
- [ ] Checkout Session.
- [ ] Webhook raw body + signature.
- [ ] Idempotencia en `stripe_webhook_events`.
- [ ] Pedido y entrega automática PDF.
- [ ] Sandbox tests; producción sigue disabled.
**Aceptación:** AT-18–19, AT-28.

## M5 · Hardening, CI y launch
- [ ] GitHub Actions completa.
- [ ] Lighthouse móvil >=90.
- [ ] p95 route handlers <2s.
- [ ] Cost telemetry.
- [ ] Legal/privacy/terms pages.
- [ ] SEO/noindex/canonicals.
- [ ] SPF/DKIM/DMARC checklist.
- [ ] Runbooks y rollback.
- [ ] Smoke real end-to-end con datos sintéticos.
- [ ] Ejecutar `docs/LAUNCH_CHECKLIST.md`.
**Aceptación:** AT-29–36 y Definition of Done del PRD.
