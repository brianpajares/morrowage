# MorrowAge — START HERE · Etapa 4

**Estado:** READY_TO_BUILD  
**Versión de paquete:** 4.0  
**Modelo/wrapper:** 2.1  
**Etapa completada:** 4  
**Validación del motor:** 18/18 vectores · tolerancia relativa `1e-6`  
**Monetización inicial:** `validation`

## Resultado
Este paquete acumula Etapas 1–3 y añade el PRD final, contratos API/DB, documentación para el LLM programador, plan de pruebas, operación, Drive, lanzamiento y tracción.

## Entrada validada
- `stage_completed=3`
- `status=PASS_WITH_FIXES`
- todos los JSON válidos
- `engine_reference.py` coincide con 18/18 `test_vectors.json`
- `drive_manifest.json`: archivos presentes y checksums válidos

## Guardrails finales
- MorrowAge = edad equivalente de riesgo poblacional.
- No riesgo absoluto 10y ni percentiles país en v1.
- UI/PDF de usuario: `<40` o `>69` fuera del rango, nunca raw exacto.
- Sensibilidad de medición, no intervalo de confianza.
- Analytics/admin sin health payload, raw result o report token/URL.
- En validation, el email operacional al dueño cumple el contrato de fábrica y se trata como dato sensible.
- Stripe apagado por defecto.
- Drive con checksum, cache 24h y last-known-good.

## Empieza aquí
Lee `README_START_HERE.md` y pega `BUILD_PROMPT.md` como primer mensaje al LLM programador.
