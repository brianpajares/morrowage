# DRIVE_SETUP · MorrowAge

## Objetivo
La app lee archivos versionados desde `/Apps/morrowage/` mediante Google Drive API, verifica SHA-256 contra `spec/drive_manifest.json`, cachea 24 h y conserva la última versión válida si Drive falla.

## 1. Crear service account
1. Crear/usar un proyecto en Google Cloud.
2. Habilitar **Google Drive API**.
3. Crear una service account dedicada al runtime de MorrowAge.
4. Crear credencial JSON solo si el entorno la requiere. En Vercel se recomienda separar `client_email` y `private_key` en secretos.
5. No subir el JSON de credenciales al repositorio.

Variables:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_DRIVE_FOLDER_ID`
- `GOOGLE_DRIVE_APP_ROOT=/Apps/morrowage`
- `DRIVE_CACHE_TTL_SECONDS=86400`

## 2. Crear y compartir carpeta
1. En Drive crear `Apps/morrowage`.
2. Compartir `morrowage` con el email de la service account como Editor para sync o Viewer para runtime. Si se desea mínimo privilegio, usar una credencial/identidad distinta para sync.
3. Copiar el folder ID de `morrowage` a `GOOGLE_DRIVE_FOLDER_ID`.

Estructura esperada:
```text
/Apps/morrowage/
  base/
    base_morrowage.xlsx
    benchmark_reference.csv
    fuentes_datos.csv
  docs/
    model_card.md
  model/
    model_coefficients_v2.json
  templates/
    report_structure_v2.json
```

## 3. Implementar `npm run drive:sync`
Debe:
1. Leer `drive/` recursivamente.
2. Resolver/crear subcarpetas por nombre bajo `GOOGLE_DRIVE_FOLDER_ID`.
3. Upsert por path relativo, no por nombre global.
4. Calcular SHA-256 local.
5. Compararlo con `spec/drive_manifest.json`.
6. Rechazar upload si el manifest no coincide.
7. Imprimir resumen de archivos subidos/actualizados sin secretos.

Script sugerido: `tsx scripts/drive-sync.ts`.

`package.json`:
```json
{
  "scripts": {
    "drive:sync": "tsx scripts/drive-sync.ts"
  }
}
```

## 4. Runtime read
El loader:
- resuelve cada `drive_path` por segmentos;
- descarga por nombre/id;
- calcula SHA-256;
- compara con manifest;
- solo promueve a cache si todos los archivos requeridos son válidos;
- guarda snapshot `last-known-good`;
- TTL 24 h;
- ante timeout, 403/5xx, archivo faltante o checksum inválido usa last-known-good;
- si nunca existió versión válida, falla cerrado y no calcula resultados.

## 5. Seguridad
- Nunca loggear private key ni contenido sensible de usuarios.
- Drive solo contiene assets/configuración de producto, no informes personales.
- Rotar la credencial ante sospecha.
- Limitar scopes a Drive y acceso a la carpeta compartida.
- En CI usar mocks salvo test manual de integración.

## 6. Verificación
Antes de producción:
- `npm run drive:sync`
- test de checksum correcto
- test de archivo corrupto
- test de Drive caído con last-known-good
- confirmar que `spec/drive_manifest.json` cubre todos los archivos de `drive/`.
