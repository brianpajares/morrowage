# CLAUDE.md · reglas para agentes de código

## Fuente de verdad
Lee primero `README_START_HERE.md`, `docs/PRD.md`, `TASKS.md` y `docs/ACCEPTANCE_TESTS.md`. El motor se rige por `model/engine_reference.py` y `spec/test_vectors.json`.

## Comandos obligatorios
```bash
npm run lint
npm run typecheck
npm test
npm run test:vectors
npm run test:e2e
npm run build
```
Antes de tocar Drive real:
```bash
npm run drive:sync
```
solo con credenciales configuradas y manifest válido.

## Reglas
- TypeScript strict; no `any` no justificado.
- No inventar requisitos, coeficientes, rangos, outputs ni copy clínico.
- 18/18 vectores antes de mergear cambios del motor.
- No mostrar raw MorrowAge fuera de 40–69.
- No habilitar mortalidad absoluta 10y ni country percentile.
- No health data/email/token/report URL en analytics, logs o admin.
- `MONETIZATION_MODE=validation` y `STRIPE_ENABLED=false` por defecto.
- Owner email de validation sigue el PRD; datos sensibles solo en el sistema operacional de email.
- Todas las escrituras públicas pasan por route handlers, validación, rate limit y auth/Turnstile donde aplique.
- RLS activo en todas las tablas.
- Decisiones nuevas en `DECISIONS.md`.
- No secretos reales en repo.
- No cerrar trabajo con marcadores pendientes, stubs o tests ignorados.

## Convenciones
- App Router y Server Components por defecto.
- Client Components solo donde haya interacción real.
- Módulo canónico `src/lib/model/` para engine.
- `src/lib/analytics/` con allowlist central.
- `src/lib/drive/` con last-known-good.
- `src/lib/security/` para Turnstile/rate limit/tokens.
- `src/emails/` para Resend.
- `src/reports/` para web/PDF.
- `supabase/migrations/` versionado.
- Tests junto a dominio + `tests/e2e/`.

## Cambios sensibles
Cualquier cambio en modelo, claims, privacidad, monetización, esquema o i18n debe actualizar tests y `DECISIONS.md`.
