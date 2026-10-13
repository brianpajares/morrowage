/**
 * AT-36 · el repo no contiene marcadores pendientes, secretos reales ni `example.com` fuera de
 * documentación. Escanea código y configuración propios (no el paquete de especificación, que es
 * documentación de entrada).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SCAN = ['src', 'scripts', 'supabase', 'tests', '.github', 'README.md', 'vercel.json', 'next.config.ts', 'package.json'];
const SKIP_DIRS = new Set(['node_modules', '.next', '.scratch', 'test-results', 'playwright-report']);
const SELF = path.join('scripts', 'check-placeholders.ts');

const PATTERNS: Array<[string, RegExp]> = [
  ['marcador pendiente', /\b(TODO|FIXME|XXX|TBD|HACK)\b/],
  ['texto de relleno', /lorem ipsum|\[(?:PLACEHOLDER|INSERT[^\]]*|A DEFINIR)\]/i],
  ['example.com en runtime', /example\.com/i],
  ['clave Stripe live', /\b(sk|pk|rk)_live_[A-Za-z0-9]{8,}/],
  ['clave AWS', /\bAKIA[0-9A-Z]{16}\b/],
  ['clave privada embebida', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s*[A-Za-z0-9+/=\r\n]{40,}/],
  ['token GitHub', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['JWT embebido', /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/],
];

function* walk(p: string): Generator<string> {
  const abs = path.join(ROOT, p);
  if (!fs.existsSync(abs)) return;
  const st = fs.statSync(abs);
  if (st.isFile()) return void (yield p);
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.isDirectory() && SKIP_DIRS.has(e.name)) continue;
    yield* walk(path.join(p, e.name));
  }
}

const findings: string[] = [];
for (const entry of SCAN) {
  for (const file of walk(entry)) {
    if (file === SELF || !/\.(ts|tsx|mjs|cjs|js|json|md|yml|yaml|sql|css)$/.test(file)) continue;
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    for (const [name, re] of PATTERNS) {
      const m = re.exec(text);
      if (m) findings.push(`${file}: ${name} → «${m[0].slice(0, 40)}»`);
    }
  }
}

if (findings.length) {
  console.error(`check:placeholders — ${findings.length} hallazgo(s):\n${findings.map((f) => ` - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('check:placeholders OK — sin marcadores pendientes ni secretos reales.');
