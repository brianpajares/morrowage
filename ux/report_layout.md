# Layout del informe PDF · MorrowAge

Formato recomendado: A4/Letter adaptable, 8 páginas máximas en v1; export accesible con tags/reading order si el stack lo permite. El PDF es una copia del informe web, no una superficie con claims adicionales.

## Página 1 · Resumen
- Marca + `Verification ID` (UUID corto no reversible, p. ej. `MA-26-8F3C2A`).
- Fecha, modelo `2.1`, locale.
- Edad cronológica.
- **MorrowAge de presentación**: cifra con 1 decimal solo dentro de 40–69; `<40`/`>69` fuera.
- Mensaje: “Edad equivalente de riesgo poblacional; no edad biológica.”
- Mini visual: dumbbell dentro de rango o boundary marker fuera.
- CTA/QR opcional al informe web **solo si el token no queda embebido en un QR público**; preferir URL corta autenticada/expirable.

## Página 2 · Qué significa / qué no significa
Dos columnas:
- Sí: comparación con benchmark del mismo modelo, basada en asociaciones poblacionales.
- No: diagnóstico, probabilidad absoluta a 10 años, lifespan, edad de órganos, causalidad.
Incluir el estado de calibración geográfica: “No calibrado específicamente para {country}” cuando corresponda.

## Página 3 · Sensibilidad de medición
Gráfico low/base/high bounds-aware.
Título exacto: **“Sensibilidad de medición”**.
Callout: **“No es un intervalo de confianza.”**
Tabla de deltas asumidos y guardrails aplicados. Si el MorrowAge de cualquiera de los escenarios queda fuera de 40–69, aplicar también `<40`/`>69`.

## Página 4 · Drivers
Barras divergentes de contribución al log-hazard vs benchmark.
Orden por `abs(contribution)`.
Cada fila: variable, valor del usuario, benchmark, contribución, etiqueta “asociación”.
No usar lenguaje “causó”, “te quitó X años” ni convertir contribuciones individualmente a años si no es aditivo.

## Página 5 · Escenarios
Hasta 3 escenarios elegidos por el usuario, todos dentro de guardrails.
Mostrar baseline vs escenario y qué input cambió.
Encabezado: “Escenarios educativos, no predicciones causales”.
No generar escenario automático que recomiende dormir menos, beber más o fumar.

## Página 6 · Próximos pasos educativos
- Separar “medición” de “salud”: mejorar calidad de captura (p. ej. repetir reacción/RHR en condiciones consistentes).
- Consejos generales solo desde fuentes wellness externas revisadas; nunca desde la dirección del coeficiente.
- Para dudas médicas, sugerir hablar con un profesional sin diagnosticar ni triagear desde el score.
No incluir medicamentos/suplementos.

## Página 7 · Supuestos y metodología
Tabla:
- fuente del modelo y licencia,
- cohorte,
- N/deaths/follow-up,
- c-statistic,
- fórmula de transformación,
- benchmark,
- rangos,
- sensibilidad,
- features bloqueadas.
Aclarar que c-statistic 0.74 **no significa 74% de precisión**.

## Página 8 · Fuentes, privacidad y disclaimer
Listado de fuentes con URL y fecha de verificación.
Privacidad: propósito del email, retención, borrado.
Disclaimer ES/EN/PT según locale.
`Verification ID`, model version, package version y checksum corto del payload estructurado **sin PII** para soporte/auditoría.

## Reglas visuales
- Nunca renderizar raw MorrowAge fuera de 40–69.
- No semáforo “verde/rojo” para una persona.
- Escala consistente y etiquetas directas.
- Gráficos acompañados por tabla/texto para accesibilidad.
- Footer en todas las páginas: “Educational population-based estimate · Not medical advice.”
