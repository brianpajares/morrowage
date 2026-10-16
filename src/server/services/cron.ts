/**
 * Mantenimiento programado (Vercel Cron → /api/cron/cleanup):
 *  1) purga por retención (REPORT_RETENTION_DAYS) de cálculos/leads/informes vencidos;
 *  2) reintento controlado de entregas que no se completaron (email: "retry controlado", NFR-08).
 */
import { log } from '@/lib/log';
import { getStore } from '@/server/store';
import { deliverReport } from './delivery';
import { fulfillPaidOrder } from './fulfillment';
import { rotateReportToken } from './report';

export interface CleanupResult {
  purgedCalculations: number;
  scrubbed: number;
  retried: number;
  retryFailed: number;
  /** Pedidos PayPal pagados cuya entrega se reintentó / siguen sin entregarse. */
  ordersRetried: number;
  ordersStillPending: number;
}

export async function cleanupJob(now: Date = new Date()): Promise<CleanupResult> {
  const store = getStore();
  const purge = await store.purgeExpired(now);

  const leads = await store.listLeadsForRetry({
    olderThan: new Date(now.getTime() - 10 * 60_000),
    newerThan: new Date(now.getTime() - 24 * 3_600_000),
    limit: 20,
  });

  let retried = 0;
  let retryFailed = 0;
  for (const lead of leads) {
    const report = await store.getReportByLead(lead.id);
    if (!report) continue;
    try {
      const issued = await rotateReportToken(store, report, now);
      // 'requested' = la entrega nunca corrió (incluye el aviso al dueño); 'failed' = solo reenviar al usuario.
      const out = await deliverReport(store, { leadId: lead.id, token: issued.token, mode: lead.status === 'requested' ? 'initial' : 'resend', now });
      if (out.userEmailSent) retried++;
      else retryFailed++;
    } catch {
      retryFailed++;
    }
  }
  // Entregas de pedidos pagados que no terminaron (correo caído, proceso interrumpido): reintento
  // seguro — `fulfillPaidOrder` reclama la entrega en exclusiva y no duplica correos.
  let ordersRetried = 0;
  let ordersStillPending = 0;
  const orders = await store.listOrdersForFulfillmentRetry({ olderThan: new Date(now.getTime() - 10 * 60_000), limit: 20 });
  for (const order of orders) {
    try {
      const out = await fulfillPaidOrder(store, order.id, { now });
      if (!out.claimed) continue;
      if (out.delivered) ordersRetried++;
      else ordersStillPending++;
    } catch {
      ordersStillPending++;
    }
  }

  log.info('cleanup_done', { purged: purge.calculations, scrubbed: purge.scrubbed, retried, retryFailed, ordersRetried, ordersStillPending });
  return { purgedCalculations: purge.calculations, scrubbed: purge.scrubbed, retried, retryFailed, ordersRetried, ordersStillPending };
}
