import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default function AdminLoginPage() {
  return (
    <div className="container-page grid min-h-dvh place-items-center py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-1 text-center">
          <p className="eyebrow">MorrowAge</p>
          <h1 className="text-3xl font-extrabold">Panel de administración</h1>
          <p className="text-muted">Acceso restringido a miembros de admin_users.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
