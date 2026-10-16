import type { MetadataRoute } from 'next';
import { getEnv } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  const base = getEnv().appUrl;
  const noindex = ['calculate', 'processing', 'preview', 'report-request', 'checkout', 'success', 'report', 'unlock', 'privacy/delete-request'];
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', ...noindex.flatMap((p) => [`/es/${p}`, `/en/${p}`, `/pt/${p}`])],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
