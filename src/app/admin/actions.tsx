'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

async function call(path: string, method = 'POST'): Promise<boolean> {
  try {
    const res = await fetch(path, { method, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: method === 'POST' ? '{}' : undefined });
    return res.ok;
  } catch {
    return false;
  }
}

export function ResendButton({ reportId, disabled }: { reportId: string; disabled?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={disabled || state === 'ok'}
      loading={state === 'busy'}
      loadingText="Reenviando…"
      onClick={async () => {
        setState('busy');
        const ok = await call(`/api/admin/reports/${reportId}/resend`);
        setState(ok ? 'ok' : 'err');
        if (ok) setTimeout(() => router.refresh(), 2500);
      }}
    >
      {state === 'ok' ? 'Reenvío en curso' : state === 'err' ? 'Error · reintentar' : 'Reenviar'}
    </Button>
  );
}

export function EraseButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'confirm' | 'busy' | 'err'>('idle');
  if (state === 'confirm' || state === 'busy' || state === 'err')
    return (
      <span className="inline-flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          loading={state === 'busy'}
          loadingText="Borrando…"
          onClick={async () => {
            setState('busy');
            const ok = await call(`/api/admin/deletion/${requestId}`);
            if (ok) router.refresh();
            else setState('err');
          }}
        >
          {state === 'err' ? 'Error · reintentar' : 'Confirmar borrado'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setState('idle')}>
          Cancelar
        </Button>
      </span>
    );
  return (
    <Button type="button" size="sm" variant="secondary" onClick={() => setState('confirm')}>
      Procesar borrado
    </Button>
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      loading={busy}
      loadingText="Saliendo…"
      onClick={async () => {
        setBusy(true);
        await call('/api/admin/session', 'DELETE');
        router.replace('/admin/login');
        router.refresh();
      }}
    >
      Cerrar sesión
    </Button>
  );
}
