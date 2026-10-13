# README_START_HERE · MorrowAge BUILD v4

**Estado:** READY_TO_BUILD  
**Origen:** paquete acumulativo Etapa 1 → 4  
**Modelo:** wrapper 2.1, 18/18 vectores verificados  
**Monetización inicial:** `validation`

## Qué hay en este ZIP
- `BUILD_PROMPT.md`: primer mensaje para Codex, Claude Code o Antigravity.
- `AGENTS.md` / `CLAUDE.md`: reglas persistentes de implementación.
- `TASKS.md`: backlog M0–M5.
- `.env.example`: contrato único de variables.
- `docs/PRD.md` y `docs/PRD.docx`: requerimientos completos.
- `docs/ACCEPTANCE_TESTS.md`: criterios verificables.
- `docs/DRIVE_SETUP.md`: Drive API + `npm run drive:sync`.
- `docs/LAUNCH_CHECKLIST.md`: go-live.
- `docs/TRACTION_PLAN.md`: 14 días.
- `docs/final_audit.md`: auditoría de empaquetado.
- `spec/`: schemas, OpenAPI, SQL/RLS, modelo, outputs, analítica, i18n y manifest.
- `model/`: motor Python de referencia, QA independiente, model card e ingest.
- `ux/`: UX spec, sitemap, componentes, report layout y prototipo.
- `drive/`: archivos que la app debe leer/sincronizar en Google Drive.
- `handoff.json`: estado de fábrica y decisiones.
- `01_estrategia/`, `02_datos_modelo/`, `03_qa_ux/`: trabajo previo preservado.

## Orden de lectura
1. `BUILD_PROMPT.md`
2. `docs/PRD.md`
3. `spec/inputs.schema.json`, `spec/outputs_spec.json`, `spec/model_spec.json`
4. `spec/test_vectors.json`
5. `ux/ux_spec.md`, `ux/components.md`, `ux/report_layout.md`
6. `spec/openapi.yaml`, `spec/db_schema.sql`
7. `TASKS.md`
8. `docs/ACCEPTANCE_TESTS.md`
9. `docs/DRIVE_SETUP.md`
10. `docs/LAUNCH_CHECKLIST.md`

## Guardrails innegociables
- MorrowAge = edad equivalente de riesgo poblacional; nunca edad biológica.
- No riesgo absoluto 10y ni percentiles nacionales en v1.
- Fuera de 40–69, UI/PDF/email de usuario muestra `<40` o `>69`, nunca el raw exacto.
- Sensibilidad = escenario de medición bounds-aware, no intervalo de confianza.
- Analytics/admin no reciben inputs de salud, resultado crudo ni report URL/token.
- `validation` es el default. Stripe permanece apagado hasta evidencia + gates.
- El cálculo numérico no usa LLM.
- No inventar requisitos ni parámetros; registrar decisiones nuevas en `DECISIONS.md`.

## Comandos esperados del repo construido
```bash
npm install
npm run lint
npm run typecheck
npm test
npm run test:vectors
npm run test:e2e
npm run build
npm run drive:sync
```

El programador debe convertir este paquete en una aplicación funcional desplegable, no en otro documento.
