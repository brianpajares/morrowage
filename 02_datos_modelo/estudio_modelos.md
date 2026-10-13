# Estudio de modelos — MorrowAge v2.0

**Fecha de verificación:** 2026-10-06  
**Decisión:** modelo principal publicado y reproducible; salida v1 ajustada a edad equivalente de riesgo + hazard relativo. La probabilidad absoluta a 10 años queda bloqueada hasta recalibración local.

## Criterio de selección

La estrategia de etapa 1 pedía mortalidad a 10 años y “Healthspan Age”. Para una app B2C, el número principal debe salir de una fórmula auditable, con licencia compatible, inputs razonables y baja dependencia externa. Se priorizó evidencia revisada por pares, coeficientes completos y ausencia de coste por consulta.

| Candidato | Tipo | Evidencia / precisión reportada | Licencia comercial | Coste por consulta | Latencia | Explicabilidad | Dependencia externa | Decisión |
|---|---|---|---|---:|---|---|---|---|
| **Clift et al. 2021, raw-input Cox model 3** | Cox publicado | UK Biobank N=420,560; 16,188 muertes; c-statistic 0.74 | Artículo final JMIR CC BY; coeficientes publicados reutilizables con atribución | ~0 | Local, ms | Alta: 8 términos y coeficientes | Ninguna en runtime | **PRINCIPAL** |
| **Ajnakina et al. 2021** | Cox-Lasso publicado | 10 años; c-index 0.74 interno y 0.69 externo | CC BY 4.0 | ~0 | Local, ms | Alta, pero más variables | Ninguna | **RESPALDO metodológico** |
| Ganna & Ingelsson 2015 / UK Biobank | Cox por sexo, autorreporte | 5 años; c-index 0.80 hombres y 0.79 mujeres | Publicación científica; derechos de calculadora/implementación comercial no confirmados | ~0 si fórmula propia | Local | Media-alta | Riesgo de licencia/implementación | Descartado para producción |
| Elnakib et al. 2022 C-Score NHANES | Validación/adaptación | AUC original ~0.72; age+C-score ~0.75; modelos expandidos mayores | Artículo CC BY, pero el propio paper indica que C-Scores son propietarios | ~0 | Local | Alta | Licencia del score | Descartado |
| NHANES 1999–2018 + NCHS Linked Mortality | ML/Cox entrenable | Fuente oficial; mortalidad enlazada hasta 2019; precisión depende de entrenamiento | Datos públicos NCHS/CDC; revisar condiciones del release concreto | ~0 | Local | Variable según modelo | Pipeline de datos/entrenamiento | **Objetivo de recalibración US** |
| NCHS US Life Tables 2024 | Tabla oficial + interpolación | Mortalidad poblacional oficial, no personalizada | Material federal público salvo excepciones | ~0 | Local | Muy alta | Actualización periódica | Baseline/benchmark, no motor individual |

## Modelo principal

Se elige **Clift et al. (2021), raw-input Cox proportional hazards model 3** porque publica ocho coeficientes de inputs que un consumidor puede aportar o medir en una web, tiene discriminación reportada de 0.74, no requiere API de terceros y el artículo final está bajo CC BY. Se evita el “C-Score” propietario: MorrowAge usa directamente los coeficientes del Cox publicados en el artículo.

Coeficientes:
- `ln(age)`: 3.8622
- sueño (h): 0.0750
- salud autorreportada: excellent 0; good 0.0964; fair 0.6310; poor 2.5479
- cigarrillos/día: 0.0685
- reaction time (ms): 0.0008
- waist-to-height ratio: 1.1679
- unidades UK de alcohol/semana: 0.0077
- resting heart rate (bpm): 0.0133

## Limitación que obliga a pivot técnico de la salida

El paper publica los coeficientes del Cox pero **no publica la supervivencia basal `S0(t)` que permitiría reconstruir una probabilidad absoluta a 10 años**. Un Cox permite calcular razones de hazard con los coeficientes, pero `P(death by 10y)=1-S0(10)^exp(η)` exige ese baseline. Por el estándar “ninguna cifra inventada”, la v1 no mostrará mortalidad absoluta a 10 años.

En su lugar se usa una transformación exacta y auditable del predictor lineal:

`MorrowAge = age × exp((η_nonage - η_ref_nonage) / 3.8622)`

donde el benchmark conserva las medias publicadas de UK Biobank para sueño, reaction time, WHtR, alcohol y RHR, una media ponderada de la categoría de salud y fija tabaco en 0 como benchmark explícito de “never-smoker”. **No se presenta ese 0 como media poblacional.**

La probabilidad absoluta a 10 años se desbloquea solo cuando se entrene/recalibre un baseline US con NHANES + NCHS Linked Mortality y pase validación externa.

## Modelo de respaldo

Ajnakina et al. 2021 ofrece un Cox-Lasso a 10 años con coeficientes publicados y CC BY 4.0. Sirve como respaldo metodológico y como posible motor para cohortes de mayor edad, pero su set de inputs y población lo hacen menos adecuado para la UX 40–69 de MorrowAge v1.

## Alcohol: normalización de unidades

El coeficiente original usa unidades de alcohol de UK. NHS define 1 unidad como 8 g de alcohol puro. NIAAA define una bebida estándar de EE.UU. como 14 g, por lo que:

`1 US standard drink = 14/8 = 1.75 UK units`

La interfaz debe ofrecer conversión local, pero el motor siempre recibe `alcohol_units_week`.

## Validez y seguridad

- Rango v1: **40–69 años**, alineado con el reclutamiento del modelo; se rechaza 35–39 en vez de extrapolar.
- MorrowAge es **edad equivalente de riesgo**, no “edad biológica”.
- Todos los coeficientes son asociaciones; no deben transformarse en causalidad. El coeficiente positivo de sueño, por ejemplo, **no** implica recomendar menos sueño.
- El rango de incertidumbre v1 es un **escenario de sensibilidad a error de medición**, no un intervalo de confianza.
- UK Biobank no garantiza calibración US, UK nacional ni otros países. Country percentile y probabilidad absoluta quedan cerrados hasta validación local.

## Fuentes primarias

1. Clift AK et al. JMIR mHealth and uHealth (2021): https://mhealth.jmir.org/2021/2/e25655  
2. Política de copyright JMIR: https://mhealth.jmir.org/publishing-policies/copyright-notice  
3. Ajnakina O et al. BMC Medical Research Methodology (2021): https://link.springer.com/article/10.1186/s12874-020-01204-7  
4. Ganna A, Ingelsson E. Lancet (2015), PubMed: https://pubmed.ncbi.nlm.nih.gov/26049253/  
5. Elnakib A et al. JMIR (2022): https://www.jmir.org/2022/6/e36787/  
6. NCHS Linked Mortality: https://www.cdc.gov/nchs/linked-data/mortality-files/index.html  
7. NCHS Life Tables: https://www.cdc.gov/nchs/products/life_tables.htm  
8. NHS alcohol units: https://www.nhs.uk/live-well/alcohol-advice/calculating-alcohol-units/  
9. NIAAA standard drink: https://www.niaaa.nih.gov/health-professionals-communities/core-resource-on-alcohol/basics-defining-how-much-alcohol-too-much

## Decisiones para Agente 3

QA debe tratar como bloqueante cualquier copy que llame a MorrowAge “biological age”, que muestre una probabilidad de muerte a 10 años en v1, que compare percentiles nacionales no calibrados, o que convierta asociaciones en recomendaciones clínicas.
