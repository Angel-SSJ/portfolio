import { expect, test } from '@playwright/test';
import { collectPageErrors, expectNoAxeViolations } from './helpers.ts';

test.describe('static site foundation', () => {
  test('home renders with the expected heading and no page errors', async ({
    page,
  }) => {
    const errors = collectPageErrors(page);
    const response = await page.goto('/');

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: 'Angel Ramirez', level: 1 }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('404 page renders the shared layout and home link', async ({ page }) => {
    const errors = collectPageErrors(page);
    const response = await page.goto('/404.html');

    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: 'Página no encontrada', level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Volver al inicio' }),
    ).toHaveAttribute('href', '/');
    expect(errors).toEqual([]);
  });

  test('arbitrary missing route is handled as not found', async ({ page }) => {
    const response = await page.goto('/ruta-que-no-existe');

    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole('heading', { name: 'Página no encontrada', level: 1 }),
    ).toBeVisible();
  });

  test('home navigation is reachable with the keyboard', async ({ page }) => {
    await page.goto('/');

    const focusedTags = new Set<string>();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await page.keyboard.press('Tab');
      const tag = await page.evaluate(() => document.activeElement?.tagName);
      if (tag) {
        focusedTags.add(tag);
      }
    }
    expect(focusedTags.has('SELECT')).toBe(true);
    expect(focusedTags.has('BUTTON')).toBe(true);

    const inicio = page.getByRole('link', { name: 'Inicio' });
    await inicio.click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole('heading', { name: 'Angel Ramirez', level: 1 }),
    ).toBeVisible();
  });

  test('mobile layout has no obvious horizontal overflow', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'mobile-chromium',
      'mobile overflow project only',
    );

    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );

    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('home and 404 page pass automated accessibility checks', async ({
    page,
  }) => {
    await page.goto('/');
    await expectNoAxeViolations(page);

    await page.goto('/404.html');
    await expectNoAxeViolations(page);
  });
});
