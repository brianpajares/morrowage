# TRACTION_PLAN · primeros 14 días

## Objetivo
Validar que el valor gratuito genera intención real antes de activar cobro. `MONETIZATION_MODE=validation` durante todo el periodo salvo decisión formal posterior.

## Metas de decisión
- preview→email: **>=25%** mínimo; objetivo **>=28%**.
- solicitudes de informe: **>=50 en 14 días**.
- start→preview: **>=70%**.
- report open: **>=45%** cuando haya al menos 100 entregas.
- median time-to-preview: **<=75 s**.
- calculation error <0.5%; delivery fail <2%.
- Cero incidentes materiales de seguridad, claims o privacidad.

Además, para activar cobro se revisan los 4 thresholds de `spec/monetizacion.json`; se exige consistencia en dos cohortes semanales y ausencia de blockers.

## Canales
1. **SEO/owned:** landing, how-it-works, methodology y FAQ; publicar 3 piezas ES/EN/PT sobre risk-equivalent age, límites de biological age calculators y cómo interpretar asociaciones.
2. **Comunidades:** aportar metodología y pedir feedback en comunidades de quantified self/longevity sin claims médicos ni spam.
3. **Creadores micro:** 5–10 outreachs a creadores de fitness/longevity con demo y disclosure claro.
4. **Partnerships:** 5 wellness coaches/gimnasios para pruebas educativas; prohibido uso clínico/empleo/seguro.
5. **Referral manual:** compartir link tras report delivery; no incluir resultados personales por defecto en cards.

## Calendario
| Día | Acción | Meta |
|---|---|---|
| 1 | Smoke real, analytics y deliverability | 10 sesiones internas/amistosas sin datos reales persistidos |
| 2 | Publicar landing + metodología | primer tráfico orgánico |
| 3 | Outreach comunidades #1 | 20 starts |
| 4 | Revisar drop-off por step | corregir fricción no-modelo |
| 5 | Outreach creadores #1 | 10 respuestas/visitas |
| 6 | Contenido educativo #2 | elevar landing→start |
| 7 | Cohorte semanal #1 | decidir fixes, no precio |
| 8 | Partnership outreach | 5 contactos |
| 9 | Comunidad #2 | 20 starts adicionales |
| 10 | Test copy gate A/B | mejorar preview→email sin dark patterns |
| 11 | Contenido ES/PT | ampliar señal fuera de EN |
| 12 | Outreach creadores #2 | 1 colaboración |
| 13 | QA de emails/report opens | delivery fail <2% |
| 14 | Cohorte semanal #2 | decisión: seguir validation o preparar Stripe |

## Mensajes
**Core:** “8 inputs, under 90 seconds, a transparent risk-equivalent age — not biological age or a diagnosis.”

**Gate:** “Get the context, not just the number. Your full report includes measurement sensitivity, drivers, assumptions and methodology.”

## Decisiones al día 14
- **Preparar cobro:** >=25% preview→email, >=50 requests, señales del monetization spec, y sin blockers.
- **Seguir validation:** buena conversión pero volumen insuficiente o WTP incierto.
- **Iterar producto:** start→preview <70% o gate <20%.
- **Pausar adquisición:** error, privacidad, claims o sesgo material.
