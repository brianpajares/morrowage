# UX/UI Spec · MorrowAge · Etapa 3

## B1 · Posicionamiento y voz

**Nombre:** MorrowAge. La disponibilidad marcaria/dominio **no está verificada**; tratar el naming como preliminar hasta búsqueda legal.

**Promesa:** convertir 8 inputs simples, en menos de 90 segundos, en una edad equivalente de riesgo transparente y auditable, sin laboratorio y sin fingir una probabilidad absoluta que el modelo v1 no puede sustentar.

**Tagline**
- ES: **Tu edad equivalente de riesgo, con contexto.**
- EN: **Your risk-equivalent age, with context.**
- PT: **Sua idade equivalente de risco, com contexto.**

**Tres mensajes clave**
1. **Transparencia antes que espectáculo:** coeficientes/fuentes visibles; cálculo determinista.
2. **Contexto antes que precisión falsa:** no es edad biológica, diagnóstico ni probabilidad absoluta de muerte.
3. **Acción educativa, no causal:** drivers y escenarios explican asociaciones; no prescriben conductas.

**Tono:** sereno, preciso, humano, no alarmista. Evitar “tu verdadera edad”, “vas a vivir…”, “reduce X porque el score lo dice”, “riesgo clínico”, “intervalo de confianza”. Sí usar “estimación”, “poblacional”, “benchmark”, “asociación”, “sensibilidad de medición”.

La fuente canónica de microcopy exacto ES/EN/PT es `copy_i18n.json`.

---

## B2 · Arquitectura de información

Ver `sitemap_flows.md`. El core flow es:
Landing → alcance → 8 inputs → procesando → preview → email gate (Fase 1) / checkout feature-flagged (Fase 2) → éxito → informe.

Las páginas SEO por país **no** pueden presentar calibración/percentiles locales hasta validación. Deben explicar el límite explícitamente.

---

## B3 · Pantalla por pantalla

### 1. Landing `/`
**Objetivo:** conseguir inicio del cálculo sin sobrerreclamar.

**Jerarquía**
1. Eyebrow educativo.
2. H1: “Convierte 8 datos cotidianos en una edad equivalente de riesgo.”
3. Subcopy que niega edad biológica/diagnóstico/lifespan.
4. CTA único: “Calcular mi MorrowAge”.
5. Trust row: determinista · fuentes visibles · sin laboratorio.
6. Mini “Cómo funciona”: 8 inputs → cálculo → contexto.
7. Metodología/FAQ/legal en footer.

**Componentes:** hero, CTA primario, trust chips, methodology teaser.

**Estados:** loading de página sin layout shift; error solo para fallo de navegación.

**Analítica:** `landing_view`, `calculate_start_click`, `methodology_open`.

**Confianza:** enlace a paper; “no LLM para la cifra”; rango 40–69; privacidad.

**Copy:** `landing.*` + `trust.*` en `copy_i18n.json`.

---

### 2. Alcance `/calculate`
**Objetivo:** consentimiento informado de uso, sin formulario legal pesado.

**Contenido:** “Antes de empezar”; rango 40–69; wellness educativo; no decisiones médicas. CTA único “Entiendo, continuar”.

**Estado fuera de scope:** si el usuario informa edad fuera de 40–69, no permitir cálculo ni extrapolar; explicar alcance y ofrecer solo metodología.

**Analítica:** `scope_view`, `scope_accept`, `scope_out_of_range`.

**Trust:** política de privacidad; “no pedimos nombre, fecha de nacimiento ni dirección”.

**Copy:** `scope.*`.

---

### 3. Calculadora `/calculate/:step`
**Objetivo:** completar 8 inputs en ≤90 s mediana.

**Layout desktop:** card central 640–720 px; progress superior; pregunta + helper + input; Back secundario y Continue primario.
**Móvil 360 px:** un input principal por pantalla; CTA sticky inferior; teclado/contexto apropiado; progreso “Paso x de 8”.
**Tablet:** igual a móvil con card más ancha.

**Validación común**
- Validar al continuar, no mientras el usuario teclea salvo formato imposible.
- Preservar respuestas al volver.
- Nunca silently clamp input; mostrar el rango.
- `NaN`, infinito, strings no numéricos y enteros fraccionales donde no corresponda → error.
- No defaults que parezcan respuestas personales. Sí defaults de **unidad/localización** (cm/in, drinks/UK units) según locale, siempre visibles.

#### 3.1 Edad
Input integer 40–69. Copy `steps.age`. Error fuera de rango `errors.out_of_scope`.
Evento: `input_age_complete`.

#### 3.2 Sueño
Decimal 3–12 h, step UI 0.25. Copy `steps.sleep`.
Evento: `input_sleep_complete`.

#### 3.3 Salud autopercibida
4 radio cards: excellent/good/fair/poor con labels localizados. Sin “very good” porque el modelo raw no la contempla.
Evento: `input_srh_complete`.

#### 3.4 Cigarrillos
Integer 0–60. No preguntar historial porque el coeficiente seleccionado usa cigarrillos actuales/día.
Evento: `input_cigs_complete`.

#### 3.5 Reacción
Prueba integrada preferida. 3–5 intentos de práctica + medición según protocolo que deberá cerrar Producto/Modelo; hasta entonces marcar método como preliminar. No usar slider.
Validar 250–1500 ms.
Eventos: `reaction_test_start`, `reaction_test_complete`, `input_reaction_complete`.

#### 3.6 Cintura/altura
Dos campos en la misma pantalla (un solo concepto): cintura + altura, misma unidad. Toggle cm/in. Mostrar WHtR calculado y validar 0.30–0.90; no pedir peso/BMI.
Eventos: `unit_system_change`, `input_wthr_complete`.

#### 3.7 Alcohol
Captura local amigable:
- US: standard drinks/week; convertir ×1.75 a UK units.
- UK: UK units/week.
- Otros: permitir gramos de etanol o UK units; explicar conversión.
Antes de Continue mostrar “Equivale a X unidades UK/semana”. Rango motor 0–100.
Eventos: `alcohol_unit_mode_change`, `input_alcohol_complete`.

#### 3.8 RHR
Integer 35–130 bpm. Helper de medición en reposo; no diagnosticar valores.
Evento: `input_rhr_complete`, `assessment_complete`.

**Errores:** inline bajo el campo, focus al error tras submit, `aria-live=polite`.

---

### 4. Procesando `/processing`
**Objetivo:** continuidad y confianza; no teatralizar “IA”.

**Contenido exacto:** `processing.title`, etapas “Validando datos / Calculando / Preparando contexto”, nota “El cálculo numérico no necesita un LLM.”

**Comportamiento:** el cálculo puede ser local e instantáneo; transición visual máxima necesaria solo para continuidad. Respetar reduced motion.

**Error:** no presentar resultados parciales. CTA “Revisar mis datos”.

**Analítica:** `calculation_start`, `calculation_success`, `calculation_error`.

---

### 5. Preview `/preview/:session`
**Objetivo:** entregar valor real gratis y crear curiosidad por el contexto.

**Jerarquía**
1. Eyebrow “Tu edad equivalente de riesgo”.
2. Resultado de presentación:
   - `WITHIN_REFERENCE_RANGE` → 1 decimal.
   - `BELOW_REFERENCE_RANGE` → `<40`.
   - `ABOVE_REFERENCE_RANGE` → `>69`.
3. Edad cronológica visible.
4. Disclaimer corto: no edad biológica/lifespan.
5. Un driver principal.
6. Hazard relativo en accordión “Detalle técnico”, no hero.
7. Tres cards bloqueadas pero visibles: sensibilidad, todos los drivers, escenarios.
8. CTA único “Ver mi informe completo”.

**Gráfico**
- Within range: dumbbell o dos barras en escala 40–69.
- Fuera: boundary marker en 40/69 + flecha; no plotear raw 777 años ni extender el eje.

**Trust:** paper/source link, model v2.1, methodology link, privacy.

**Analítica:** `preview_view`, `preview_out_of_reference_range`, `preview_driver_view`, `preview_unlock_click`.

**Copy:** `preview.*`.

---

### 6. Email gate `/report-request` — Fase 1
**Objetivo:** capturar email con un beneficio claro, sin dark patterns.

**Jerarquía:** title → beneficio → email → CTA → privacy note → checkbox marketing opcional separado.

**Campos mínimos:** email; locale; service consent timestamp. No pedir nombre.

**CTA:** “Enviarme el informe gratis”. No usar “continuar” genérico.

**Privacidad:** analytics/admin no recibe inputs/resultados; report link expirable.

**Estados:** invalid email inline; submit loading; delivery success; delivery failure con retry.

**Analítica:** `report_gate_view`, `email_submit`, `marketing_opt_in`, `report_delivery_success/fail`.

**Copy:** `email_gate.*`.

---

### 7. Checkout `/checkout` — Fase 2, feature flag
**Objetivo:** convertir solo cuando los thresholds de monetización se cumplan.

**Contenido:** una sola oferta principal, precio localizado validado, lista de valor (sensibilidad, drivers, escenarios, metodología), refund/terms claros. El preview gratuito permanece detrás pero visible.

**No vender:** riesgo absoluto 10y, percentiles nacionales ni “diagnóstico”.

**Analítica:** `checkout_view`, `checkout_start`, `purchase_success`, `purchase_fail`.

**Copy:** `checkout.*`.

---

### 8. Éxito `/success`
**Objetivo:** confirmar y dirigir al informe.

**Contenido:** “Tu informe está listo”, nota de expiración, CTA único “Abrir mi informe”.

**Analítica:** `success_view`, `report_open_click`.

**Copy:** `success.*`.

---

### 9. Informe `/report/:token`
**Objetivo:** transformar el resultado en contexto auditable, no ansiedad.

**Orden**
1. Resumen seguro + status de rango.
2. “Qué significa / qué no significa”.
3. Sensibilidad de medición bounds-aware.
4. Todos los drivers (asociaciones).
5. Escenarios user-selected y plausibles, dentro de guardrails.
6. Próximos pasos educativos generales.
7. Metodología, benchmark, fuentes, model version.
8. Limitaciones y disclaimer.
9. ID de verificación.

**No causalidad:** el informe no recomienda “dormir menos” aunque el coeficiente de sueño sea positivo. Las recomendaciones de wellness, si existen, provienen de guías externas revisadas y no del signo β.

**Analítica:** `report_view`, `report_section_view`, `source_open`, `report_download_pdf`, `delete_data_request`.

**Copy:** `report.*`.

---

### 10. Cómo funciona `/how-it-works` + metodología `/methodology`
**Objetivo:** resolver la objeción “¿de dónde sale esta edad?”.

Explicar con una fórmula simplificada:
`MorrowAge = age × exp((LP_nonage − LP_benchmark)/β_log_age)`.
Separar el C-Score propietario del modelo raw-input publicado. Mostrar cohorte y c-statistic sin convertirla en “74% accuracy”.

**Analítica:** `methodology_view`, `source_open`.

---

### 11. FAQ `/faq`
Mínimos:
- ¿Es edad biológica? → No.
- ¿Predice cuánto viviré? → No.
- ¿Por qué no veo riesgo a 10 años? → falta baseline/recalibración validada.
- ¿Qué significa `<40` o `>69`? → raw fuera del rango etario fuente; se censura para no fingir precisión.
- ¿El rango es un IC? → No; sensibilidad de medición.
- ¿Qué pasa con mis datos? → minimización/retención/marketing separado.
- ¿Por qué un input puede “empeorar” de forma contraintuitiva? → asociación poblacional/confounding; no causalidad.

---

### 12. Legal `/privacy`, `/terms`
**Privacy:** categorías de datos, propósito, base/consentimiento por jurisdicción, retención, proveedores, transferencias, derechos, borrado, breach contact. Evitar claim “HIPAA compliant” salvo evaluación específica.
**Terms:** intended use wellness educativo, no medical advice, 40–69, no emergency use, límites de responsabilidad revisados por counsel.

---

### 13. Admin `/admin`
**Objetivo:** operar el funnel sin crear un repositorio de health data.

Mostrar agregados/cohortes: landing→start→preview→gate→delivery/purchase, mediana time-to-preview, error rate, model version, locale. No mostrar inputs individuales, raw result, email en dashboards analíticos ni report URLs. Acceso con auth fuerte, audit log.

---

## B4 · Conversión

1. **Valor <90 s:** 8 pasos, sin cuenta previa, reaction test integrado, progreso visible.
2. **Preview con valor + curiosidad:** resultado seguro + 1 driver; cards del informe bloqueadas pero legibles.
3. **Gate con beneficio:** “Recibe el contexto, no solo la cifra”; email solo para delivery; marketing separado.
4. **Un CTA por pantalla:** secundarios visualmente subordinados.
5. **Defaults inteligentes solo para formato/unidad**, nunca para respuestas de salud.
6. **Prueba social honesta:** hasta tener testimonios consentidos, usar solo evidencia metodológica (“basado en coeficientes publicados”) y no inventar contador de usuarios.

---

## B5 · Sistema de diseño

Fuente: `design_tokens.json` y `components.md`.

**Dirección visual:** calma científica, no “biohacking neon”. Superficie clara, tipografía de sistema, teal oscuro como primario, alto contraste. Resultados en cards con mucho whitespace. Sin semáforo rojo/verde para “bueno/malo”; drivers usan dirección asociativa con labels.

**Charts:** ver `components.md`. Mostrar incertidumbre como sensibilidad de medición; jamás sombreado llamado CI.

---

## B6 · Accesibilidad, responsive, rendimiento e i18n

### WCAG 2.2 AA
- Contrastes AA verificados en tokens.
- Focus visible persistente.
- Targets ≥44 px.
- Skip link.
- Teclado completo.
- Labels programáticos y visibles.
- Error summary al inicio si hay múltiples errores (en este flow normalmente uno).
- `aria-live` para processing/result.
- Reduced motion.
- Tablas textuales equivalentes a charts.
- Nunca depender de color.

### Responsive
- **360 px:** una pregunta por pantalla, CTA sticky, no sidebars, charts apilados.
- **768 px:** card 640 px, navegación compacta.
- **1280 px:** content max 1120, calculator sigue estrecha para evitar dispersión; preview/report puede usar 2 columnas.

### Rendimiento percibido
- CSS/JS crítico inline o pequeño; no bloquear por fuentes externas.
- Motor local determinista.
- CLS <0.1 objetivo; reservar espacio de charts/skeleton.
- LCP landing <2.5 s en conexión móvil razonable.
- No cargar SDK de checkout hasta Fase 2/checkout.
- Analytics se envía después de interacción y sin health payload.

### Internacionalización
- ES/EN/PT desde `copy_i18n.json`.
- Decimal/fecha/moneda con `Intl`.
- Unidades: cm/in con misma-unit ratio; US standard drinks→UK units ×1.75; UK direct.
- No usar geolocalización precisa.
- Prices por locale solo desde tabla comercial validada; no inferir PPP en cliente.
- Contenido SEO país explica explícitamente el estado de calibración.

## Gates de go-live
Antes de público pagado: revisión regulatoria/claims por mercado, privacy/HBNR/GDPR/LGPD según corresponda, validación externa por subgrupos, protocolo reaction-time cerrado, WTP/precio local validado y revisión de naming.
