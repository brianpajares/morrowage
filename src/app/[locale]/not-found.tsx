import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <div className="container-page grid min-h-[60dvh] place-items-center py-24">
      <div className="reading space-y-5 text-center">
        <p className="eyebrow">404</p>
        <h1 className="text-4xl font-extrabold">{t('title')}</h1>
        <p className="text-lg text-muted">{t('body')}</p>
        <Button asChild>
          <Link href="/">{t('home')}</Link>
        </Button>
      </div>
    </div>
  );
}
