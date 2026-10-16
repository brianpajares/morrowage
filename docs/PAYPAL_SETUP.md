# Cobrar con PayPal · guía de configuración (para el dueño)

> Tiempo: 60–90 min la primera vez. **Pega los secretos solo en Vercel, nunca en un chat.**
> Estado de la implementación: **probada con mocks** (180 tests + 38 E2E) y la base de datos en Postgres real (PGlite).
> **Aún no probada contra PayPal Sandbox real**: eso se hace en el Paso 6 y se confirma con `/api/health` + una compra de prueba.

## Cómo funciona (en 20 segundos)

1. La persona calcula gratis y ve su MorrowAge en pantalla.
2. Deja su email → recibe un **PDF de vista previa difuminado** (5 págs.) con el botón «Desbloquear mi informe completo · US$19». En pantalla solo ve «¡Felicidades! Revisa tu correo» + «Desbloquear ahora» (sin informe, sin descarga).
3. Tú recibes en `OWNER_EMAIL` el **PDF completo sin difuminar** (13 págs.) de cada lead.
4. El botón lleva a `/<idioma>/unlock/<token>`: sin código, acepta términos y paga con PayPal o tarjeta.
5. PayPal confirma (captura en el servidor + webhook firmado). El cliente recibe el **PDF completo** y tú el aviso `MorrowAge | VENTA CONFIRMADA US$19 | MA-26-XXXXXX | ENTREGADO` (con `| SANDBOX` en pruebas).
6. Si falta cualquier configuración de pagos, la app **no se rompe**: envía el informe completo gratis.

## Variables de entorno (Vercel → Settings → Environment Variables)

Al crear cada variable marca **Production y Preview** (en Preview: *All Preview branches*). Después de cambiar variables: **Deployments → ⋯ → Redeploy** (solo se aplican a despliegues nuevos). En el valor va **solo el valor**: sin comillas, paréntesis ni comentarios.

| Variable | Obligatoria | Valor |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Sí | `https://tu-dominio.com` (base de los enlaces de los correos) |
| `MONETIZATION_MODE` | Sí | `paypal` (con `validation` vuelve el informe gratis) |
| `PAYPAL_ENV` | Sí | `sandbox` primero; `live` solo con tu aprobación |
| `PAYPAL_CLIENT_ID` | Sí | de la app REST de PayPal (distinto en Sandbox y en Live) |
| `PAYPAL_CLIENT_SECRET` | Sí | secreto de esa app |
| `PAYPAL_WEBHOOK_ID` | Sí | id del webhook (distinto en Sandbox y en Live) |
| `PAYPAL_MERCHANT_ID` | Recomendada | Merchant ID de la cuenta Business; se verifica en cada captura |
| `PAYMENTS_LIVE_APPROVED` | Sí | `false` hasta que apruebes cobros reales |
| `REPORT_PRICE_USD` | Opcional | `19.00` por defecto (hipótesis del PRD) |
| `RESEND_API_KEY` | Sí | `re_…` |
| `EMAIL_FROM` | Sí | `MorrowAge <info@tu-dominio.com>` (el dominio debe estar verificado en Resend) |
| `OWNER_EMAIL` | Sí | **solo** `info@zone-digital.com` (recibe leads con PDF completo y avisos de venta) |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Sí | del proyecto Supabase (el `service_role` solo en Vercel) |
| `CRON_SECRET` | Recomendada | aleatorio ≥ 40 caracteres: `openssl rand -base64 48` |

## Paso 1 · Supabase (10 min)

1. https://supabase.com/dashboard → **New project** (plan gratis, región cercana).
2. **SQL Editor → New query** y pega **`supabase/bundle.sql`** (generado con `npm run db:bundle`; contiene las 3 migraciones en orden) → **Run**. Al final comprueba:
   ```sql
   select count(*) from pg_proc where proname in ('ma_order_mark_paid','ma_order_claim_fulfillment');   -- 2
   select count(*) from pg_tables where schemaname = 'public' and not rowsecurity;                      -- 0 (todas con RLS)
   ```
   Si ya tenías las dos migraciones anteriores, ejecuta **solo** `supabase/migrations/20261016000000_paypal_payments.sql` (es idempotente).
3. **Project Settings → API**: copia `Project URL` y la clave `service_role`.

## Paso 2 · Correo con Resend + DNS (15–60 min)

Ver [`EMAIL_SETUP.md`](./EMAIL_SETUP.md). Resumen: crea la API key, añade el dominio, crea los 3 registros DNS copiando cada valor con el botón de copiar de Resend, pulsa **Verify** y espera a **Verified**. No toques los MX/SPF del dominio raíz.

## Paso 3 · PayPal Sandbox (10 min)

1. https://developer.paypal.com → interruptor **Sandbox** → **Apps & Credentials → Create App** (tipo *Merchant*).
2. Copia **Client ID** y **Secret** a Vercel (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`).
3. En la misma app: **Webhooks → Add Webhook**
   - URL: `https://<tu-dominio-de-producción>/api/paypal/webhook`
   - Eventos: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.DECLINED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`, `CUSTOMER.DISPUTE.CREATED`
   - Copia el **Webhook ID** → `PAYPAL_WEBHOOK_ID`.
4. **Testing Tools → Sandbox Accounts**: la cuenta *Personal* sirve para pagar (⋯ → View/Edit para ver email y contraseña); el *Merchant ID* de la cuenta *Business* → `PAYPAL_MERCHANT_ID`.
5. Variables: `MONETIZATION_MODE=paypal`, `PAYPAL_ENV=sandbox`, `PAYMENTS_LIVE_APPROVED=false` → **Redeploy**.

## Paso 4 · Comprobar (2 min)

Abre `https://<tu-app>/api/health`. Debe mostrar:

```json
"integrations": { "email": true, "database": true, "paypal": true, "resend_api_key": "ok", "deployment": "production" },
"payments": { "enabled": true, "mode": "paypal", "env": "sandbox", "live_blocked": false, "webhook_configured": true }
```

| Si ves… | Causa | Solución |
|---|---|---|
| `payments.enabled:false`, resto en `true` | falta `MONETIZATION_MODE=paypal` o alguna `PAYPAL_*` | completar variables y Redeploy |
| `database:false` o `paypal:false` en Preview | variables marcadas solo para Production | marcar también Preview y Redeploy |
| `resend_api_key: "missing"/"placeholder"/"unexpected_format"` | clave ausente o mal pegada | recrearla (`re_…`, sin comillas) |
| `env:"sandbox"` tras «pasar a live» | no se cambió `PAYPAL_ENV` o siguen las claves de Sandbox | cambiar variables y Redeploy |
| `live_blocked:true` | `PAYPAL_ENV=live` sin `PAYMENTS_LIVE_APPROVED=true` | es la protección: solo activa con tu aprobación |

## Paso 5 · Prueba completa en Sandbox (10 min)

1. Calcula → deja tu email → pantalla «¡Felicidades! Revisa tu correo».
2. Llega la **vista previa difuminada** al cliente y el **PDF completo** a `OWNER_EMAIL`.
3. «Desbloquear ahora» → acepta términos → paga con la cuenta *Personal* de Sandbox. Sin pedir código.
4. Llegan el **PDF completo** al cliente y `… VENTA CONFIRMADA … | ENTREGADO | SANDBOX` al dueño.
5. Cierra el popup sin pagar → no se entrega nada. Cierra la pestaña justo después de aprobar → el webhook entrega igual.
6. PayPal Developer → Webhooks → *Event delivery*: respuestas **200**.
7. Reembolso desde la cuenta *Business* de Sandbox → el pedido pasa a `refunded` y te llega un aviso.

Si algo falla: la pantalla de éxito muestra un código `ref: …` (p. ej. `resend_403_validation_error`) y la fuente de la verdad es https://resend.com/logs.

## Paso 6 · LIVE (cobros reales) — solo con tu aprobación

1. Cuenta PayPal **Business** verificada.
2. developer.paypal.com → interruptor **Live** → crea la app → Client ID + Secret; crea el **webhook Live** (mismos eventos y URL; es otro Webhook ID).
3. En Vercel **Production**: `PAYPAL_ENV=live`, `PAYMENTS_LIVE_APPROVED=true`, y los tres valores **Live** (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`) → **Redeploy**.
4. `/api/health` debe decir `"env":"live"` y el aviso «MODO PRUEBA» desaparece de la página de pago.
5. Haz una **compra real propia** y reembólsala desde PayPal.
6. Revisa los textos legales (privacidad, términos, política de reembolsos) con tu asesor.

**Rollback inmediato:** `MONETIZATION_MODE=validation` (o borrar `PAYPAL_CLIENT_ID`) + Redeploy → vuelve el informe gratis. También: Deployments → despliegue anterior → **Promote to Production**.

## Seguridad en una frase por regla

- El precio y la moneda salen solo del servidor; el navegador no puede cambiarlos.
- Se valida orden, `custom_id`, estado COMPLETED, importe, moneda y merchant antes de entregar; un pago PENDING/ajeno/de otro importe **no entrega nada**.
- El informe completo no viaja al navegador antes del pago (la API responde 402).
- Webhook con firma verificada por PayPal, sin duplicados (idempotente) y con reintento (responde 500 si falla).
- Dos procesos nunca entregan el mismo informe (reclamo atómico en SQL); el cron diario reintenta entregas fallidas.
- Secretos solo en variables del servidor. Si pegaste uno en un chat, **rótalo**.
