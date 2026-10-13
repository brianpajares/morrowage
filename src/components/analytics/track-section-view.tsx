'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics/client';
import type { SECTION_IDS } from '@/lib/analytics/events';

type SectionId = (typeof SECTION_IDS)[number];

/** Emite `report_section_view` una vez por sección cuando entra al viewport (solo el id de la sección). */
export function TrackSectionViews({ ids }: { ids: readonly SectionId[] }) {
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const seen = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = e.target.id.replace(/^sec-/, '') as SectionId;
          if (e.isIntersecting && !seen.has(id)) {
            seen.add(id);
            track('report_section_view', { section_id: id });
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.35 },
    );
    for (const id of ids) {
      const el = document.getElementById(`sec-${id}`);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [ids]);
  return null;
}

/** Enlace a una fuente externa con evento `source_open` (solo el id de la fuente). */
export function SourceLink({ href, sourceId, children, className }: { href: string; sourceId: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() => {
        if (/^S\d{2}$/.test(sourceId)) track('source_open', { source_id: sourceId });
      }}
    >
      {children}
    </a>
  );
}
