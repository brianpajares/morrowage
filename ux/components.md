# Componentes · MorrowAge

## Principios
Un CTA primario por pantalla. Los componentes no deben sugerir precisión clínica. Toda cifra de riesgo lleva contexto de referencia/modelo y toda sensibilidad se denomina **escenario de medición**, nunca intervalo de confianza.

## Botones
- `Button/Primary`: altura mínima 48 px; light `#0F766E` + blanco; dark `#5EEAD4` + `#042F2E`. Estado loading conserva ancho y usa texto (“Calculando…”), no spinner solo.
- `Button/Secondary`: superficie + borde; acciones no principales.
- `Button/Link`: navegación secundaria. Focus visible 2 px y offset 2 px.
- Disabled solo cuando la acción es imposible; explicar validación inline antes de bloquear.

## Inputs
- Label visible persistente; helper y error asociados por `aria-describedby`.
- Estados: default, focus, valid, invalid, disabled. Error con icono + texto; no color solo.
- Edad/RHR/cigarrillos: teclado numérico; no aceptar fracciones donde el schema exige integer.
- Sueño/reacción/WHtR/alcohol: decimal localizado; normalizar al modelo antes de cálculo.
- `SelfRatedHealth`: 4 radio cards, no select en móvil.
- Unidades: selector segmentado métrico/imperial junto al input físico; preservar valor al convertir.
- Alcohol: UI puede capturar bebidas locales, pero muestra la conversión a UK units antes de confirmar.

## Slider
Solo cuando el usuario también puede teclear el valor. Nunca ocultar min/max. No usar para campos cuya precisión importa si el rango sería demasiado ancho (reaction time se mide, no se “adivina” con slider).

## Tarjeta de resultado
1. Eyebrow: “Edad equivalente de riesgo”.
2. Hero: `morrow_age_display`; si está fuera de rango, `<40`/`>69`, nunca raw.
3. Contexto: edad cronológica y “benchmark del mismo modelo”.
4. Hazard relativo como detalle secundario, no headline.
5. Disclosure fijo: “No es edad biológica ni probabilidad de muerte.”
6. Fuente/metodología expandible.

## Driver card / chart
Barra divergente de contribución al log-hazard. Mostrar nombre, dirección asociativa y nota “asociación ≠ causa”. Nunca traducir automáticamente `β>0` en “haz menos X”.

## Sensitivity range
Low/base/high con tres puntos y valores de presentación seguros. Etiqueta exacta: “Escenario de sensibilidad a medición”. Tooltip: “Muestra cómo cambia el resultado si algunas mediciones varían dentro de rangos razonables; no es un intervalo de confianza.”

## Paywall / email gate
Preview visible detrás con 3 bloques bloqueados: sensibilidad, todos los drivers, escenarios. Beneficio concreto antes del campo email. Fase 1: CTA “Enviarme el informe gratis”; Fase 2: “Desbloquear informe — US$19”. No mezclar newsletter con entrega.

## Toasts
Solo feedback no crítico. Errores de cálculo y validación permanecen inline. `role=status` para éxito; `role=alert` para fallo.

## Gráficos
- Cronológica vs equivalente: dumbbell/2 barras solo dentro 40–69.
- Fuera de rango: eje 40–69 con marcador pegado al borde y flecha de continuación; texto “fuera del rango de referencia”.
- Drivers: barras divergentes.
- Sensibilidad: interval/range plot de tres puntos.
- Trend futuro: línea temporal solo con ≥3 mediciones y modelos/versiones comparables.
- Todos incluyen tabla accesible equivalente.

## Loading / processing
Skeleton breve + etapas honestas: “Validando datos → Calculando → Preparando contexto”. No simular IA ni porcentajes falsos. Si cálculo local tarda <300 ms, mantener transición de ~400–700 ms solo para continuidad visual, respetando `prefers-reduced-motion`.

## Accesibilidad
Touch targets ≥44×44 px; contraste AA; navegación completa por teclado; orden de foco DOM=lógico; skip link; `aria-live` para errores/resultados; no usar placeholder como label; gráficos con resumen textual y tabla; idioma `lang` actualizado al cambiar ES/EN/PT.
