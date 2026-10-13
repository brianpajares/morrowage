import { ImageResponse } from 'next/og';
import { isLocale, type Locale } from '@/lib/locales';
import { getMessages } from '@/messages';

export const alt = 'MorrowAge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l: Locale = isLocale(locale) ? locale : 'es';
  const m = getMessages(l);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: 'linear-gradient(135deg, #F8FAFC 0%, #E6F4F1 100%)',
          color: '#0F172A',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: '#0F766E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 26, height: 26, borderRadius: 13, background: '#FFFFFF' }} />
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>MorrowAge</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>{m.landing.h1}</div>
          <div style={{ fontSize: 30, color: '#475569', maxWidth: 960 }}>{m.brand.tagline}</div>
        </div>
        <div style={{ fontSize: 24, color: '#0F766E', fontWeight: 700 }}>{m.landing.trust}</div>
      </div>
    ),
    size,
  );
}
