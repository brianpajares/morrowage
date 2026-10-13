# MorrowAge

Edad equivalente de riesgo poblacional (modelo v2.1) con informe web + PDF. **No es edad biológica, ni diagnóstico, ni riesgo absoluto a 10 años.**
Next.js 16 (App Router) · TypeScript strict · Tailwind 4 · next-intl (ES/EN/PT) · Supabase · Google Drive · Resend · `@react-pdf/renderer` · Stripe detrás de feature flag.

> Fuente de verdad del producto: `docs/PRD.md`, `docs/ACCEPTANCE_TESTS.md`, `spec/` y `ux/` (paquete BUILD v4). Decisiones de implementación: `DECISIONS.md`. Estado y evidencia: `docs/evidence/`.

## Inicio rápido

```bash
npm install
cp .env.example .env.local   # los valores REPLACE_ME / YOUR_* se tratan como "no configurado"
npm run dev                  # http://localhost:3000  (sin Supabase usa un store en memoria solo en desarrollo)
```

Sin ninguna credencial la app calcula y muestra la vista previa; la entrega por email, Drive remoto, Turnstile, analítica, etc. se activan al configurar sus variables. `GET /api/health` con `Authorization: Bearer $CRON_SECRET` lista qué capacidades están activas.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run lint` · `typecheck` · `test` | ESLint · `tsc --noEmit` · Vitest (unit + integración + RLS en PGlite) |
| `npm run test:vectors` | 18/18 vectores de oro contra `spec/test_vectors.json` (rel_tol 1e-6) |
| `npm run test:e2e` | Playwright (móvil 360 y escritorio 1280, axe, funnel completo). Requiere `npm run build` |
| `npm run build` | Build de producción |
| `npm run drive:sync` | Sube `drive/` a `GOOGLE_DRIVE_FOLDER_ID` verificando SHA-256 (`-- --dry-run` valida sin credenciales) |
| `npm run check:placeholders` · `check:drive` | AT-36 (marcadores/secretos) · manifest ↔ `drive/` |
| `BASE_URL=… npm run perf:api` | p95 de route handlers (AT-29) |

## Arquitectura

```
src/lib/model/        motor TS (port de engine_reference.py), validación, display seguro, unidades, escenarios
src/lib/drive/        cliente Drive (service account), SHA-256, cache 24 h, last-known-good, snapshot empaquetado
src/lib/security/     tokens (hash), rate limit (Upstash | memoria), Turnstile
src/lib/analytics/    allowlist central (spec/analytics_events.json)
src/server/           servicios (calculate, leads, delivery, report, stripe, admin, cron) + Store (Supabase | memoria)
src/reports/pdf/      PDF de 8 páginas
src/emails/…          plantillas en src/server/email/
src/app/[locale]/…    páginas ES/EN/PT · src/app/api/… route handlers · src/app/admin/… panel
supabase/migrations/  esquema + RLS (spec/db_schema.sql) y operaciones (contadores sin PII, purga)
```

Garantías de privacidad que los tests comprueban: raw MorrowAge nunca visible fuera de 40–69 (DOM, PDF, API), analítica y admin sin inputs/resultados/tokens, tokens solo como hash, logs sin PII, RLS (el admin del frontend no lee `calculations`).

## Despliegue (Vercel + GitHub + Supabase)

1. **Supabase**: crear proyecto y aplicar `supabase/migrations/*.sql` (en orden). Crear el usuario admin en Auth y `insert into admin_users(user_id) values ('<uuid>')`.
2. **Google Drive**: crear `/Apps/morrowage`, compartirla con la service account y ejecutar `npm run drive:sync`. (Sin Drive, la app usa el snapshot empaquetado verificado por SHA-256.)
3. **Resend**: verificar dominio (SPF/DKIM/DMARC) y fijar `EMAIL_FROM`, `OWNER_EMAIL`.
4. **Vercel**: importar el repo de GitHub y definir las variables de `.env.example` (más `CRON_SECRET`, opcional `SESSION_PEPPER` y `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`). `vercel.json` programa el cron diario de purga/reintentos.
5. **Stripe** permanece apagado (`MONETIZATION_MODE=validation`, `STRIPE_ENABLED=false`). Activar solo con evidencia de tracción y revisión legal (`docs/LAUNCH_CHECKLIST.md`).

## Operación

Runbooks en `docs/RUNBOOKS.md`: email caído, Drive no disponible, webhook de Stripe, incidente Supabase, rollback de app y de Drive, revocación de tokens, borrado de datos.
