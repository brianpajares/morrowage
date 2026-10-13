'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        router.replace('/admin');
        router.refresh();
        return;
      }
      setError(res.status === 429 ? 'Demasiados intentos. Espera unos minutos.' : res.status === 403 ? 'Esta cuenta no es administradora.' : res.status === 503 ? 'La autenticación no está configurada.' : 'Credenciales no válidas.');
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.');
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit}>
      <Card className="space-y-5">
        <Field id="a-email" label="Email" required>
          {(p) => <Input {...p} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field id="a-pass" label="Contraseña" required>
          {(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        {error ? (
          <p role="alert" className="font-semibold text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" block loading={busy} loadingText="Entrando…">
          Entrar
        </Button>
      </Card>
    </form>
  );
}
