'use client';

import { useEffect, useRef } from 'react';
import { track, type TrackProps } from '@/lib/analytics/client';
import type { EventName } from '@/lib/analytics/events';

/** Dispara un evento de la allowlist una sola vez cuando el componente se monta. */
export function TrackOnView({ event, props }: { event: EventName; props?: TrackProps }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    // Tras la primera interacción/idle: la analítica nunca compite con el render crítico.
    const run = () => track(event, props);
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(run);
    } else {
      setTimeout(run, 300);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
