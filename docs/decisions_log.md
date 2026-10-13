# DECISIONS LOG · Etapa 4

1. Renombrar la idea de trabajo BioAge a MorrowAge para evitar colisión de posicionamiento con BioAge Labs, múltiples apps BioAge y marcas existentes.
2. Elegir un modelo de supervivencia calibrado a mortalidad real, no un quiz heurístico ni un LLM.
3. Convertir probabilidad de mortalidad a una edad equivalente poblacional para mantener el gancho de 'edad' sin afirmar medición epigenética.
4. Mantener inputs bajo 90 segundos y sin laboratorio, wearable obligatorio ni instrumento.
5. Mostrar sensibilidad de medición claramente etiquetada y explicación de contribuyentes como rasgo central de confianza; no llamarla intervalo de confianza.
6. Usar email gate para informe completo en Fase 1 y pago por informe en Fase 2.
7. Evitar claims de diagnóstico, prevención o tratamiento para permanecer en territorio de general wellness de bajo riesgo, sujeto a revisión legal.
8. Seleccionar como motor principal Clift et al. 2021 raw-input Cox model 3: coeficientes publicados, c-statistic 0.74, ejecución local y artículo final JMIR bajo CC BY.
9. No implementar ni reutilizar el C-Score propietario; usar únicamente los coeficientes raw-input publicados.
10. Cambiar la salida numérica v1 desde probabilidad absoluta de mortalidad a 10 años a MorrowAge (edad equivalente de riesgo) + hazard relativo, porque el paper no publica S0(10) y no se inventará baseline survival.
11. Definir MorrowAge como edad equivalente frente a un benchmark documentado (medias continuas UKB publicadas + salud autorreportada ponderada + benchmark never-smoker), no como edad biológica ni como edad poblacional nacional calibrada.
12. Restringir el rango v1 de 35–69 a 40–69 años para no extrapolar fuera del rango de reclutamiento del estudio principal.
13. Sustituir la hipótesis de inputs de etapa 1 por los 8 inputs exactos del modelo publicado: edad, sueño, salud autorreportada, cigarrillos/día, reaction time, cintura/altura, alcohol UK units/semana y resting HR.
14. Tratar los min/max numéricos distintos de edad como guardrails de producto preliminares, no como extremos de entrenamiento publicados.
15. Llamar al rango mostrado 'sensibilidad de medición', no intervalo de confianza; los deltas de medición son preliminares.
16. Mantener el precio ancla US$19 y precios locales de etapa 1 como hipótesis; usar World Bank PA.NUS.PRVT.PP antes de activar cada mercado y no presentarlos como PPP verificado aún.
17. Marcar etapa 2 DATA_PARTIAL: el motor relativo es reproducible y QA-ready, pero el target absoluto a 10 años y percentiles nacionales permanecen bloqueados hasta recalibración.
18. Etapa 3: corregir sensibilidad para que sea bounds-aware por dirección y nunca genere escenarios fuera de guardrails.
19. Etapa 3: conservar MorrowAge bruto para QA, pero censurar en UI cualquier valor fuera de 40–69 como <40 o >69.
20. Etapa 3: alinear brief/output/monetización: no riesgo absoluto 10y, no IC, 1 driver free, comparativas locales bloqueadas.
21. Etapa 3: minimizar telemetría; analytics/admin no recibe inputs de salud, score crudo ni report URL.
22. Etapa 3: sistema UX de 8 pasos, valor <90 s, un CTA por pantalla y gate con beneficio explícito.

## Decisiones añadidas en Etapa 4
- Adoptar `MONETIZATION_MODE=validation` como default y mantener Stripe detrás de `STRIPE_ENABLED`.
- Mantener el admin sin health payload, pero cumplir el contrato de fábrica enviando al `OWNER_EMAIL` el detalle sensible y PDF en validation; tratar ese buzón como sistema operacional sensible de acceso mínimo.
- Usar Supabase para cálculos de retención corta, leads, informes/tokens, pedidos y webhooks; el frontend admin no tiene RLS de lectura sobre `calculations`.
- Usar Google Drive como fuente versionada de assets/config y jamás como almacenamiento de informes personales.
- Definir token de report como valor aleatorio no persistido en plano; DB almacena hash.
- Mantener umbral mínimo de consideración de cobro en >=25% preview→email y >=50 solicitudes/14 días, complementado con el scorecard de monetización existente.
- Reconocer el D.S. 016-2024-JUS como reglamento vigente de Ley 29733 desde 31-03-2025; revisión legal sigue siendo gate de lanzamiento.
