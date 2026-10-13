import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function noCriticalA11y(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze();
  const critical = results.violations.filter((v) => v.impact === 'critical');
  expect(critical, JSON.stringify(critical.map((v) => ({ id: v.id, nodes: v.nodes.length })))).toEqual([]);
}

async function fillStep(page: Page, _label: RegExp, value: string) {
  const before = page.url();
  await page.locator('input[inputmode]:not([type=radio])').first().fill(value);
  await page.getByRole('button', { name: /^continue$/i }).click();
  await expect(page).not.toHaveURL(before);
}

/** Recorre el assessment (EN) con los datos del vector TC01 (MorrowAge 47.7). */
async function completeAssessment(page: Page) {
  await page.goto('/en/calculate');
  await page.getByRole('button', { name: /i understand, continue/i }).click();
  await expect(page).toHaveURL(/\/en\/calculate\/age$/);
  await fillStep(page, /^age/i, '52');
  await fillStep(page, /hours of sleep/i, '7');
  await page.getByText('Good', { exact: true }).click();
  await page.getByRole('button', { name: /continue/i }).click();
  await fillStep(page, /cigarettes per day/i, '0');
  await page.getByText(/i can’t take the test/i).click();
  await page.getByLabel(/measured reaction time/i).fill('540');
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByLabel(/^waist/i).fill('93.6');
  await page.getByLabel(/^height/i).fill('180');
  await expect(page.getByText(/waist-to-height ratio: 0\.520/i)).toBeVisible();
  await page.getByRole('button', { name: /continue/i }).click();
  await page.getByText('UK units (8 g)').click();
  await fillStep(page, /uk units per week/i, '7');
  await fillStep(page, /resting heart rate/i, '68');
}

test.describe('Landing y claims (AT-01, AT-20)', () => {
  for (const [locale, h1, denies] of [
    ['es', /edad equivalente de riesgo/i, /no es edad biológica/i],
    ['en', /risk-equivalent age/i, /not biological age/i],
    ['pt', /idade equivalente de risco/i, /não é idade biológica/i],
  ] as const) {
    test(`/${locale}: promete edad equivalente de riesgo y niega edad biológica`, async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.locator('html')).toHaveAttribute('lang', locale);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(h1);
      await expect(page.locator('main')).toContainText(denies);
      await noCriticalA11y(page);
    });
  }

  test('páginas públicas existen en los tres idiomas (paridad de rutas)', async ({ request }) => {
    for (const locale of ['es', 'en', 'pt']) {
      for (const path of ['', '/how-it-works', '/methodology', '/faq', '/privacy', '/terms', '/guides', '/risk-equivalent-age-calculator', '/country/us/risk-equivalent-age']) {
        const res = await request.get(`/${locale}${path}`);
        expect(res.status(), `${locale}${path}`).toBe(200);
      }
    }
  });
});

test.describe('Scope y validación (AT-02, AT-03)', () => {
  test('no se puede saltar el alcance: los pasos redirigen a /calculate', async ({ page }) => {
    await page.goto('/en/calculate/sleep');
    await expect(page).toHaveURL(/\/en\/calculate$/);
  });

  test('edad fuera de 40–69 muestra el estado fuera de alcance y no avanza', async ({ page }) => {
    await page.goto('/en/calculate');
    await page.getByRole('button', { name: /i understand, continue/i }).click();
    await page.getByLabel(/^age/i).fill('39');
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/only supports ages 40 to 69/i).first()).toBeVisible();
    await expect(page.getByText(/outside the scope of morrowage v1/i)).toBeVisible();
    await expect(page).toHaveURL(/\/calculate\/age$/);
  });

  test('errores inline accesibles (campo vacío, rango)', async ({ page }) => {
    await page.goto('/en/calculate');
    await page.getByRole('button', { name: /i understand, continue/i }).click();
    await expect(page).toHaveURL(/\/calculate\/age$/);
    await page.getByRole('button', { name: /^continue$/i }).click();
    await expect(page.getByText(/complete this field to continue/i).first()).toBeVisible();
  });
});

test('Funnel completo validation: preview → email → informe → PDF (AT-07, AT-09, AT-11, AT-12)', async ({ page, request }) => {
  await completeAssessment(page);
  await expect(page).toHaveURL(/\/en\/preview\/[0-9a-f-]{36}$/, { timeout: 20_000 });

  // Preview: cifra segura, sin contenido de pago
  await expect(page.getByTestId('morrow-age')).toContainText('47.7');
  await expect(page.locator('main')).toContainText(/not your biological age/i);
  await expect(page.locator('main')).not.toContainText(/measurement sensitivity:/i);
  await noCriticalA11y(page);

  await page.getByRole('link', { name: /see my full report/i }).click();
  await expect(page).toHaveURL(/\/en\/report-request$/);

  // Sin consentimiento de servicio no se envía
  await page.getByLabel(/your email/i).fill('persona.e2e@morrowage.test');
  await page.getByRole('button', { name: /send me the free report/i }).click();
  await expect(page.getByText(/we need your service consent/i).first()).toBeVisible();

  await page.getByLabel(/i agree that morrowage may use my email/i).check();
  await page.getByRole('button', { name: /send me the free report/i }).click();
  await expect(page).toHaveURL(/\/en\/success$/, { timeout: 20_000 });
  await noCriticalA11y(page);

  await page.getByRole('link', { name: /open my report/i }).click();
  await expect(page).toHaveURL(/\/en\/report\/[A-Za-z0-9_-]{43}$/);
  await expect(page.getByTestId('report-morrow-age')).toHaveText('47.7');
  await expect(page.getByRole('heading', { name: /measurement sensitivity/i })).toBeVisible();
  await expect(page.locator('main')).toContainText(/this is not a confidence interval/i);
  await expect(page.locator('main')).toContainText(/MA-\d{2}-[0-9A-F]{6}/);
  await noCriticalA11y(page);

  // PDF descargable
  const token = new URL(page.url()).pathname.split('/').pop()!;
  const pdf = await request.get(`/api/report/${token}/pdf?locale=en`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
});

test('API: token inexistente 404, cabeceras de seguridad (AT-31)', async ({ request }) => {
  expect((await request.get(`/api/report/${'x'.repeat(43)}`)).status()).toBe(404);
  const res = await request.get('/en');
  const h = res.headers();
  expect(h['strict-transport-security']).toContain('max-age=');
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBeTruthy();
  expect(h['x-frame-options']).toBe('DENY');
});

test('Admin: sin sesión redirige a login y la API devuelve 401 (AT-16)', async ({ page, request }) => {
  expect((await request.get('/api/admin/leads')).status()).toBe(401);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('Stripe apagado por defecto: /checkout no es alcanzable (404)', async ({ request }) => {
  expect((await request.get('/en/checkout')).status()).toBe(404);
  expect((await request.post('/api/stripe/checkout', { data: {}, headers: { 'content-type': 'application/json' } })).status()).toBe(404);
});
