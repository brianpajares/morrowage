import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * next-intl se configura a mano (equivale a `createNextIntlPlugin`): el plugin carga `@swc/core`
 * (solo para su extractor de mensajes, que no usamos), cuyo binario nativo falla en Windows cuando
 * el directorio de caché hereda ACLs de AppContainer. Registrar el alias `next-intl/config` es todo
 * lo que el plugin hace sin `experimental.extract/messages`. Ver DECISIONS.md (2026-10-07).
 */
const REQUEST_CONFIG = './src/i18n/request.ts';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * CSP (AT-31). Decisión (DECISIONS.md): sin nonce por petición para poder prerenderizar las rutas
 * públicas (Lighthouse/LCP). Se mantiene `'unsafe-inline'` solo para scripts/estilos inline de Next
 * y el script de tema; el resto es restrictivo (object-src none, base-uri self, frame-ancestors none,
 * connect-src acotado a los proveedores usados).
 */
/**
 * PayPal Checkout (botones + popup): scripts del SDK, conexiones, iframes de los botones e imágenes.
 * Sin estos dominios los botones no cargan (lección #16 del playbook de monetización).
 */
const PAYPAL_SCRIPT = 'https://www.paypal.com https://www.paypalobjects.com';
const PAYPAL_CONNECT = 'https://www.paypal.com https://www.sandbox.paypal.com https://*.paypal.com';
const PAYPAL_FRAME = 'https://www.paypal.com https://www.sandbox.paypal.com';
const PAYPAL_IMG = 'https://www.paypalobjects.com https://*.paypal.com';

/**
 * `upgrade-insecure-requests` solo en Vercel: en http://localhost WebKit no lo exime y reescribe CSS/JS
 * a https (lección #17: fallaban 38 pruebas E2E solo en WebKit).
 */
const upgradeInsecure = process.env.VERCEL === '1' ? ['upgrade-insecure-requests'] : [];

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://challenges.cloudflare.com ${PAYPAL_SCRIPT}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${PAYPAL_IMG}`,
  "font-src 'self'",
  `connect-src 'self' https://challenges.cloudflare.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://*.ingest.de.sentry.io ${PAYPAL_CONNECT}`,
  `frame-src https://challenges.cloudflare.com ${PAYPAL_FRAME}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...upgradeInsecure,
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // `same-origin` rompe el popup de PayPal (lección #16): se permiten los popups que abre la propia página.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://www.paypal.com" "https://www.sandbox.paypal.com"), usb=(), interest-cohort=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
];

const nextConfig: NextConfig = {
  turbopack: { resolveAlias: { 'next-intl/config': REQUEST_CONFIG } },
  webpack(config: { context: string; resolve?: { alias?: Record<string, string> } }) {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias['next-intl/config'] = path.resolve(config.context, REQUEST_CONFIG);
    return config;
  },
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['@react-pdf/renderer'],
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.APP_VERSION ?? '4.0.0',
    NEXT_PUBLIC_MODEL_VERSION: process.env.MODEL_VERSION ?? '2.1',
  },
  // El snapshot de Drive empaquetado (last-known-good inicial) debe viajar con las funciones.
  outputFileTracingIncludes: {
    '/**/*': ['./drive/**/*'],
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Datos personales / tokens: nunca cachear ni indexar.
      {
        source: '/api/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      {
        // Enlace de pago personal (contiene el token): nunca cachear, indexar ni filtrar por Referer.
        source: '/:locale(es|en|pt)/unlock/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
      {
        source: '/:locale(es|en|pt)/report/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        ],
      },
    ];
  },
};

export default nextConfig;
