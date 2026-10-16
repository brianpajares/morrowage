# STATUS · MorrowAge (2026-10-16 · auditoría + pagos con PayPal)

Rama de trabajo: `feat/paypal-paywall-audit` (sin fusionar a `main`: fusionar = desplegar a producción en Vercel).
Repo local: `C:\Users\brian.pajares\dev\morrowage` (fuera de OneDrive a propósito: `node_modules` rompe la sincronización).

## Hecho y verificado
- **Auditoría** completa: `docs/AUDITORIA_2026-10-16.md` (hallazgos, acciones, 22 lecciones de PivotWorth, lo no verificado).
- **Modo de pago `MONETIZATION_MODE=paypal`**: vista previa difuminada por correo → `/[locale]/unlock/<token>` → PayPal/tarjeta → PDF completo + «VENTA CONFIRMADA». Sin configuración de pagos, informe gratis. Doble interruptor para LIVE.
- **PDF completo de 13 páginas** y **vista previa de 5 páginas** sin fuga de valores bloqueados (test sobre 3 vectores × 3 idiomas). Informe web con las mismas secciones.
- UX: bloque de valor + precio en la vista previa, éxito con `ref:` de diagnóstico, página de desbloqueo, landing/FAQ con precio real, estados de pago.
- Seguridad/operación: CSP/COOP/Permissions-Policy para PayPal, `/unlock/` noindex, `/api/health` con `integrations` y `payments` sin secretos, normalización de `OWNER_EMAIL`/`EMAIL_FROM`, panel de ventas, cron que reintenta entregas.
- Pruebas: `npm run verify` en verde (180 tests: unitarios, integración, RLS en Postgres real, vectores 18/18, PDF, pagos con PayPal simulado), `check:placeholders`, `check:drive`, E2E Playwright 38/38 (móvil 360 + escritorio 1280, axe, 320 px).

## Pendiente (lo hace el dueño; guía en `docs/PAYPAL_SETUP.md`)
1. Proyecto Supabase (costo: confirmar) y pegar `supabase/bundle.sql` en el SQL Editor.
2. Resend: API key + dominio verificado (SPF/DKIM) → `EMAIL_FROM`, `OWNER_EMAIL`.
3. PayPal **Sandbox**: app + webhook → `PAYPAL_*`; `MONETIZATION_MODE=paypal`; Redeploy; compra de prueba completa.
4. Revisión legal (razón social, domicilio, reembolsos) y decisión del **precio** (`REPORT_PRICE_USD`, hoy US$19).
5. LIVE solo con aprobación: `PAYPAL_ENV=live` + `PAYMENTS_LIVE_APPROVED=true`, compra real propia y reembolso.
6. Medidas de rendimiento sobre el despliegue (Lighthouse ≥ 90, p95 < 2 s): la landing pasó a render dinámico.

## No verificado aún
PayPal Sandbox real, Resend real y Supabase real (probados con mocks/PGlite). No se pudo revisar visualmente el PDF renderizado como imagen en este entorno.
