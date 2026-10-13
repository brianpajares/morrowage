# QA Report · MorrowAge · Etapa 3

**Fecha:** 2026-10-06  
**Veredicto:** **PASS_WITH_FIXES**  
**Modelo/wrapper verificado:** 2.1  
**Tolerancia numérica:** relativa `1e-6` (absoluta `1e-9` para valores próximos a cero).

## Resumen ejecutivo

El motor relativo es reproducible y coherente con los coeficientes publicados. La reimplementación independiente se realizó usando `model_spec.json` y `base_morrowage.xlsx` **antes de abrir `engine_reference.py`**. Los 18/18 vectores originales coincidieron. Después se comparó contra el motor de referencia y también coincidieron 18/18.

QA detectó y corrigió dos fallos de producto/model-wrapper relevantes: (1) la sensibilidad podía extrapolar inputs por debajo/encima de sus guardrails; (2) la inversión del término de edad podía producir edades equivalentes brutas fuera de 40–69 y la UI no tenía una política para evitar precisión aparente. v2.1 recorta perturbaciones por dirección y muestra `<40`/`>69` fuera del rango etario fuente, conservando el raw solo para auditoría.

No se habilita probabilidad absoluta a 10 años, percentiles nacionales ni claims de calibración local. Esos elementos siguen bloqueados hasta recalibración/validación externa.

## Inventario y entrada

- `handoff.json`: `stage_completed = 2` al ingreso — correcto.
- Presentes: `brief.json`, `model_spec.json`, `engine_reference.py`, `test_vectors.json`, `inputs.schema.json`, `outputs_spec.json`, `monetizacion.json`, `model_card.md`, `fuentes_datos.csv` y `base_morrowage.xlsx`.
- `drive_manifest.json` cubre la réplica bajo `02_datos_modelo/drive/`, no el ZIP completo. Se considera **manifiesto parcial por diseño**, no pérdida de archivos; se recalculan sus hashes tras las correcciones.
- Excel: 10 hojas, encabezados coherentes, sin errores de fórmula tras la reparación.

## A1 · Doble verificación

1. Implementación independiente: `03_qa_ux/qa_engine.py`.
2. Vectores iniciales de Etapa 2: **18/18** coinciden con `test_vectors.json` a `1e-6`.
3. Comparación posterior con `02_datos_modelo/engine_reference.py`: **18/18**.
4. Tras fixes v2.1: `qa_engine.py` vs `engine_reference.py`: **18/18**; referencia vs `test_vectors.json`: **18/18**.

Los coeficientes Cox no se modificaron. Los cambios afectan validación/presentación y la construcción del escenario de sensibilidad.

## A2 · Robustez

**18/18 checks adicionales superados.** Se cubren: edad debajo/encima de rango, cero fuera de rango, NaN, infinito, enteros fraccionales, enum inválido, campo faltante, campo extra, monotonicidad esperada para cigarrillos y reacción, equivalencia métrica/imperial del WHtR, conversión US drink→UK units, gramos→UK units, sensibilidad en mínimos/máximos y censura de display.

Hallazgo corregido: la sensibilidad anterior aplicaba un `sens_total_lp` simétrico aun cuando el input estaba en su límite. Ejemplo: con `alcohol_units_week=0`, el escenario “bajo” implicaba consumo negativo. v2.1 usa `Δdown=min(Δdefault, x-min)` y `Δup=min(Δdefault, max-x)` por input.

## A3 · Fuentes, cifras y licencias

### Parámetros críticos verificados

| Parámetro | Valor usado | Evidencia | Estado |
|---|---:|---|---|
| β log(age) | 3.8622 | Clift et al. 2021, Table 2 | verificado |
| β sleep | 0.0750 | Clift et al. 2021, Table 2 | verificado |
| β SRH good | 0.0964 | Clift et al. 2021, Table 2 | verificado |
| β SRH fair | 0.6310 | Clift et al. 2021, Table 2 | verificado |
| β SRH poor | 2.5479 | Clift et al. 2021, Table 2 | verificado |
| β cigarettes/day | 0.0685 | Clift et al. 2021, Table 2 | verificado |
| β reaction time | 0.0008 | Clift et al. 2021, Table 2 | verificado |
| β waist/height | 1.1679 | Clift et al. 2021, Table 2 | verificado |
| β alcohol/week | 0.0077 | Clift et al. 2021, Table 2 | verificado |
| β resting HR | 0.0133 | Clift et al. 2021, Table 2 | verificado |
| UKB mean sleep | 7.16 h | Clift et al. 2021 | verificado |
| UKB mean reaction | 558.03 ms | Clift et al. 2021 | verificado |
| UKB mean WHtR | 0.54 | Clift et al. 2021 | verificado |
| UKB mean alcohol | 14.34 UK units/week | Clift et al. 2021 | verificado |
| UKB mean RHR | 69.84 bpm | Clift et al. 2021 | verificado |
| US standard drink | 14 g ethanol | NIAAA | verificado |
| UK alcohol unit | 8 g ethanol | NHS | verificado |
| US drink→UK unit | 1.75 | 14/8 | verificado |

Fuente principal: https://mhealth.jmir.org/2021/2/e25655  
Copia indexada con tabla completa: https://pmc.ncbi.nlm.nih.gov/articles/PMC7925156/  
NIAAA: https://www.niaaa.nih.gov/alcohols-effects-health/what-standard-drink  
NHS: https://www.nhs.uk/live-well/alcohol-advice/calculating-alcohol-units/

### Revisión de licencias/condiciones de `fuentes_datos.csv`

| ID | Revisión | Estado QA |
|---|---|---|
| S01 | Artículo final JMIR; coeficientes publicados. | verificado |
| S02 | Política JMIR: artículos open-access bajo CC BY salvo indicación contraria, con atribución. | verificado |
| S03 | Artículo BMC/Springer indicado CC BY 4.0. | verificado |
| S04 | Paper Lancet verificable; derechos de reutilización de una calculadora/implementación derivada no están demostrados en el paquete. | **no_verificado** para implementación comercial |
| S05 | Artículo JMIR reutilizable según licencia editorial; el propio trabajo identifica el C-Score como propietario. MorrowAge usa los coeficientes raw-input, no ese score. | verificado_con_condiciones |
| S06 | Public-use LMF tiene variables limitadas y algunas sustituciones sintéticas por confidencialidad; restricted-use requiere RDC. Texto de Etapa 2 corregido. | **corregido** |
| S07 | Descarga NCHS oficial; aplicar Data User Agreement/condiciones del archivo. | verificado_con_condiciones |
| S08 | Referencia NCHS/CDC; uso factual. Revisar excepciones específicas si se redistribuye material. | verificado_con_condiciones |
| S09 | NHS Website Content se rige por OGL v3.0 con atribución/excepciones; “no redistribuir texto” era incorrecto. | **corregido** |
| S10 | NIAAA confirma 14 g; el producto reutiliza el dato factual, no gráficos/texto de terceros. | verificado_con_condiciones |
| S11 | Stripe 2.9% + US$0.30 domestic cards en pricing actual. | verificado |
| S12 | Resend Pro US$20/50k; US$0.0004 es coste asignado medio, no marginal. | **corregido** |
| S13 | Workers Paid desde US$5/mes; 10M requests y 30M CPU ms incluidos según pricing actual. | verificado |
| S14 | World Bank: CC BY 4.0 por defecto para datasets propios salvo etiqueta distinta; revisar metadata del indicador. | verificado_con_condiciones |

Evidencia adicional:  
JMIR license: https://manuscripts.jmir.org/publishing-policies/copyright-notice  
NHS terms: https://www.nhs.uk/our-policies/terms-and-conditions/  
NCHS LMF: https://www.cdc.gov/nchs/linked-data/mortality-files/index.html  
World Bank licensing: https://datacatalog.worldbank.org/public-licenses  
Stripe: https://stripe.com/pricing  
Cloudflare: https://www.cloudflare.com/plans/developer-platform/  
Resend: https://resend.com/changelog/pay-as-you-go-pricing

## A4 · Coherencia producto ↔ modelo ↔ monetización

Corregido el brief canónico: v1 ya no promete riesgo absoluto de mortalidad a 10 años, “intervalo de confianza”, rango 35–69 ni 3 drivers gratuitos. Se alinea a 40–69, MorrowAge + hazard relativo, 1 driver en preview y sensibilidad completa en informe.

`country_percentile` y comparativas poblacionales siguen bloqueados hasta validación local. La probabilidad absoluta sigue `NOT_AVAILABLE_V1`. El informe pago vende contexto, metodología, drivers, sensibilidad y escenarios educativos; no vende un output bloqueado.

## A5 · Legal, ética y privacidad

- **Claims:** MorrowAge se define como edad equivalente de riesgo poblacional; no “edad biológica”, diagnóstico ni predicción cierta de longevidad.
- **Regulación:** la guía FDA de enero de 2026 cubre productos general-wellness de bajo riesgo, pero un claim de mortalidad puede alterar el análisis por intended use. Revisión regulatoria formal antes del lanzamiento público pagado: **MAYOR / gate de go-live**, no bloqueo de esta Etapa 3.
- **Health data:** la FTC HBNR fue actualizada para aclarar cobertura de health apps y tecnologías similares. Se minimiza telemetría: el owner no recibe inputs/resultados de salud.
- **Sesgo/transporte:** la cohorte UK Biobank del estudio es predominantemente White; no se debe afirmar equivalencia de desempeño por país, sexo o grupo demográfico sin validación externa.
- **Acciones educativas:** nunca inferir causalidad del signo de los coeficientes. En particular, β de sueño positivo no autoriza recomendar dormir menos.

FDA: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/general-wellness-policy-low-risk-devices  
FTC HBNR: https://www.ftc.gov/legal-library/browse/rules/health-breach-notification-rule

## Hallazgos y correcciones

### CRÍTICO
**0 abiertos.** No se encontró discrepancia de fórmula/coficientes que invalide el motor relativo.

### MAYOR
1. **Sensibilidad extrapolaba inputs** — corregido en motor, Excel, spec y vectores.
2. **Output bruto fuera de rango podía presentarse como edad exacta** — corregido con `morrow_age_status/display` y censura UI.
3. **Brief prometía riesgo absoluto/IC no sustentados** — corregido en `brief.json` y marcado como superseded en Markdown.
4. **Telemetría/copia al owner incluía health inputs/results** — corregido a evento mínimo.
5. **Revisión regulatoria y validación externa por subgrupos** — permanecen abiertas como gates de lanzamiento, no como features activas.

### MENOR
1. NHS license mal descrita — corregida.
2. Resend `0.0004` llamado “marginal” — corregido a coste asignado medio.
3. Manifiesto parcial — documentado y hashes actualizados.

## Veredicto

**PASS_WITH_FIXES.** El paquete puede pasar al Agente 4 para PRD/paquete técnico, siempre que preserve los locks: sin riesgo absoluto, sin percentiles nacionales, sin claims de edad biológica y sin lanzamiento público pagado antes de revisión regulatoria/privacidad y validación externa acordes al mercado.
