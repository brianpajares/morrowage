import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Excluye API, admin (sin prefijo de locale), internos de Next y archivos con extensión.
  matcher: ['/((?!api|admin|_next|_vercel|monitoring|.*\\..*).*)'],
};
