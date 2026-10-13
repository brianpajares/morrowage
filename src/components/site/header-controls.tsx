'use client';

import { useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Monitor, Moon, Sun } from 'lucide-react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { LOCALES, type Locale } from '@/lib/locales';

const LABELS: Record<Locale, string> = { es: 'ES', en: 'EN', pt: 'PT' };
const NAMES: Record<Locale, string> = { es: 'Español', en: 'English', pt: 'Português' };

export function LocaleSwitcher() {
  const t = useTranslations('a11y');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="relative">
      <label htmlFor="locale-switch" className="sr-only">
        {t('language')}
      </label>
      <select
        id="locale-switch"
        value={locale}
        onChange={(e) => router.replace(pathname, { locale: e.target.value as Locale })}
        className="min-h-11 w-[4.25rem] cursor-pointer rounded-md border border-line bg-surface px-2 text-sm font-bold text-fg shadow-soft hover:border-primary/60"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l} lang={l} title={NAMES[l]}>
            {LABELS[l]}
          </option>
        ))}
      </select>
    </div>
  );
}

type Theme = 'system' | 'light' | 'dark';
const ORDER: Theme[] = ['system', 'light', 'dark'];

function readTheme(): Theme {
  try {
    const v = localStorage.getItem('ma-theme');
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function subscribeTheme(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener('ma-theme', cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener('ma-theme', cb);
  };
}

export function ThemeToggle() {
  const t = useTranslations('a11y');
  // El servidor siempre renderiza "system"; el cliente lee localStorage sin setState en efectos.
  const theme = useSyncExternalStore<Theme>(subscribeTheme, readTheme, () => 'system');

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length]!;
    try {
      if (next === 'system') localStorage.removeItem('ma-theme');
      else localStorage.setItem('ma-theme', next);
    } catch {
      /* almacenamiento no disponible: el tema solo dura la sesión */
    }
    const root = document.documentElement;
    if (next === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', next);
    window.dispatchEvent(new Event('ma-theme'));
  }

  const label = theme === 'system' ? t('themeSystem') : theme === 'light' ? t('themeLight') : t('themeDark');
  const Icon = theme === 'system' ? Monitor : theme === 'light' ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={cycle}
      className="inline-flex size-11 items-center justify-center rounded-md border border-line bg-surface text-fg shadow-soft hover:bg-surface-alt"
      aria-label={`${t('theme')}: ${label}`}
      title={`${t('theme')}: ${label}`}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}
