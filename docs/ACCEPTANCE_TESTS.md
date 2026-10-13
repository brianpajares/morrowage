# ACCEPTANCE_TESTS · MorrowAge v4

Todos los tests son obligatorios salvo los marcados `stripe-only`, que deben pasar en sandbox aunque `MONETIZATION_MODE=validation` sea el default.

| ID | Caso | Criterio de aceptación |
|---|---|---|
| AT-01 | Landing y claims | ES/EN/PT muestran risk-equivalent age y niegan biological age/diagnosis/lifespan prediction. |
| AT-02 | Scope | No se puede continuar sin aceptar alcance; edad fuera 40–69 muestra out-of-scope seguro. |
| AT-03 | Schema inputs | Cada required/range/integer/enum de `inputs.schema.json` se valida server-side. |
| AT-04 | Conversiones | cm/in y alcohol local normalizan al valor canónico esperado sin drift >1e-6. |
| AT-05 | Reaction test | Produce 250–1500 ms; analytics no recibe el valor crudo. |
| AT-06 | Golden vectors | Motor TypeScript coincide 18/18 con `test_vectors.json`, `rel_tol <= 1e-6`. |
| AT-07 | Preview | Gratis incluye exactamente los elementos `free_preview` y no desbloquea contenido full. |
| AT-08 | Out-of-range display | TC06/TC16 muestran `<40`/`>69`; raw no aparece en DOM, PDF ni analytics. |
| AT-09 | Validation lead | Email válido + service consent crea lead; marketing opcional queda separado. |
| AT-10 | User email | Resend mock confirma envío al usuario con link expirable; no hay cobro. |
| AT-11 | Report web | Token válido abre informe; token expirado devuelve 410/estado seguro. |
| AT-12 | PDF | PDF incluye Verification ID, model version, resumen, sensibilidad, drivers, escenarios, metodología y disclaimer. |
| AT-13 | Owner email | `OWNER_EMAIL` recibe asunto `[MorrowAge] Solicitud de informe <id>`, inputs, resultados y PDF; PostHog/admin no los recibe. |
| AT-14 | Metodología | Página identifica Clift 2021, benchmark, 0.74 como c-statistic y outputs bloqueados sin llamarlo accuracy. |
| AT-15 | Delete request | Se registra solicitud, estado y timestamp; ningún dato sensible va a analytics. |
| AT-16 | Admin auth | Usuario no admin obtiene 403; admin autenticado ve solo superficie permitida. |
| AT-17 | Admin privacy | Tabla admin no muestra input payload, output raw, report token/URL ni health fields. |
| AT-18 | Stripe checkout | `stripe-only`: con mode/flag activos se crea Checkout Session con price permitido. |
| AT-19 | Webhook idempotente | `stripe-only`: firma inválida 400; evento duplicado no duplica pedido/entrega. |
| AT-20 | i18n | ES/EN/PT tienen paridad de rutas; cálculo idéntico para mismo input canónico. |
| AT-21 | Accesibilidad | axe sin critical; flujo completo por teclado; errores anunciados; gráficos con tabla/resumen. |
| AT-22 | Drive checksum | Archivo con SHA incorrecto es rechazado y no reemplaza snapshot válido. |
| AT-23 | Drive fallback | Simular Drive caído: cálculo sigue con last-known-good y Sentry recibe evento redactado. |
| AT-24 | What-if | Máximo 3 escenarios, dentro de guardrails; no recomendaciones causales contraintuitivas. |
| AT-25 | Analytics allowlist | Eventos fuera de schema o props prohibidas fallan en test; email/health/raw result/token no salen. |
| AT-26 | Turnstile/rate limit | Gate y endpoints sensibles rechazan abuso; entorno test puede usar token mock explícito. |
| AT-27 | Verification ID | Cada informe tiene ID no reversible y versiones app/model. |
| AT-28 | Locked outputs | `mortality_risk_10y` y `country_percentile` no aparecen como valores personalizados. |
| AT-29 | Performance API | p95 route handlers críticos <2 s bajo carga objetivo del MVP. |
| AT-30 | Lighthouse | `/`, methodology y FAQ >=90 en Performance, Accessibility, Best Practices y SEO móvil. |
| AT-31 | Security headers | HSTS, CSP, nosniff, referrer-policy y frame policy configurados. |
| AT-32 | Logs | Escaneo de logs no encuentra email, health inputs, token plano ni raw MorrowAge. |
| AT-33 | RLS | anon/auth no admin no puede leer tablas sensibles; admin frontend tampoco puede leer `calculations`. |
| AT-34 | Cost instrumentation | Métrica operacional calcula costo estimado por report; validation target <=US$0.05 fuera de planes fijos. |
| AT-35 | CI | lint, typecheck, unit, golden, build y Playwright smoke pasan en PR. |
| AT-36 | No placeholders | Repo no contiene marcadores pendientes, secretos reales ni `example.com` salvo valores de documentación explícitamente no runtime. |

## Matriz FR → US → Test

| FR | US | Test |
|---|---|---|
| FR-01 | US-01, US-14, US-15 | AT-01, AT-20, AT-21 |
| FR-02 | US-02, US-03 | AT-02, AT-03 |
| FR-03 | US-03 | AT-04 |
| FR-04 | US-04 | AT-05 |
| FR-05 | US-05 | AT-06 |
| FR-06 | US-06 | AT-08 |
| FR-07 | US-05 | AT-07 |
| FR-08 | US-07 | AT-09 |
| FR-09 | US-07 | AT-09, AT-33 |
| FR-10 | US-07 | AT-10 |
| FR-11 | US-09 | AT-13, AT-32 |
| FR-12 | US-08, US-15, US-17 | AT-12, AT-21, AT-24 |
| FR-13 | US-08 | AT-11 |
| FR-14 | US-12 | AT-16, AT-17 |
| FR-15 | US-04, US-12 | AT-25 |
| FR-16 | US-16 | AT-22, AT-23 |
| FR-17 | US-16 | AT-22 |
| FR-18 | US-01, US-10 | AT-14 |
| FR-19 | US-11 | AT-15 |
| FR-20 | US-13 | AT-18 |
| FR-21 | US-13 | AT-19 |
| FR-22 | US-07 | AT-09 |
| FR-23 | US-07, US-12 | AT-26 |
| FR-24 | US-01, US-12 | AT-30 |
| FR-25 | US-10, US-17 | AT-28 |
| FR-26 | US-08 | AT-27 |

## NFR → Test

| NFR | Test |
|---|---|
| NFR-01 | AT-29 |
| NFR-02 | AT-30 |
| NFR-03 | AT-26, AT-31, AT-32, AT-33 |
| NFR-04 | AT-15, AT-17, AT-25, AT-32 |
| NFR-05 | AT-21 |
| NFR-06 | AT-20 |
| NFR-07 | AT-34 |
| NFR-08 | AT-19, AT-23 |
| NFR-09 | AT-23, AT-25, AT-32 |
| NFR-10 | AT-06, AT-35 |
| NFR-11 | AT-35, AT-36 |
