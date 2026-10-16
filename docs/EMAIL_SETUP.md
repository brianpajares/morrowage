# Correo transaccional con Resend · de cero a «Delivered»

## 1. Orden correcto

1. https://resend.com/api-keys → crea una API key (Sending access) → `RESEND_API_KEY` (empieza por `re_`, sin comillas).
2. https://resend.com/domains → **Add Domain** → tu dominio raíz (p. ej. `zone-digital.com`).
3. **¿Dónde está tu DNS?** Mira los *Nameservers* en https://lookup.icann.org.

   | Nameservers | Dónde se editan los registros |
   |---|---|
   | `ns*.wordpress.com` | WordPress.com → Dominios → Registros DNS |
   | `*.domaincontrol.com` | GoDaddy → DNS |
   | `*.cloudflare.com` | Cloudflare → DNS |
   | `*.zoho.com` | Zoho → DNS Manager |
   | `vercel-dns` | Vercel → Domains |

4. Crea los 3 registros **copiando cada valor con el botón de copiar de Resend**:

   | Tipo | Nombre | Valor |
   |---|---|---|
   | TXT | `resend._domainkey` | `p=MIGf…` (la clave **completa**, ~200 caracteres) |
   | MX | `send` | `feedback-smtp.<región>.amazonses.com` · prioridad 10 |
   | TXT | `send` | `v=spf1 include:amazonses.com ~all` |
   | TXT (opcional) | `_dmarc` | `v=DMARC1; p=none; rua=mailto:info@tu-dominio.com` |

   En el campo *nombre* escribe solo `send` (no `send.tu-dominio.com`): el panel añade el dominio.
5. **Verify DNS Records** y espera a **Verified** (5–60 min).
6. **No toques los MX/SPF del dominio raíz** (los del buzón, p. ej. Zoho). Resend usa el subdominio `send`. Si ya existe un `_dmarc`, no crees otro.

## 2. Variables

| Variable | Formato correcto | Error típico |
|---|---|---|
| `RESEND_API_KEY` | `re_xxxxxxxx…` | creada solo en Production mientras se prueba Preview |
| `EMAIL_FROM` | `MorrowAge <info@tu-dominio.com>` | comillas literales o dominio sin verificar |
| `OWNER_EMAIL` | **solo** `info@tu-dominio.com` | texto pegado al lado (`… (ya es el valor por defecto)`) → 422 |

La app **normaliza** estas variables al leerlas (extrae solo la dirección y construye `Nombre <dirección>`), pero conviene dejarlas bien.

## 3. Diagnóstico en 2 minutos

1. `https://<app>/api/health` → `integrations.email`, `resend_api_key` (`missing | placeholder | unexpected_format | ok`), `email_from_domain`, `deployment` y `build.commit` (¿es el despliegue nuevo?).
2. La pantalla de éxito muestra `ref: <código>` si el envío falló.
3. https://resend.com/logs → abre la última llamada `POST /emails`: status, mensaje exacto y *request body*. **Fuente de la verdad.**
4. https://resend.com/domains → estado del dominio (*Not Started* = faltan los registros DNS).
5. https://resend.com/emails → Delivered / Bounced / Complained.

## 4. Tabla de errores

| `ref` / síntoma | Causa | Solución |
|---|---|---|
| `email_not_configured` | falta `RESEND_API_KEY` o `EMAIL_FROM` **en ese despliegue** | marcar Production **y** Preview + Redeploy |
| `resend_401_*` | API key inválida o revocada | crear otra y pegarla sin comillas |
| `resend_403_validation_error` | dominio sin verificar, o `EMAIL_FROM` de otro dominio | registros DNS + **Verify** hasta *Verified* |
| `resend_422_validation_error` (from) | remitente mal formado | `Nombre <correo@dominio>` sin comillas |
| `resend_422_validation_error` (to) | destinatario / `OWNER_EMAIL` con texto extra | la variable debe llevar solo la dirección |
| `resend_429_*` | límite del plan (Free: 100/día, 3.000/mes) | esperar o subir de plan |
| Delivered, pero no está en la bandeja | filtro de spam | revisar spam; añadir el remitente a la lista de permitidos del buzón |
| Zoho rechaza el TXT (`not in expected format`) | clave DKIM abreviada (`p=MIGf…`) copiada de una guía | copiar la clave completa con el botón de Resend |

Con el dominio sin verificar (o el remitente de pruebas `onboarding@resend.dev`), Resend solo envía a tu propio correo de registro.
