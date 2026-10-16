# RUNBOOKS · MorrowAge

Regla general: nunca copiar datos de salud, emails ni tokens a tickets, chats o logs. Diagnosticar con `GET /api/health` (con `Authorization: Bearer $CRON_SECRET` muestra capacidades) y con Sentry (eventos redactados).

## 1. Fallo de email
- Síntoma: leads en estado `failed` en `/admin`; `delivery_error_class` indica la causa (`email_not_configured`, `resend_domain_not_verified`, `resend_transient`).
- Acciones: verificar `RESEND_API_KEY`/`EMAIL_FROM` y el dominio en Resend (SPF/DKIM/DMARC). Reenviar desde `/admin` (rota el token). El cron diario reintenta entregas `requested`/`failed` de las últimas 24 h.
- El informe web sigue accesible con el enlace devuelto al usuario durante la solicitud.

## 2. Google Drive no disponible
- La app sigue sirviendo con last-known-good (memoria → `/tmp` → snapshot empaquetado). `driveSnapshotStatus` pasa a `last_known_good`. Sentry recibe `drive_unavailable` con la clase del fallo.
- Revisar credenciales/permiso de la carpeta; tras corregir, esperar al backoff (5 min) o redeployar.
- Si un archivo de Drive no coincide con el manifest se rechaza (nunca reemplaza un snapshot válido). Para cambiar el modelo: actualizar `drive/` + `spec/drive_manifest.json`, `npm run drive:sync`, desplegar.

## 3. Webhook de Stripe
- Idempotente por `event.id`. Si falla el procesamiento responde 500 y Stripe reintenta; el evento queda `failed` y se reprocesa en el siguiente intento.
- Reentregas manuales: Dashboard de Stripe → evento → "Resend". No hay doble entrega (estado del pedido + UNIQUE).

## 4. Incidente de Supabase
- Sin Supabase en producción la API responde 503 (falla cerrado; no se pierden datos ni se simulan). Restaurar el proyecto/backup y verificar `GET /api/health`.

## 5. Rollback de la app
- Vercel → Deployments → "Promote to Production" del despliegue anterior. Las migraciones son aditivas; no requieren rollback para volver a la versión previa.

## 6. Rollback de Drive
- Volver a subir la versión anterior de `drive/` con su manifest y desplegar; mientras tanto el last-known-good protege el servicio.

## 7. Revocación de un token de informe
- `/admin` → Reenviar (rota el token e invalida el enlace anterior) o borrar la solicitud. Para revocar sin reenviar: `update reports set token_expires_at = now() where verification_id = '…'`.

## 8. Borrado de datos
- Las solicitudes llegan por email al buzón del dueño y aparecen en `/admin` → "Solicitudes de borrado" → **Procesar borrado**. Borra cálculos/leads/informes del solicitante; los pedidos pagados se retienen (solo se vacía el payload de salud).
- La purga por retención (`REPORT_RETENTION_DAYS`) corre a diario (`/api/cron/cleanup`).

## 9. Sentry
- Los eventos pasan por `scrubSentryEvent`: sin cuerpos, cookies, cabeceras, query, emails ni tokens. Si aparece un dato sensible, tratar como incidente de privacidad: purgar el evento en Sentry y añadir la regla al scrubber con su test.

## 10. Pagos con PayPal (modo `paypal`)

- **Diagnóstico primero:** abre `https://<app>/api/health` y revisa `payments` (`enabled`, `env`, `live_blocked`, `webhook_configured`) e `integrations` (`email`, `database`, `resend_api_key`, `deployment`, `build.branch/commit`). Si `payments.enabled=false` con todo lo demás en `true`: falta `MONETIZATION_MODE=paypal`, alguna variable `PAYPAL_*` o, en LIVE, `PAYMENTS_LIVE_APPROVED=true`. Variables en **Production y Preview** y **Redeploy** tras cada cambio.
- **Cliente pagó y no recibió el PDF:** `/admin` → «Entregas pendientes». El cron diario (`/api/cron/cleanup`, campo `ordersRetried`) lo reintenta; para forzarlo, ejecútalo con `Authorization: Bearer $CRON_SECRET`. El aviso al dueño dice `ENTREGA PENDIENTE` hasta que se entrega. Mira Resend → Logs para el motivo exacto.
- **Webhook con 401 en PayPal Developer → Event delivery:** Deployment Protection de Vercel (Preview) o `PAYPAL_WEBHOOK_ID` de otro entorno (el de Sandbox y el de Live son distintos). Apunta el webhook al dominio de producción.
- **Reembolso:** hazlo desde el panel de PayPal; el webhook `PAYMENT.CAPTURE.REFUNDED` marca el pedido `refunded` y te avisa por correo.
- **Alertas «PAGO NO ENTREGADO» / «PAGO DUPLICADO»:** nunca se entrega un pago con importe, moneda, merchant o `custom_id` distintos; revisa el pedido en PayPal y reembolsa si corresponde.
- **Rollback de cobros:** pon `MONETIZATION_MODE=validation` (o borra `PAYPAL_CLIENT_ID`) y haz Redeploy: vuelve el informe gratis y los enlaces de desbloqueo muestran un aviso neutro.
