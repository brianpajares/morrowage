import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { z } from 'zod';
import { getEnv } from '@/lib/env';
import { POLICIES } from '@/lib/security/ratelimit';
import { ApiError, assertSameOrigin, clientContext, enforceRateLimit, handler, parseCookies, readJson } from '@/server/http';
import { emailSchema } from '@/lib/validation';
import { getStore } from '@/server/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginSchema = z.strictObject({ email: emailSchema, password: z.string().min(1).max(256) });

function supabaseForResponse(req: Request, res: NextResponse) {
  const { supabaseUrl, supabaseAnonKey } = getEnv();
  if (!supabaseUrl || !supabaseAnonKey) throw new ApiError(503, 'auth_not_configured');
  const all = Object.entries(parseCookies(req.headers.get('cookie'))).map(([name, value]) => ({ name, value }));
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => all,
      setAll: (list) => list.forEach(({ name, value, options }) => res.cookies.set(name, value, { ...options, httpOnly: true, sameSite: 'lax', secure: getEnv().appUrl.startsWith('https://') })),
    },
  });
}

/** POST — inicia sesión con email + contraseña (Supabase Auth). Solo miembros de admin_users conservan la sesión. */
export const POST = handler(async (req: Request) => {
  assertSameOrigin(req);
  const ctx = clientContext(req);
  await enforceRateLimit(POLICIES.adminLogin, ctx.ipKey);
  const parsed = loginSchema.safeParse(await readJson(req, 1024));
  if (!parsed.success) throw new ApiError(400, 'invalid_request');

  const res = NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
  const supa = supabaseForResponse(req, res);
  const { data, error } = await supa.auth.signInWithPassword(parsed.data);
  if (error || !data.user) throw new ApiError(401, 'invalid_credentials');

  if (!(await getStore().isAdmin(data.user.id))) {
    await supa.auth.signOut();
    throw new ApiError(403, 'forbidden');
  }
  return res;
});

/** DELETE — cierra sesión. */
export const DELETE = handler(async (req: Request) => {
  assertSameOrigin(req);
  const res = NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
  const supa = supabaseForResponse(req, res);
  await supa.auth.signOut();
  return res;
});
