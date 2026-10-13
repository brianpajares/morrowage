# DECISIONS.md

Registro del programador. No modificar `docs/decisions_log.md`; añadir aquí decisiones de implementación con fecha, contexto y motivo.

## 2026-10-07

1. **Repo fuera de OneDrive** (`C:\Users\brian.pajares\dev\morrowage`). Motivo: `node_modules`/`.next` en OneDrive provocan bloqueos y sincronización masiva.
2. **Snapshot de Drive empaquetado = last-known-good inicial.** La cadena es Drive → memoria → /tmp → `drive/` del repo, todos verificados por SHA-256. Motivo: la app no depende de Drive para su primer cálculo; si nunca hubo versión válida, falla cerrado (503).
3. **Coeficientes: una sola fuente** (`drive/model/model_coefficients_v2.json`); `src/lib/model/params.ts` solo valida y traduce. Un test comprueba paridad con `base_morrowage.xlsx` y con `inputs.schema.json`.
4. **Valores canónicos exactos, sin redondeo ni `multipleOf`**: cm/cm = in/in; US drinks ×1.75. `multipleOf` del schema es pista de UI, no se aplica en servidor.
5. **`/api/calculate` devuelve solo la vista previa segura** (`free_preview`): sin raw fuera de 40–69, sin η/Δlp, sin drivers completos ni sensibilidad. Conflicto con OpenAPI resuelto por el guardrail más seguro (precedencia §6).
6. **Escenarios what-if**: solo reducciones en cigarrillos, alcohol, cintura/altura y pulso; máx. 3; nunca sueño. El signo del coeficiente de sueño no se convierte en consejo.
7. **`action_plan` limitado** a calidad de medición y consulta profesional, sin fuentes de bienestar externas (no inventar).
8. **next-intl sin plugin**: se registra a mano el alias `next-intl/config`. El plugin carga `@swc/core`, cuyo binario nativo falla en Windows por ACLs de AppContainer.
9. **CSP con `'unsafe-inline'` en script/style** para poder prerenderizar rutas públicas (Lighthouse). Resto restrictivo. Nonce por petición queda como mejora.
10. **Analítica first-party**: `/api/events` valida la allowlist, cuenta agregados sin PII (`funnel_counters`) y reenvía a PostHog desde el servidor; no se carga `posthog-js`. Respeta GPC/DNT.
11. **Migración 0002 (no está en el spec)**: `funnel_counters`, `purge_expired_data`, revocación de privilegios sobrantes a `anon`/`authenticated`.
12. **Prefijo de locale siempre** (`/es`, `/en`, `/pt`) y variables nuevas `SESSION_PEPPER`, `CRON_SECRET`, `NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL`.
13. **Email al dueño en español** (operacional), asunto `[MorrowAge] Solicitud de informe <Verification ID>`; incluye email, inputs, resultados RAW y PDF; no va a analítica/admin/logs.
14. **Test de reacción**: protocolo preliminar `snap-v1` (decisión entre iguales/distintos, mediana de aciertos), más cercano a la prueba de UK Biobank (media 558 ms) que un test de reacción simple. Hay alternativa manual accesible.
15. **Modo `APP_ENV=test`** (store y email en memoria) prohibido con `VERCEL_ENV=production`.
