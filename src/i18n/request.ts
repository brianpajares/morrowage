import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { getMessages } from '@/messages';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: getMessages(locale),
    timeZone: 'UTC',
    onError(error) {
      // En desarrollo/CI un mensaje faltante debe ser visible; en producción no rompe la página.
      if (process.env.NODE_ENV !== 'production') throw error;
    },
    getMessageFallback({ namespace, key }) {
      return `${namespace ?? ''}.${key}`;
    },
  };
});
