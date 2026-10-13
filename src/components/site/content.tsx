import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Contenedor de páginas de texto (metodología, FAQ, legal, guías): lectura cómoda, jerarquía clara. */
export function ContentPage({
  eyebrow,
  title,
  lede,
  meta,
  children,
  wide,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  meta?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="container-page py-12 sm:py-20">
      <header className={cn('space-y-4', wide ? 'max-w-4xl' : 'reading')}>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="text-4xl font-extrabold sm:text-5xl">{title}</h1>
        {lede ? <p className="text-lg text-muted sm:text-xl">{lede}</p> : null}
        {meta ? <p className="text-sm text-muted">{meta}</p> : null}
      </header>
      <div className={cn('mt-10', wide ? 'max-w-4xl' : 'reading')}>{children}</div>
    </div>
  );
}

export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('prose-ma', className)}>{children}</div>;
}

export interface TextSection {
  id?: string;
  title: string;
  body: readonly string[];
}

/** Secciones numeradas con título y párrafos; `vars` interpola {placeholders}. */
export function Sections({ sections, render }: { sections: readonly TextSection[]; render?: (text: string) => string }) {
  const r = render ?? ((s: string) => s);
  return (
    <div className="space-y-10">
      {sections.map((s, i) => (
        <section key={s.title} id={s.id} aria-labelledby={`s-${i}`} className="scroll-mt-24">
          <h2 id={`s-${i}`} className="text-2xl font-bold">
            <span aria-hidden="true" className="mr-2 text-primary tabular">
              {String(i + 1).padStart(2, '0')}
            </span>
            {s.title}
          </h2>
          <div className="prose-ma mt-3 space-y-3">
            {s.body.map((p) => (
              <p key={p}>{r(p)}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
