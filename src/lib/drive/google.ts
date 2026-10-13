/**
 * Cliente mínimo de Google Drive API v3 con service account (JWT bearer, RS256 vía `jose`).
 * Sin SDK de Google: menos superficie, trivial de mockear con `fetch`.
 *
 * Seguridad: la clave privada solo vive en memoria; nunca se registra ni se incluye en errores.
 */
import { importPKCS8, SignJWT } from 'jose';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

export type DriveScope = 'readonly' | 'write';

export interface DriveCredentials {
  clientEmail: string;
  privateKey: string;
}

export class DriveHttpError extends Error {
  readonly status: number;
  readonly errorClass: string;
  constructor(status: number, errorClass: string) {
    super(`drive_http_${status}`);
    this.name = 'DriveHttpError';
    this.status = status;
    this.errorClass = errorClass;
  }
}

export interface DriveFileRef {
  id: string;
  name: string;
  mimeType: string;
  md5Checksum?: string;
}

type FetchFn = typeof fetch;

function escapeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export class GoogleDriveClient {
  private token?: { value: string; expiresAt: number };

  constructor(
    private readonly credentials: DriveCredentials,
    private readonly opts: { scope?: DriveScope; timeoutMs?: number; fetchFn?: FetchFn; now?: () => number } = {},
  ) {}

  private get fetchFn(): FetchFn {
    return this.opts.fetchFn ?? fetch;
  }

  private now(): number {
    return (this.opts.now ?? Date.now)();
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs ?? 4000);
    try {
      return await this.fetchFn(url, { ...init, signal: controller.signal });
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      throw new DriveHttpError(0, aborted ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt - 60_000 > this.now()) return this.token.value;
    const scope =
      this.opts.scope === 'write'
        ? 'https://www.googleapis.com/auth/drive'
        : 'https://www.googleapis.com/auth/drive.readonly';
    const key = await importPKCS8(this.credentials.privateKey.replace(/\\n/g, '\n'), 'RS256');
    const nowSec = Math.floor(this.now() / 1000);
    const assertion = await new SignJWT({ scope })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(this.credentials.clientEmail)
      .setSubject(this.credentials.clientEmail)
      .setAudience(TOKEN_URL)
      .setIssuedAt(nowSec)
      .setExpirationTime(nowSec + 3600)
      .sign(key);

    const res = await this.request(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    if (!res.ok) throw new DriveHttpError(res.status, 'auth');
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) throw new DriveHttpError(res.status, 'auth');
    this.token = { value: json.access_token, expiresAt: this.now() + (json.expires_in ?? 3600) * 1000 };
    return json.access_token;
  }

  private async authed(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.accessToken();
    const res = await this.request(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new DriveHttpError(res.status, res.status === 404 ? 'not_found' : res.status === 403 ? 'forbidden' : 'http');
    }
    return res;
  }

  /** Busca un hijo por nombre (carpeta o archivo) dentro de `parentId`. */
  async findChild(parentId: string, name: string, kind: 'folder' | 'file'): Promise<DriveFileRef | null> {
    const mime = kind === 'folder' ? `mimeType = '${FOLDER_MIME}'` : `mimeType != '${FOLDER_MIME}'`;
    const q = `'${escapeQuery(parentId)}' in parents and name = '${escapeQuery(name)}' and ${mime} and trashed = false`;
    const params = new URLSearchParams({
      q,
      fields: 'files(id,name,mimeType,md5Checksum)',
      pageSize: '2',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
    });
    const res = await this.authed(`${API}/files?${params}`);
    const json = (await res.json()) as { files?: DriveFileRef[] };
    return json.files?.[0] ?? null;
  }

  /** Resuelve `base/x.csv` bajo `rootFolderId`, segmento a segmento (por nombre, no por ID global). */
  async resolvePath(rootFolderId: string, relativePath: string): Promise<DriveFileRef | null> {
    const segments = relativePath.split('/').filter(Boolean);
    let parent = rootFolderId;
    for (let i = 0; i < segments.length; i++) {
      const isLast = i === segments.length - 1;
      const found = await this.findChild(parent, segments[i]!, isLast ? 'file' : 'folder');
      if (!found) return null;
      if (isLast) return found;
      parent = found.id;
    }
    return null;
  }

  async download(fileId: string): Promise<Uint8Array> {
    const params = new URLSearchParams({ alt: 'media', supportsAllDrives: 'true' });
    const res = await this.authed(`${API}/files/${encodeURIComponent(fileId)}?${params}`);
    return new Uint8Array(await res.arrayBuffer());
  }

  async ensureFolder(parentId: string, name: string): Promise<string> {
    const existing = await this.findChild(parentId, name, 'folder');
    if (existing) return existing.id;
    const res = await this.authed(`${API}/files?supportsAllDrives=true&fields=id`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    });
    return ((await res.json()) as { id: string }).id;
  }

  /** Crea o actualiza (upsert) un archivo por nombre dentro de la carpeta. */
  async upsertFile(
    parentId: string,
    name: string,
    bytes: Uint8Array,
    mimeType: string,
  ): Promise<{ id: string; action: 'created' | 'updated' }> {
    const existing = await this.findChild(parentId, name, 'file');
    if (existing) {
      const res = await this.authed(
        `${UPLOAD}/files/${encodeURIComponent(existing.id)}?uploadType=media&supportsAllDrives=true&fields=id`,
        { method: 'PATCH', headers: { 'content-type': mimeType }, body: bytes as unknown as BodyInit },
      );
      return { id: ((await res.json()) as { id: string }).id, action: 'updated' };
    }
    const boundary = `ma-${this.now().toString(36)}`;
    const meta = JSON.stringify({ name, parents: [parentId] });
    const head = Buffer.from(
      `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\ncontent-type: ${mimeType}\r\n\r\n`,
    );
    const tail = Buffer.from(`\r\n--${boundary}--`);
    const body = Buffer.concat([head, Buffer.from(bytes), tail]);
    const res = await this.authed(`${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id`, {
      method: 'POST',
      headers: { 'content-type': `multipart/related; boundary=${boundary}` },
      body: body as unknown as BodyInit,
    });
    return { id: ((await res.json()) as { id: string }).id, action: 'created' };
  }

  async getMd5(fileId: string): Promise<string | undefined> {
    const res = await this.authed(`${API}/files/${encodeURIComponent(fileId)}?fields=md5Checksum&supportsAllDrives=true`);
    return ((await res.json()) as { md5Checksum?: string }).md5Checksum;
  }
}

export function mimeTypeFor(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'json':
      return 'application/json';
    case 'csv':
      return 'text/csv';
    case 'md':
      return 'text/markdown';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'application/octet-stream';
  }
}
