import { getTranslations } from 'next-intl/server';
import { Menu } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher, ThemeToggle } from './header-controls';
import { Wordmark } from './logo';

export async function SiteHeader() {
  const t = await getTranslations('nav');
  const links = [
    { href: '/how-it-works', label: t('howItWorks') },
    { href: '/methodology', label: t('methodology') },
    { href: '/faq', label: t('faq') },
  ] as const;

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/85 backdrop-blur-md supports-[backdrop-filter]:bg-bg/70">
      <div className="container-page flex h-16 items-center gap-2 sm:gap-3">
        <Link href="/" aria-label={t('home')} className="rounded-md">
          <Wordmark />
        </Link>
        <nav aria-label={t('primary')} className="ml-6 hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-muted hover:bg-surface-alt hover:text-fg"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <details className="group relative md:hidden">
            <summary
              className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-md border border-line bg-surface shadow-soft hover:bg-surface-alt [&::-webkit-details-marker]:hidden"
              aria-label={t('menu')}
            >
              <Menu className="size-5" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 mt-2 w-60 rounded-lg border border-line bg-surface p-2 shadow-float">
              <nav aria-label={t('primary')} className="flex flex-col">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="flex min-h-12 items-center rounded-md px-3 font-semibold hover:bg-surface-alt"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
