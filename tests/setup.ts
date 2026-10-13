// Entorno determinista y sin servicios externos para los tests de unidad/integración.
// APP_ENV=test activa los adaptadores en memoria (nunca permitido en producción real,
// ver src/lib/env.ts).
const env = process.env as Record<string, string | undefined>;
env.APP_ENV = 'test';
env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
env.MONETIZATION_MODE = 'validation';
env.STRIPE_ENABLED = 'false';
env.OWNER_EMAIL = 'owner@morrowage.test';
env.EMAIL_FROM = 'MorrowAge <reports@morrowage.test>';
env.REPORT_TOKEN_TTL_HOURS = '168';
env.REPORT_RETENTION_DAYS = '30';
env.SESSION_PEPPER = 'test-only-pepper-0000000000000000';
