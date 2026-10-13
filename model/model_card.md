# Cómo funciona MorrowAge

**Versión del modelo:** 2.1 · **Fecha:** 6 de octubre de 2026

## Qué calcula

MorrowAge toma ocho datos sencillos —edad, sueño, percepción de salud, cigarrillos, tiempo de reacción, relación cintura/altura, alcohol semanal y pulso en reposo— y los combina con coeficientes publicados de un modelo de supervivencia Cox.

El resultado principal es una **edad equivalente de riesgo**. Si tu MorrowAge es 47 y tu edad cronológica es 52, significa que tu combinación de variables tiene un predictor de riesgo similar al de un perfil de referencia de menor edad dentro de este modelo. **No significa que tus órganos tengan 47 años ni que vivirás más o menos una cantidad concreta de años.**

## De dónde sale

El motor usa los coeficientes del modelo “raw-input” publicado por Clift y colaboradores en 2021 con datos de UK Biobank. El estudio analizó 420.560 personas, registró 16.188 muertes y reportó una c-statistic de 0,74 para ese modelo.

Fuente: https://mhealth.jmir.org/2021/2/e25655

## Qué tan confiable es

Una c-statistic de 0,74 indica capacidad útil de ordenar personas de mayor a menor riesgo dentro de la cohorte estudiada, pero no garantiza que el número esté perfectamente calibrado para cada país o persona.

MorrowAge v2.1 es especialmente transparente porque el cálculo se puede repetir con una fórmula local: no depende de un LLM ni de una API cerrada para generar la cifra.


## Guardrail de presentación añadido en QA

La transformación matemática puede producir una edad equivalente bruta menor de 40 o mayor de 69 aunque todos los inputs estén dentro de los guardrails. Como la cohorte fuente reclutó personas de 40–69 años, la interfaz **no muestra una cifra exacta fuera de ese rango**: presenta `<40` o `>69`. El valor bruto se conserva únicamente para auditoría y pruebas.

La sensibilidad de medición de v2.1 también es **bounds-aware**: cada perturbación se recorta al rango operativo del input. Así, un usuario con alcohol=0 no genera un escenario “bajo” con consumo negativo, y un input en su máximo no genera un escenario “alto” fuera de rango.

## Por qué no mostramos “riesgo de muerte a 10 años”

Un modelo Cox necesita, además de sus coeficientes, una curva de supervivencia basal para producir probabilidad absoluta. El artículo elegido no publica ese componente de forma que podamos reconstruirlo con la precisión exigida. MorrowAge no inventa ese dato.

La probabilidad absoluta a 10 años se habilitará únicamente después de recalibrar el modelo con una fuente oficial apropiada —por ejemplo, NHANES enlazado con mortalidad NCHS— y superar pruebas de calibración y validación.

## Límites

MorrowAge v2.1 está restringido a 40–69 años. No debe usarse durante embarazo, en enfermedad terminal, fuera de los rangos admitidos ni para tomar decisiones médicas. Sus variables son asociaciones poblacionales, no pruebas de causalidad.

El “rango” que puede aparecer en el informe completo muestra qué pasa cuando cambian razonablemente algunas mediciones. **No es un intervalo de confianza clínico.**

## Privacidad

El cálculo puede ejecutarse localmente con valores numéricos. Los ejemplos de desarrollo nunca usan datos personales reales. La captura de email para recibir un informe debe solicitar consentimiento de servicio y separarse de cualquier consentimiento de marketing. La analítica/admin no debe recibir inputs de salud ni resultados crudos: solo session ID seudónimo, locale/mercado, estado del funnel, versión de modelo, consentimientos y estado de entrega. Los enlaces de informe deben ser no adivinables, expirar y tener retención corta.

## Disclaimer

**ES:** MorrowAge es una estimación de bienestar y riesgo relativo basada en datos poblacionales. No diagnostica, no predice tu longevidad con certeza y no sustituye atención médica.

**EN:** MorrowAge is a population-based wellness and relative-risk estimate. It does not diagnose, predict your lifespan with certainty, or replace medical care.

**PT:** MorrowAge é uma estimativa populacional de bem-estar e risco relativo. Não diagnostica, não prevê sua longevidade com certeza e não substitui cuidados médicos.


## Estado de validación al cierre de Etapa 3

- Coeficientes principales: verificados contra Clift et al. 2021.
- Doble implementación: 18/18 vectores coinciden a tolerancia relativa 1e-6.
- Robustez adicional: 18/18 checks superados.
- Calibración absoluta, percentiles nacionales y validación externa por subgrupos: pendientes y bloqueados como claims/product features.
- Revisión regulatoria/privacidad por jurisdicción: requisito previo a lanzamiento público pagado.
