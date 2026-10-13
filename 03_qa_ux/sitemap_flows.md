# Sitemap y flujos · MorrowAge

## Rutas

| Ruta | Objetivo | Indexación |
|---|---|---|
| `/` | Landing principal | index |
| `/calculate` | Inicio calculadora | noindex |
| `/calculate/:step` | 8 pasos | noindex |
| `/processing` | transición de cálculo | noindex |
| `/preview/:session` | resultado gratuito | noindex, token opaco |
| `/report-request` | email gate Fase 1 | noindex |
| `/checkout` | pago Fase 2, solo tras activación | noindex |
| `/success` | confirmación | noindex |
| `/report/:token` | informe web | noindex, token opaco/expirable |
| `/how-it-works` | metodología comprensible | index |
| `/methodology` | metodología técnica/fuentes | index |
| `/faq` | objeciones y seguridad | index |
| `/privacy` | privacidad | index |
| `/terms` | términos | index |
| `/admin` | métricas operativas agregadas | auth + noindex |

### SEO localizado
- `/{locale}/risk-equivalent-age-calculator`
- `/{locale}/country/{country}/risk-equivalent-age`
- `/{locale}/guides/{use-case}`

`locale ∈ {es,en,pt}`. Las páginas de país deben incluir un aviso visible: **“El modelo no está calibrado específicamente para este país”** hasta superar validación local; no usar percentiles ni claims de superioridad nacionales.

## Flujo principal

```mermaid
flowchart TD
  A[Landing] -->|Calcular mi MorrowAge| B[Consentimiento/alcance]
  B --> C1[Edad]
  C1 --> C2[Sueño]
  C2 --> C3[Salud autopercibida]
  C3 --> C4[Cigarrillos]
  C4 --> C5[Tiempo de reacción]
  C5 --> C6[Cintura/altura]
  C6 --> C7[Alcohol]
  C7 --> C8[Pulso en reposo]
  C8 --> P[Procesando]
  P --> V[Vista previa]
  V -->|Enviarme informe gratis| E[Email gate - Fase 1]
  V -.->|Cuando charging gate esté activo| PAY[Checkout - Fase 2]
  E --> S[Éxito]
  PAY --> S
  S --> R[Informe]
  V --> H[Cómo funciona]
```

## Flujo de resultado fuera del rango de referencia

```mermaid
flowchart LR
  I[Inputs válidos 40–69] --> M[Motor raw]
  M --> Q{MorrowAge raw}
  Q -->|40–69| N[Mostrar 1 decimal]
  Q -->|<40| L[Mostrar <40]
  Q -->|>69| U[Mostrar >69]
  L --> C[Explicar límite de referencia]
  U --> C
  C --> E[Contexto y metodología]
```

## Flujo de error

```mermaid
flowchart TD
  X[Input] --> V{Validación}
  V -->|error corregible| I[Mensaje inline + foco al campo]
  I --> X
  V -->|válido| N[Siguiente]
  N --> C{Cálculo}
  C -->|éxito| R[Preview]
  C -->|fallo inesperado| F[Error seguro: no resultado parcial]
  F -->|Reintentar| C
  F -->|Editar datos| X
```

## Flujo Fase 1 → Fase 2
Fase 1 permanece gratuita hasta cumplir los thresholds definidos en `monetizacion.json` durante dos cohortes semanales consecutivas y no existir blocker material de seguridad/QA. El PRD debe mantener `checkout` detrás de feature flag. La URL puede existir técnicamente, pero no debe ser reachable para usuarios mientras la flag esté desactivada.
