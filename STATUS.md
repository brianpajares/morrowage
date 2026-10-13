# STATUS · MorrowAge (construcción interrumpida por límite de uso — 2026-10-07)

Repo local: `C:\Users\brian.pajares\dev\morrowage` (fuera de OneDrive a propósito: `node_modules` rompe la sincronización).
**No está en GitHub ni desplegado en Vercel todavía. No hay URL.**

## Hecho y verificado con tests
- Paquete BUILD v4 copiado al repo (docs/, spec/, model/, ux/, drive/…).
- Motor TS portado de `engine_reference.py`: **18/18 vectores** (`npm run test:vectors`), paridad XLSX↔JSON.
- Validación de inputs desde `spec/inputs.schema.json`, display seguro `<40`/`>69`, conversiones de unidades, escenarios what-if.
- Drive: cliente service account, SHA-256, cache 24 h, last-known-good (memoria → /tmp → snapshot empaquetado), `npm run drive:sync` (+ `--dry-run`). 11 tests.
- Migraciones Supabase + RLS probadas en Postgres real en proceso (PGlite): 8 tests (AT-33).
- Seguridad: tokens hasheados, rate limit (Upstash o memoria), Turnstile, logger/Sentry con redacción, allowlist de analítica.
- Stores (Supabase y memoria), `/api/calculate`, `/api/events`, `/api/health`.
- i18n ES/EN/PT tipado (paridad por compilador), landing, header/footer, UI base, PDF de 8 páginas (5 tests).

## Pendiente (en orden)
1. PDF: el **footer fijo no aparece** en el texto extraído (el encabezado sí). Revisar visualmente `.scratch/sample-TC01-es.pdf` (`npx tsx scripts/sample-pdf.ts`).
2. Servicios: `leads`, `delivery` (PDF + emails usuario/owner), `report` por token, borrado, admin, Stripe (flags), cron de purga.
3. Rutas API restantes y páginas: calculate (8 pasos + test de reacción), processing, preview, report-request, success, report, metodología, FAQ, privacidad, términos, SEO por país/guías, admin.
4. Mensajes pendientes: legal, SEO, admin; test de paridad de mensajes.
5. Tests: unit de servicios, e2e Playwright, axe, Lighthouse, p95, escaneo de logs/placeholders; CI en GitHub Actions; README; evidencia de AT-01…36.
6. Despliegue: crear repo GitHub (no hay `gh` ni credenciales; hacerlo desde el navegador o con `gh auth login`), proyecto Vercel (equipo personal), proyecto Supabase (**tiene costo: confirmar antes**) y variables de entorno.

## Variables que necesito de ti para monetizar
`RESEND_API_KEY` + dominio verificado (SPF/DKIM/DMARC), `OWNER_EMAIL`, Turnstile, Upstash, PostHog, Sentry, credenciales de Google Drive. Sin ellas la app degrada de forma segura (ver `/api/health` con `Authorization: Bearer $CRON_SECRET`).
