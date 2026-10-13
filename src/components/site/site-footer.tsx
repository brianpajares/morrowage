import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Wordmark } from './logo';

export async function SiteFooter() {
  const t = await getTranslations('footer');
  const nav = await getTranslations('nav');
  const year = new Date().getUTCFullYear();
  return (
    <footer className="mt-24 border-t border-line bg-surface-alt/60">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <Wordmark />
          <p className="max-w-sm text-sm text-muted">{t('tagline')}</p>
          <p className="max-w-sm text-sm font-semibold">{t('notMedical')}</p>
        </div>
        <nav aria-label={t('methodology')} className="space-y-2 text-sm">
          <p className="font-semibold">{nav('methodology')}</p>
          <ul className="space-y-1">
            <FooterLink href="/how-it-works">{nav('howItWorks')}</FooterLink>
            <FooterLink href="/methodology">{t('methodology')}</FooterLink>
            <FooterLink href="/faq">{nav('faq')}</FooterLink>
            <FooterLink href="/guides/risk-equivalent-age-vs-biological-age">{t('guides')}</FooterLink>
          </ul>
        </nav>
        <nav aria-label={t('legal')} className="space-y-2 text-sm">
          <p className="font-semibold">{t('legal')}</p>
          <ul className="space-y-1">
            <FooterLink href="/privacy">{t('privacy')}</FooterLink>
            <FooterLink href="/terms">{t('terms')}</FooterLink>
            <FooterLink href="/privacy/delete-request">{t('deleteData')}</FooterLink>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line/70">
        <div className="container-page flex flex-col gap-1 py-5 text-xs text-muted sm:flex-row sm:justify-between">
          <p>{t('copyright', { year })}</p>
          <p className="tabular">
            {t('version', {
              model: process.env.NEXT_PUBLIC_MODEL_VERSION ?? '2.1',
              app: process.env.NEXT_PUBLIC_APP_VERSION ?? '4.0.0',
            })}
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: React.ComponentProps<typeof Link>['href']; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="inline-flex min-h-8 items-center rounded-sm text-muted underline-offset-4 hover:text-fg hover:underline">
        {children}
      </Link>
    </li>
  );
}
