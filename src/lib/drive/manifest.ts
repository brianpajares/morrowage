import manifestJson from '@spec/drive_manifest.json';

export interface DriveManifestFile {
  file: string;
  drive_path: string;
  purpose: string;
  format: string;
  reader: string;
  sha256: string;
  version: string;
}

export interface DriveManifest {
  app_slug: string;
  version: string;
  root: string;
  files: DriveManifestFile[];
}

export const driveManifest: DriveManifest = manifestJson as DriveManifest;

/** Archivos que el runtime exige para promover un snapshot (todos los del manifest). */
export const REQUIRED_FILES: readonly string[] = driveManifest.files.map((f) => f.file);

/** Ruta relativa a la carpeta raíz de la app: `/Apps/morrowage/base/x.csv` → `base/x.csv`. */
export function relativeDrivePath(entry: DriveManifestFile, manifest: DriveManifest = driveManifest): string {
  const root = manifest.root.endsWith('/') ? manifest.root : `${manifest.root}/`;
  if (!entry.drive_path.startsWith(root)) {
    throw new Error(`drive_manifest: ${entry.drive_path} no cuelga de ${manifest.root}`);
  }
  return entry.drive_path.slice(root.length);
}
