# BUILD_PROMPT · pegar como primer mensaje al LLM programador

Actúa como Staff Engineer + Product Engineer responsable de construir y desplegar el MVP de **MorrowAge** desde este repositorio vacío ya poblado con el paquete BUILD v4. No hagas preguntas: resuelve ambigüedades con criterio conservador, no inventes requisitos y registra cualquier decisión material en `DECISIONS.md`.

## Objetivo
Entregar una app web production-ready en Next.js App Router que implemente exactamente `docs/PRD.md`, pase `docs/ACCEPTANCE_TESTS.md`, pueda desplegarse en Vercel desde GitHub y lea sus assets versionados desde Google Drive. Netlify es alternativa, no objetivo primario.

## Reglas de precedencia
1. `spec/test_vectors.json` + `model/engine_reference.py` para matemática.
2. `spec/inputs.schema.json`, `spec/outputs_spec.json`, `spec/model_spec.json` para contrato de datos.
3. `docs/PRD.md` para producto/arquitectura.
4. `ux/` + `spec/design_tokens.json` + `spec/copy_i18n.json` para UI/copy.
5. `spec/openapi.yaml` + `spec/db_schema.sql` para API/DB.
6. Ante conflicto, el guardrail más seguro y más reciente gana; documenta la decisión en `DECISIONS.md`.

## Stack obligatorio
- Next.js App Router + React + TypeScript strict.
- Tailwind + shadcn/ui.
- Route Handlers; no FastAPI.
- Motor en TypeScript portado de `model/engine_reference.py`.
- Supabase Postgres + RLS.
- Google Drive API service account.
- Resend.
- `@react-pdf/renderer`.
- `next-intl` para `es`, `en`, `pt`.
- PostHog + Sentry con scrubbing.
- Cloudflare Turnstile + rate limit.
- Vitest + Playwright.
- GitHub Actions.
- Stripe detrás de `MONETIZATION_MODE=stripe` y `STRIPE_ENABLED=true`.

## Orden de trabajo
1. Lee `README_START_HERE.md`, `docs/PRD.md`, `TASKS.md`, specs y UX.
2. Scaffold de Next.js; configura strict TS, lint, tests, i18n, Tailwind/shadcn.
3. Porta el motor y haz pasar 18/18 vectores antes de construir UI.
4. Implementa DB/migrations/RLS desde `spec/db_schema.sql`.
5. Implementa Drive loader + checksum + cache 24h + last-known-good + `npm run drive:sync`.
6. Implementa assessment, preview, gate validation, report web/PDF y emails.
7. Implementa admin mínimo sin health payload.
8. Integra PostHog/Sentry/Turnstile/rate limit.
9. Implementa Stripe sandbox detrás de flags.
10. Añade CI, tests e2e, seguridad, performance y docs operativos.
11. Ejecuta todos los acceptance tests y corrige hasta verde.
12. Prepara despliegue Vercel y ejecuta smoke test de punta a punta con valores sintéticos.

## Reglas de producto
- No llames al resultado “biological age”.
- No calcules ni muestres mortalidad absoluta 10y.
- No muestres percentiles nacionales.
- No muestres raw MorrowAge exacto fuera de 40–69 a usuario.
- No derives recomendaciones causales del signo de coeficientes.
- No envíes health inputs, raw result, email, report token o URL a PostHog.
- `/admin` no muestra inputs/resultados/tokens.
- En `validation`, el owner email sí debe contener inputs, resultados y PDF completo según PRD, pero jamás copies ese payload a analytics/admin/logs.
- Marketing opt-in separado del consentimiento de servicio.
- Stripe apagado por defecto.

## Convenciones
- No duplicar coeficientes en múltiples archivos: un módulo canónico TypeScript.
- Zod o validación equivalente en todos los boundaries.
- Tokens de report aleatorios, persistidos solo como hash.
- IDs/UUIDs no deben derivarse de email o health data.
- Tests deben usar datos sintéticos.
- No guardar secretos en repo.
- No dejar marcadores pendientes, pendientes críticos, stubs o mocks en producción.
- Si agregas un requisito o cambias una decisión, registra fecha/motivo en `DECISIONS.md`.

## Entregables
- Código completo y ejecutable.
- Migrations Supabase.
- Scripts Drive.
- Emails y PDF.
- Admin.
- Stripe sandbox detrás de flags.
- CI.
- Tests unit/integration/e2e.
- `DECISIONS.md`.
- README de desarrollo/despliegue.
- Evidencia de acceptance tests.
- URL de preview/production cuando el entorno lo permita.

## Definition of Done
Cumple la sección 28 de `docs/PRD.md` y todos los AT de `docs/ACCEPTANCE_TESTS.md`. No declares terminado mientras falle un test crítico, un vector, RLS, Drive fallback, email end-to-end, Lighthouse>=90 o p95<2s.
