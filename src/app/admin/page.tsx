import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AlertCircle, CheckCircle2, CircleDashed, Clock } from 'lucide-react';
import { Badge, Card } from '@/components/ui/card';
import { ApiError } from '@/server/http';
import { funnel, listDeletionRequests, listLeads, requireAdmin, sales } from '@/server/services/admin';
import { EraseButton, LogoutButton, ResendButton } from './actions';

export const dynamic = 'force-dynamic';

const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(1)} %`);
const when = (iso: string | null) => (iso ? new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(iso)) + ' UTC' : '—');

const BUCKETS: Record<string, string> = {
  lt_5s: '< 5 s',
  '5_15s': '5–15 s',
  '15_30s': '15–30 s',
  '30_60s': '30–60 s',
  '60_90s': '60–90 s',
  '90_180s': '90–180 s',
  gte_180s: '≥ 180 s',
};

const THRESHOLD_LABEL: Record<string, string> = {
  calculator_completion_rate: 'Completitud de la calculadora',
  email_gate_conversion: 'Conversión del gate de email',
  full_report_open_rate: 'Apertura del informe',
  purchase_intent_or_WTP_USD19: 'Intención de compra / WTP (US$19)',
};

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { icon: typeof CheckCircle2; text: string; tone: 'primary' | 'neutral' | 'locked' }> = {
    delivered: { icon: CheckCircle2, text: 'Entregado', tone: 'primary' },
    paid: { icon: CheckCircle2, text: 'Pagado', tone: 'primary' },
    requested: { icon: Clock, text: 'Solicitado', tone: 'neutral' },
    generating: { icon: Clock, text: 'Generando', tone: 'neutral' },
    failed: { icon: AlertCircle, text: 'Falló', tone: 'locked' },
    deleted: { icon: CircleDashed, text: 'Borrado', tone: 'locked' },
  };
  const s = map[status] ?? { icon: CircleDashed, text: status, tone: 'neutral' as const };
  const Icon = s.icon;
  return (
    <Badge tone={s.tone}>
      <Icon className="size-3.5" aria-hidden="true" />
      {s.text}
    </Badge>
  );
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days: daysRaw } = await searchParams;
  const days = [7, 14, 30].includes(Number(daysRaw)) ? Number(daysRaw) : 14;

  const h = await headers();
  let admin;
  try {
    admin = await requireAdmin(new Request('http://admin.local/', { headers: h }));
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return (
        <div className="container-page grid min-h-dvh place-items-center">
          <Card className="max-w-md space-y-3 text-center" role="alert">
            <h1 className="text-2xl font-extrabold">Sin permisos</h1>
            <p className="text-muted">Tu cuenta no pertenece a admin_users.</p>
            <LogoutButton />
          </Card>
        </div>
      );
    }
    redirect('/admin/login');
  }

  const [f, leads, deletions, s] = await Promise.all([funnel(days), listLeads({ limit: 50 }), listDeletionRequests(), sales()]);
  const c = f.conversions;

  return (
    <div className="container-page space-y-8 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">MorrowAge · Admin</p>
          <h1 className="text-3xl font-extrabold">Operación del funnel</h1>
          <p className="text-sm text-muted">
            Sesión: {admin.email ?? admin.userId} · Solo agregados y leads: sin datos de salud, resultados crudos ni enlaces de informe.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <nav aria-label="Ventana de tiempo" className="inline-flex rounded-md border border-line bg-surface p-1">
            {[7, 14, 30].map((d) => (
              <a key={d} href={`/admin?days=${d}`} aria-current={d === days ? 'page' : undefined} className={`flex min-h-9 min-w-14 items-center justify-center rounded-sm px-3 text-sm font-bold ${d === days ? 'bg-primary text-primary-fg' : 'text-muted hover:text-fg'}`}>
                {d} d
              </a>
            ))}
          </nav>
          <LogoutButton />
        </div>
      </header>

      <section aria-label="Resumen" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Leads', String(f.leads.total), `${f.leads.byStatus.delivered ?? 0} entregados · ${f.leads.byStatus.failed ?? 0} fallidos`],
          ['Preview → email', pct(c.previewToGate), `Mínimo operativo 25 %`],
          ['Tiempo mediano a preview', f.medianTimeBucket ? BUCKETS[f.medianTimeBucket] ?? f.medianTimeBucket : '—', 'Objetivo ≤ 75 s'],
          ['Coste por informe', f.cost.avgUsdPerReport === null ? '—' : `US$${f.cost.avgUsdPerReport.toFixed(4)}`, `Objetivo ≤ US$0.05 · ${f.cost.reports} informes`],
        ].map(([label, value, hint]) => (
          <Card key={label} className="space-y-1 p-5">
            <p className="text-sm font-semibold text-muted">{label}</p>
            <p className="text-3xl font-extrabold tabular">{value}</p>
            <p className="text-xs text-muted">{hint}</p>
          </Card>
        ))}
      </section>

      <section aria-label="Ventas" className="grid gap-4 sm:grid-cols-3">
        {[
          ['Ventas pagadas', String(s.paidOrders), s.sandboxOrders > 0 ? `${s.sandboxOrders} en Sandbox (prueba)` : 'Cobros reales'],
          ['Importe bruto', `US$${(s.paidAmountMinor / 100).toFixed(2)}`, 'Antes de comisiones de PayPal'],
          ['Entregas pendientes', String(s.pendingFulfillment), s.pendingFulfillment > 0 ? 'El cron diario las reintenta' : 'Todo entregado'],
        ].map(([label, value, hint]) => (
          <Card key={label} className="space-y-1 p-5">
            <p className="text-sm font-semibold text-muted">{label}</p>
            <p className="text-3xl font-extrabold tabular">{value}</p>
            <p className="text-xs text-muted">{hint}</p>
          </Card>
        ))}
      </section>

      <section aria-labelledby="funnel-h" className="space-y-3">
        <h2 id="funnel-h" className="text-xl font-bold">Funnel ({days} días)</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[30rem] text-sm">
            <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-muted">
              <tr><th scope="col" className="px-4 py-2">Paso</th><th scope="col" className="px-4 py-2 text-right">Eventos</th><th scope="col" className="px-4 py-2 text-right">vs. paso anterior</th></tr>
            </thead>
            <tbody>
              {f.steps.map((s, i) => (
                <tr key={s.key} className="border-t border-line">
                  <th scope="row" className="px-4 py-2 text-left font-semibold">{s.label}</th>
                  <td className="px-4 py-2 text-right font-bold tabular">{s.count}</td>
                  <td className="px-4 py-2 text-right text-muted tabular">{i === 0 ? '—' : pct(f.steps[i - 1]!.count > 0 ? s.count / f.steps[i - 1]!.count : null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">
          Calidad: error de cálculo {pct(c.calculationErrorRate)} (objetivo &lt; 0,5 %) · fallo de entrega {pct(c.deliveryFailRate)} (objetivo &lt; 2 %) · apertura del informe {pct(c.reportOpenRate)} · fuera de rango de referencia {pct(f.outOfRangeRate)} (solo agregado).
        </p>
      </section>

      <section aria-labelledby="thr-h" className="space-y-3">
        <h2 id="thr-h" className="text-xl font-bold">Umbrales de tracción para considerar cobro</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-muted">
              <tr><th scope="col" className="px-4 py-2">Métrica</th><th scope="col" className="px-4 py-2 text-right">Valor</th><th scope="col" className="px-4 py-2 text-right">Objetivo</th><th scope="col" className="px-4 py-2 text-right">Muestra</th><th scope="col" className="px-4 py-2">Estado</th></tr>
            </thead>
            <tbody>
              {f.thresholds.map((t) => (
                <tr key={t.metric} className="border-t border-line">
                  <th scope="row" className="px-4 py-2 text-left font-semibold">{THRESHOLD_LABEL[t.metric] ?? t.metric}</th>
                  <td className="px-4 py-2 text-right tabular">{pct(t.value)}</td>
                  <td className="px-4 py-2 text-right tabular">≥ {pct(t.target)}</td>
                  <td className="px-4 py-2 text-right tabular">{t.sample} / {t.minSample}</td>
                  <td className="px-4 py-2">
                    {t.status === 'met' ? <Badge tone="primary"><CheckCircle2 className="size-3.5" aria-hidden="true" />Cumple</Badge> : t.status === 'not_met' ? <Badge tone="locked"><AlertCircle className="size-3.5" aria-hidden="true" />No cumple</Badge> : t.status === 'insufficient_sample' ? <Badge><Clock className="size-3.5" aria-hidden="true" />Muestra insuficiente</Badge> : <Badge><CircleDashed className="size-3.5" aria-hidden="true" />No medido en validation</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">Regla: activar cobro con ≥ 3 de 4 umbrales en dos cohortes semanales consecutivas y sin bloqueos de seguridad/QA/legal.</p>
      </section>

      <section aria-labelledby="steps-h" className="space-y-3">
        <h2 id="steps-h" className="text-xl font-bold">Abandono por paso del assessment</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[26rem] text-sm">
            <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-muted">
              <tr><th scope="col" className="px-4 py-2">Paso</th><th scope="col" className="px-4 py-2 text-right">Vistas</th><th scope="col" className="px-4 py-2 text-right">Completados</th><th scope="col" className="px-4 py-2 text-right">Abandono</th></tr>
            </thead>
            <tbody>
              {f.stepFunnel.map((s) => (
                <tr key={s.stepId} className="border-t border-line">
                  <th scope="row" className="px-4 py-2 text-left font-mono font-semibold">{s.stepId}</th>
                  <td className="px-4 py-2 text-right tabular">{s.views}</td>
                  <td className="px-4 py-2 text-right tabular">{s.completes}</td>
                  <td className="px-4 py-2 text-right tabular">{s.views > 0 ? pct(1 - s.completes / s.views) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="leads-h" className="space-y-3">
        <h2 id="leads-h" className="text-xl font-bold">Leads recientes</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                {['Email', 'Idioma', 'Estado', 'Marketing', 'Lista de espera', 'Creado', 'Último envío', 'Verificación', ''].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-muted">Aún no hay leads.</td></tr>
              ) : (
                leads.items.map((l) => (
                  <tr key={l.id} className="border-t border-line">
                    <th scope="row" className="px-4 py-2 text-left font-semibold">{l.email}</th>
                    <td className="px-4 py-2 uppercase">{l.locale}</td>
                    <td className="px-4 py-2"><StatusChip status={l.status} /></td>
                    <td className="px-4 py-2">{l.marketingOptIn ? 'Sí' : 'No'}</td>
                    <td className="px-4 py-2">{l.subscriptionWaitlistOptIn ? 'Sí' : 'No'}</td>
                    <td className="px-4 py-2 tabular text-muted">{when(l.createdAt)}</td>
                    <td className="px-4 py-2 tabular text-muted">{when(l.lastSentAt)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{l.verificationId ?? '—'}</td>
                    <td className="px-4 py-2 text-right">{l.reportId ? <ResendButton reportId={l.reportId} /> : null}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="del-h" className="space-y-3">
        <h2 id="del-h" className="text-xl font-bold">Solicitudes de borrado</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-surface-alt text-left text-xs uppercase tracking-wide text-muted">
              <tr>{['Email', 'Verificación', 'Estado', 'Recibida', 'Resolución', ''].map((h) => <th key={h} scope="col" className="px-4 py-2">{h}</th>)}</tr>
            </thead>
            <tbody>
              {deletions.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-muted">Sin solicitudes.</td></tr>
              ) : (
                deletions.map((d) => (
                  <tr key={d.id} className="border-t border-line">
                    <th scope="row" className="px-4 py-2 text-left font-semibold">{d.email}</th>
                    <td className="px-4 py-2 font-mono text-xs">{d.verification_id ?? '—'}</td>
                    <td className="px-4 py-2"><Badge>{d.status === 'received' ? 'Recibida' : d.status === 'completed' ? 'Completada' : d.status === 'rejected_legal_hold' ? 'Retención legal' : 'En verificación'}</Badge></td>
                    <td className="px-4 py-2 tabular text-muted">{when(d.created_at)}</td>
                    <td className="px-4 py-2 text-xs text-muted">{d.resolution_note ?? '—'}</td>
                    <td className="px-4 py-2 text-right">{d.status === 'received' || d.status === 'verifying' ? <EraseButton requestId={d.id} /> : null}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
