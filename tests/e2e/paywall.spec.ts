/**
 * Modo de pago (MONETIZATION_MODE=paypal) contra `next start` en modo test (puerto 3201):
 * vista previa → email → «¡Felicidades! Revisa tu correo» (sin informe ni descarga) → desbloqueo.
 * PayPal NO se llama de verdad: las rutas /api/paypal/* se simulan en el navegador y el SDK se sustituye.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function noCriticalA11y(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
  expect(critical, JSON.stringify(critical.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target.join(' ') + ' :: ' + (n.any[0]?.message ?? '')) })))).toEqual([]);
}

/** Pulsa «Continue» y espera a que el paso siguiente esté realmente pintado (cambia el h1). */
async function next(page: Page) {
  const h1 = page.getByRole('heading', { level: 1 });
  const before = await h1.first().innerText();
  await page.getByRole('button', { name: /^continue$/i }).click();
  await expect(h1.first()).not.toHaveText(before);
}

async function fillStep(page: Page, value: string) {
  await page.locator('input[inputmode]:not([type=radio])').first().fill(value);
  await next(page);
}

async function reachPreview(page: Page) {
  await page.goto('/en/calculate');
  await page.getByRole('button', { name: /i understand, continue/i }).click();
  await fillStep(page, '52');
  await fillStep(page, '7');
  await page.getByText('Good', { exact: true }).click();
  await next(page);
  await fillStep(page, '0');
  await page.getByText(/i can’t take the test/i).click();
  await page.getByLabel(/measured reaction time/i).fill('540');
  await next(page);
  await page.getByLabel(/^waist/i).fill('93.6');
  await page.getByLabel(/^height/i).fill('180');
  await next(page);
  await page.getByText('UK units (8 g)').click();
  await fillStep(page, '7');
  await page.locator('input[inputmode]:not([type=radio])').first().fill('68');
  await page.getByRole('button', { name: /^continue$/i }).click();
  await expect(page).toHaveURL(/\/en\/preview\//);
}

async function reachSuccess(page: Page, email = `ana.perez.${Math.random().toString(36).slice(2, 8)}@morrowage.test`) {
  await reachPreview(page);
  await page.getByTestId('paywall-cta').click();
  await page.getByLabel(/your email/i).fill(email);
  await page.getByLabel(/i agree that morrowage/i).check();
  await page.getByRole('button', { name: /send my preview/i }).click();
  await expect(page).toHaveURL(/\/en\/success$/);
}

test.describe('Modo de pago: embudo', () => {
  // Cada prueba simula un visitante distinto (límites de peticiones por IP y por email).
  test.beforeEach(async ({ page }) => {
    const n = () => Math.floor(Math.random() * 250) + 1;
    await page.context().setExtraHTTPHeaders({ 'x-forwarded-for': `10.${n()}.${n()}.${n()}` });
    // axe mide el contraste en mitad de la animación de entrada si no se reduce el movimiento (lección #19)
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('landing y FAQ muestran el precio real (nunca «gratis»)', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('section[aria-labelledby="deliver"]')).toContainText('US$19');
    await expect(page.locator('section[aria-labelledby="deliver"]')).not.toContainText(/free in this phase/i);
    await page.goto('/en/faq');
    await page.getByRole('button', { name: /how much does it cost/i }).click();
    await expect(page.locator('main')).toContainText(/one-time payment of US\$19/i);
  });

  test('la vista previa en pantalla: resultado gratis + bloque de valor con precio y CTA al correo', async ({ page }) => {
    await reachPreview(page);
    await expect(page.getByTestId('morrow-age')).toContainText('47.7');
    await expect(page.getByTestId('paywall')).toBeVisible();
    await expect(page.getByTestId('paywall-price')).toHaveText('US$19');
    await expect(page.getByTestId('paywall')).toContainText(/13 pages/i);
    // lo bloqueado no está en la página: ni sensibilidad numérica ni contribuciones
    await expect(page.locator('main')).not.toContainText(/-0\.203|measurement sensitivity:\s*4/i);
    await noCriticalA11y(page);
  });

  test('«¡Felicidades! Revisa tu correo» SIN informe ni botón de descarga, con «Desbloquear ahora»', async ({ page }) => {
    await reachSuccess(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/congratulations/i);
    await expect(page.getByTestId('success-paywall')).toContainText('a***@morrowage.test');
    await expect(page.getByTestId('unlock-now')).toContainText(/unlock now · US\$19/i);
    await expect(page.getByRole('link', { name: /download|open my report/i })).toHaveCount(0);
    await expect(page.getByText(/sensitivity|associations/i)).toHaveCount(0);
    await noCriticalA11y(page);
  });

  test('el enlace de desbloqueo abre la página de pago; el informe completo sigue bloqueado', async ({ page }) => {
    await reachSuccess(page);
    const href = (await page.getByTestId('unlock-now').getAttribute('href'))!;
    expect(href).toMatch(/^\/en\/unlock\/[A-Za-z0-9_-]{43}$/);
    const token = href.split('/').pop()!;

    // el informe y su API están bloqueados hasta pagar
    const api = await page.request.get(`/api/report/${token}`);
    expect(api.status()).toBe(402);
    await page.goto(`/en/report/${token}`);
    await expect(page).toHaveURL(new RegExp(`/en/unlock/${token}$`));

    await expect(page.getByTestId('unlock-price')).toHaveText('US$19');
    await expect(page.getByTestId('unlock-result-age')).toHaveText('47.7');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    // páginas personales: noindex y sin Referer
    const res = await page.request.get(href);
    expect(res.headers()['x-robots-tag']).toMatch(/noindex/);
    expect(res.headers()['referrer-policy']).toBe('no-referrer');
    await noCriticalA11y(page);
  });

  test('pago simulado: términos obligatorios y pantalla de «Pago confirmado» con el informe', async ({ page }) => {
    await reachSuccess(page);
    const href = (await page.getByTestId('unlock-now').getAttribute('href'))!;

    // SDK de PayPal sustituido por un botón que dispara createOrder/onApprove igual que el real
    await page.route('https://www.paypal.com/sdk/js*', (route) =>
      route.fulfill({
        contentType: 'text/javascript',
        body: `window.paypal = { Buttons: (cfg) => ({
          close: async () => {},
          render: async (el) => {
            const b = document.createElement('button'); b.textContent = 'Pagar con PayPal (simulado)'; b.id = 'fake-paypal';
            b.onclick = async () => {
              let rejected = false;
              await cfg.onClick({}, { resolve: async () => {}, reject: async () => { rejected = true; } });
              if (rejected) return; // igual que PayPal: reject() detiene el flujo
              try {
                const id = await cfg.createOrder();
                await cfg.onApprove({ orderID: id });
              } catch (e) {}
            };
            el.appendChild(b);
          } }) };`,
      }),
    );
    let created = 0;
    await page.route('**/api/paypal/create-order', (route) => {
      created++;
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ orderId: 'o1', paypalOrderId: 'PPORDER0001XYZ' }) });
    });
    await page.route('**/api/paypal/capture', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'paid', reportUrl: 'http://localhost:3201/en/report/NEWTOKENNEWTOKENNEWTOKENNEWTOKENNEWTOKEN12' }) }),
    );

    await page.goto(href);
    const fake = page.locator('#fake-paypal');
    await fake.click();
    // sin aceptar términos no se crea la orden
    await expect(page.getByText(/tick the box/i)).toBeVisible();
    expect(created).toBe(0);

    await page.getByLabel(/i accept the terms of service/i).check();
    await fake.click();
    await expect(page.getByTestId('unlock-result')).toContainText(/payment confirmed/i);
    await expect(page.getByTestId('unlock-result')).toContainText('a***@morrowage.test');
    await expect(page.getByTestId('open-report')).toHaveAttribute('href', '/en/report/NEWTOKENNEWTOKENNEWTOKENNEWTOKENNEWTOKEN12');
    expect(created).toBe(1);
  });

  test('sin horizontal overflow a 320 px en vista previa, éxito y desbloqueo', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await reachSuccess(page);
    const widths = async () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(await widths()).toBeLessThanOrEqual(0);
    const href = (await page.getByTestId('unlock-now').getAttribute('href'))!;
    await page.goto(href);
    await expect(page.getByTestId('unlock-price')).toBeVisible();
    expect(await widths()).toBeLessThanOrEqual(0);
  });

  test('token inválido: mensaje neutro (sin filtrar nada) y noindex', async ({ page }) => {
    await page.goto('/en/unlock/' + 'A'.repeat(43));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/couldn’t find this link|could not find this link|find this link/i);
    const res = await page.request.post('/api/paypal/create-order', { data: { token: 'A'.repeat(43), withdrawalWaiver: true } });
    expect(res.status()).toBe(404);
  });

  test('/api/health expone integraciones y pagos sin secretos', async ({ request }) => {
    const body = await (await request.get('/api/health')).json();
    expect(body.payments).toMatchObject({ enabled: true, mode: 'paypal', env: 'sandbox', live_blocked: false });
    expect(JSON.stringify(body)).not.toContain('dummy-secret');
  });
});
