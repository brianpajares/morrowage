import type { Metadata, Viewport } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Admin · MorrowAge',
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

/** Panel operativo: solo agregados y leads. Jamás inputs de salud, resultados crudos ni enlaces de informe. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a href="#admin-main" className="sr-only-focusable fixed left-3 top-3 z-50 rounded-md bg-surface px-4 py-3 font-semibold shadow-float">
          Saltar al contenido
        </a>
        <main id="admin-main" tabIndex={-1} className="outline-none">
          {children}
        </main>
      </body>
    </html>
  );
}
