# Auditoría exhaustiva · MorrowAge · 2026-10-16

Alcance: código del repositorio `brianpajares/morrowage` (commit base `94dd133`), embudo completo, pagos, correo, PDF, UX/UI, seguridad y operación, contrastado con las **22 lecciones** de la implementación de referencia (PivotWorth) y con los playbooks de monetización/pagos/correo.

Verificación usada: 180 tests unitarios/integración/RLS (incluye Postgres real en proceso), 38 pruebas E2E en Chromium (móvil 360 + escritorio 1280, axe, 320 px; 16 son del flujo de pago), `lint`, `typecheck`, `build`, 18/18 vectores del motor y recorrido visual del embudo en el navegador. **No** se probó contra PayPal Sandbox, Resend ni Supabase reales (ver «Lo que no pude verificar»).

## 1. Hallazgos y qué se hizo

| # | Sev. | Hallazgo | Acción |
|---|---|---|---|
| 1 | **Crítico** | El producto **regalaba el informe completo** (`validation`) y no existía ningún cobro con PayPal; solo había Stripe apagado. No había vista previa difuminada, ni página de pago, ni aviso de venta. | Modo `paypal` completo: vista previa difuminada por correo → página de desbloqueo → PayPal/tarjeta → PDF completo + aviso «VENTA CONFIRMADA». Sin configuración de pagos vuelve al informe gratis. |
| 2 | Alto | `Cross-Origin-Opener-Policy: same-origin` y CSP sin dominios de PayPal: el **popup/los botones de PayPal no habrían cargado** (lección #16). | `same-origin-allow-popups`, CSP (`script/connect/frame/img`), `Permissions-Policy: payment=(self paypal…)`. |
| 3 | Alto | `upgrade-insecure-requests` siempre activo: **rompe WebKit en localhost** (lección #17). | Solo en Vercel (`VERCEL=1`). |
| 4 | Alto | Un cobro necesita garantías que no existían: captura/validación en servidor, webhook firmado, idempotencia, entrega exclusiva. | Servicio PayPal con validación completa (orden, `custom_id`, COMPLETED, importe, moneda, merchant), webhook verificado con la API oficial, `ma_order_mark_paid` / `ma_order_claim_fulfillment` atómicos en SQL, cron de reintentos. 33 tests del flujo de pago + 7 de SQL/bundle. |
| 5 | Alto | El informe completo viajaba al navegador tras pedirlo (modo gratis); en modo de pago no debe hacerlo (lección #8). | `/api/leads` solo devuelve `unlockUrl`; `/api/report/*` y `/pdf` responden **402** mientras está bloqueado; el informe web redirige al desbloqueo. |
| 6 | Alto (valor) | El PDF tenía **8 páginas con poco contenido** (páginas casi vacías): poco valor percibido para pagar. | **13 páginas**: perfil frente al benchmark (gráfico por dato), guía de medición por dato, seguimiento + registro imprimible, preguntas para un profesional, glosario/FAQ. Mismo contenido en el informe web. ES/EN/PT. |
| 7 | Medio | Sin vista previa de PDF: no había forma de «mostrar lo que se pierde» sin filtrar datos. | PDF de vista previa de 5 páginas que **solo recibe el resumen gratuito**; lo bloqueado son barras sintéticas (en PDF no existe el «blur» real). Test de fuga sobre 3 vectores × 3 idiomas. |
| 8 | Medio (UX) | La vista previa en pantalla no comunicaba el valor del informe: tres tarjetas «bloqueado» sin precio, sin contenido, sin CTA claro. | Bloque de valor: qué incluye, ilustración «por dentro» (sintética y difuminada), precio visible, CTA único, señales de confianza. |
| 9 | Medio (UX) | La pantalla de éxito no sabía si el correo se había enviado (envío asíncrono) y no daba pista si fallaba. | «¡Felicidades! Revisa tu correo» + «Desbloquear ahora»; consulta del estado de entrega y código `ref:` si falla (lección #1–#4). |
| 10 | Medio (UX) | La landing y la FAQ decían «Gratis en esta fase» / «gratis»: contradictorio con un cobro. | Muestran el precio real y los contenidos del informe; leen la configuración en cada petición. |
| 11 | Medio | `/api/health` público no permitía diagnosticar (el dueño no puede enviar `Authorization`). | Añade `integrations` y `payments` **sin secretos** (estado de la clave de Resend, rama/commit, entorno PayPal, `live_blocked`). Capacidades detalladas siguen tras `CRON_SECRET`. |
| 12 | Medio | Variables de correo sensibles a texto pegado/comillas (lecciones #2/#3). | `OWNER_EMAIL` → primera dirección válida; `EMAIL_FROM` → `Nombre <dirección>`. |
| 13 | Medio | Contraste insuficiente (4,34:1 < 4,5:1) en el texto «bloqueado» (`--locked`). | Token oscurecido a `#55657c` (≈5,4:1). |
| 14 | Medio | Los enlaces de informe caducaban a los 7 días, pero un comprador necesita tiempo para decidir. | En modo de pago caducan con `REPORT_RETENTION_DAYS` (30). |
| 15 | Bajo | Sin panel de ventas ni de entregas pendientes. | `/admin`: ventas pagadas, importe bruto, entregas pendientes (Sandbox marcado). |
| 16 | Bajo | Textos legales no mencionaban PayPal, pago único ni renuncia al desistimiento. | Privacidad y términos actualizados en ES/EN/PT (sin inventar datos de la empresa). |

## 2. Lecciones aprendidas de PivotWorth: estado en MorrowAge

| # | Lección | Estado |
|---|---|---|
| 1 | `email_not_configured` por variable solo en Production | **Cubierto**: `ref:` en pantalla + `/api/health` (`email`, `deployment`, `build`); guía Production **+ Preview** + Redeploy. |
| 2 | `OWNER_EMAIL` con texto pegado → 422 | **Cubierto**: normalización + test. |
| 3 | `EMAIL_FROM` con comillas / sin `< >` | **Cubierto**: `Nombre <dirección>` siempre. |
| 4 | `resend_403` por dominio sin verificar | Documentado (`EMAIL_SETUP.md`); el `ref:` lo muestra. |
| 5 | DKIM abreviado en el DNS | Documentado. |
| 6 | Con pagos solo llegaba el OTP | **No aplica por diseño**: no hay OTP; primero el correo con la vista previa. |
| 7 | Doble fricción (otro código en el enlace) | **Cubierto**: el token prueba el email; sin código. |
| 8 | El informe completo viajaba en el JSON | **Cubierto** + test (402 / sin `reportUrl`). |
| 9 | Producción corría código viejo (rama = entorno) | `/api/health` → `build.branch/commit`. |
| 10 | `database:false` en Preview | Guía + health por entorno. |
| 11 | `payments.enabled:false` por variable faltante | `payments` con causa en `PAYPAL_SETUP.md`. |
| 12 | «Pasó a live» pero seguía en sandbox | `payments.env`, `live_blocked`; doble interruptor LIVE. |
| 13/22 | La IA no podía configurar Vercel / probar PayPal | Tests con `fetch` falso; Sandbox real lo hace el dueño con la guía. |
| 14 | Timeouts del MCP de Supabase con SQL grande | `supabase/bundle.sql` (SQL Editor) + migración idempotente en trozos pequeños. |
| 15 | Webhook 401 en Preview (Deployment Protection) | Documentado en el runbook. |
| 16 | Popup de PayPal no abre (COOP/CSP) | **Cubierto** (hallazgo #2). |
| 17 | 38 E2E fallando en WebKit por `upgrade-insecure-requests` | **Cubierto** (hallazgo #3). |
| 18 | `<select>` largo ensancha la página en Safari a 320 px | Revisado: los nuevos componentes no usan `select`; E2E de 320 px del flujo de pago. |
| 19 | axe mide el contraste durante la animación | E2E con `reducedMotion: reduce`. |
| 20 | Banderas como letras en Windows | No aplica (no se usan emojis de bandera). |
| 21 | Claves de PayPal pegadas en un chat | Regla en la guía: solo en Vercel; si se pegó, rotar. |

## 3. Mejoras de UX/UI aplicadas (resumen para el dueño)

- **Valor antes que precio**: la vista previa gratuita termina en un bloque que explica *qué se desbloquea* (6 puntos), enseña cómo se ve por dentro, muestra el precio una sola vez y ofrece un único CTA («Ver mi vista previa por correo»). No se paga nada ahí.
- **Correo con tono de agradecimiento**, no de cobro: «Gracias por confiar en MorrowAge…», qué incluye el informe, botón «Desbloquear mi informe completo · US$19» y el mensaje de misión.
- **Página de desbloqueo** centrada en la decisión: resultado a la vista, lista de lo que se desbloquea, precio, términos claros y PayPal/tarjeta; en móvil el pago va primero, en escritorio queda fijo a la derecha. Sin cuentas ni códigos.
- **Estados honestos**: pago pendiente, ya desbloqueado, enlace caducado/no encontrado, error de PayPal sin cobro, etiqueta «MODO PRUEBA» en Sandbox.
- **Informe con más utilidad**: guía de medición, plantilla de seguimiento, preguntas para el profesional y glosario; accesible (tablas equivalentes) y con los mismos guardrails del PRD (sin riesgo absoluto, sin percentiles, `<40/>69`, sin consejos causales).

## 4. Lo que no pude verificar (y cómo se verifica)

| Pendiente | Cómo cerrarlo |
|---|---|
| **PayPal Sandbox real** (creación de orden, popup, captura, firma del webhook real). Probado solo con mocks. | `docs/PAYPAL_SETUP.md` Pasos 3–5 + captura de `/api/health`. |
| **Resend real** (dominio verificado, entrega a bandeja, spam). | Resend → Domains/Logs/Emails. |
| **Supabase real**: las funciones SQL y el bundle se probaron en Postgres 17 (PGlite), no en el proyecto Supabase. | Pegar `supabase/bundle.sql` y ver la fila de comprobación (9 / 0 / 4). |
| **Revisión visual de las páginas del PDF**: no pude renderizar PDF a imagen en este entorno; el diseño se comprobó por extracción de texto/coordenadas, número de páginas y tests de contenido. | Abrir un PDF de muestra (`npx tsx scripts/sample-pdf.ts`) y la vista previa. |
| Lighthouse ≥ 90 y p95 < 2 s (AT-29/30): la landing pasó a render dinámico. | `BASE_URL=… npm run perf:api` y Lighthouse sobre el despliegue. |
| **Textos legales**: se añadió el mecanismo (PayPal, pago único, renuncia al desistimiento) pero no hay razón social, domicilio ni política de reembolsos definitivas. | Revisión con asesor antes de LIVE. |
| **Precio**: por defecto US$19 (hipótesis del PRD). | Decidir y fijar `REPORT_PRICE_USD`. |

## 5. Riesgos residuales conocidos

- Dos pestañas pagando el mismo informe a la vez pueden generar un cobro duplicado antes de que el primero se concilie: el sistema **detecta** el duplicado, no lo entrega dos veces y **te avisa** («PAGO DUPLICADO»); el reembolso es manual en PayPal.
- El enlace de desbloqueo equivale a una credencial de compra (llega solo al email del cliente, caduca a los 30 días y puede rotarse); quien lo reenvíe permite que otra persona pague por ese informe, no que lo lea sin pagar.
- La retención de 30 días vacía los datos de salud; un enlace de desbloqueo posterior muestra «caducado».
