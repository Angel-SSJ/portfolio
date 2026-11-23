import { expect, test, type Page } from '@playwright/test';
import {
  collectPageErrors,
  expectNoAxeViolations,
  installThemeProbe,
} from './helpers.ts';

type ThemeProbe = {
  completed: boolean;
  domReadyClass: string | null;
  snapshots: string[];
};

async function readProbe(page: Page): Promise<ThemeProbe> {
  await expect
    .poll(() =>
      page.evaluate(
        () => Reflect.get(window, '__themeProbe')?.completed === true,
      ),
    )
    .toBe(true);
  return (await page.evaluate(() =>
    Reflect.get(window, '__themeProbe'),
  )) as ThemeProbe;
}

async function expectDarkClass(page: Page, dark: boolean) {
  await expect
    .poll(async () => {
      const classes = (await page.locator('html').getAttribute('class')) ?? '';
      return classes.split(/\s+/).includes('dark');
    })
    .toBe(dark);
}

async function expectStoredTheme(page: Page, theme: string | null) {
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('colorTheme')))
    .toBe(theme);
}

test.describe('theme state', () => {
  test.describe('fresh system dark', () => {
    test.use({ colorScheme: 'dark' });

    test('initializer applies dark before the first frame', async ({
      page,
    }) => {
      await installThemeProbe(page);
      const errors = collectPageErrors(page);
      await page.goto('/');

      const probe = await readProbe(page);
      expect(probe.domReadyClass?.split(/\s+/)).toContain('dark');
      expect(
        probe.snapshots.some((value) => value.split(/\s+/).includes('dark')),
      ).toBe(true);
      await expect(page.getByLabel('Tema')).toHaveValue('system');
      await expectDarkClass(page, true);
      await expectStoredTheme(page, 'system');
      expect(errors).toEqual([]);
    });
  });

  test.describe('fresh system light', () => {
    test.use({ colorScheme: 'light' });

    test('initializer omits dark before the first frame', async ({ page }) => {
      await installThemeProbe(page);
      await page.goto('/');

      const probe = await readProbe(page);
      expect(probe.domReadyClass?.split(/\s+/)).not.toContain('dark');
      expect(
        probe.snapshots.every((value) => !value.split(/\s+/).includes('dark')),
      ).toBe(true);
      await expect(page.getByLabel('Tema')).toHaveValue('system');
      await expectDarkClass(page, false);
      await expectStoredTheme(page, 'system');
    });
  });

  test('explicit selection persists across reload', async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto('/');

    const select = page.getByLabel('Tema');
    await select.selectOption('light');
    await expectDarkClass(page, false);
    await expectStoredTheme(page, 'light');
    await page.evaluate(async () => {
      await document.getAnimations().reduce<Promise<void>>(
        (promise, animation) =>
          promise.then(async () => {
            await animation.finished.catch(() => undefined);
          }),
        Promise.resolve(),
      );
    });
    await expectNoAxeViolations(page);

    await select.selectOption('dark');
    await expectDarkClass(page, true);
    await expectStoredTheme(page, 'dark');
    await page.evaluate(async () => {
      await document.getAnimations().reduce<Promise<void>>(
        (promise, animation) =>
          promise.then(async () => {
            await animation.finished.catch(() => undefined);
          }),
        Promise.resolve(),
      );
    });
    await expectNoAxeViolations(page);

    await page.reload();
    await expect(page.getByLabel('Tema')).toHaveValue('dark');
    await expectDarkClass(page, true);
    expect(errors).toEqual([]);
  });

  test('returning to system follows the current OS preference', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    const select = page.getByLabel('Tema');
    await select.selectOption('dark');
    await expectDarkClass(page, true);

    await select.selectOption('system');
    await expectDarkClass(page, false);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expectDarkClass(page, true);
    await expect(page.getByLabel('Tema')).toHaveValue('system');
  });

  test('system mode follows OS changes while mounted', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expectDarkClass(page, false);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expectDarkClass(page, true);

    await page.emulateMedia({ colorScheme: 'light' });
    await expectDarkClass(page, false);
  });

  test('explicit choices ignore OS changes while mounted', async ({ page }) => {
    await page.goto('/');
    const select = page.getByLabel('Tema');

    await select.selectOption('light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expectDarkClass(page, false);

    await select.selectOption('dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expectDarkClass(page, true);
  });

  test.describe('invalid stored theme', () => {
    test.use({ colorScheme: 'light' });

    test('normalizes to system and selects the system value', async ({
      page,
    }) => {
      await page.addInitScript(() => {
        if (localStorage.getItem('colorTheme') === null) {
          localStorage.setItem('colorTheme', 'neon');
        }
      });

      await page.goto('/');

      await expect(page.getByLabel('Tema')).toHaveValue('system');
      await expectDarkClass(page, false);
      await expectStoredTheme(page, 'system');
    });
  });

  test('blocked storage still allows in-page selection', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Storage.prototype, 'getItem', {
        configurable: true,
        value() {
          throw new Error('blocked storage');
        },
      });
      Object.defineProperty(Storage.prototype, 'setItem', {
        configurable: true,
        value() {
          throw new Error('blocked storage');
        },
      });
    });

    const errors = collectPageErrors(page);
    await page.goto('/');

    await page.getByLabel('Tema').selectOption('dark');
    await expectDarkClass(page, true);
    await expect(page.getByLabel('Tema')).toHaveValue('dark');
    expect(errors).toEqual([]);
  });

  test('semantic CSS variables drive computed page and card styling', async ({
    page,
  }) => {
    await page.goto('/');

    await page.evaluate(() => {
      document.documentElement.style.setProperty(
        '--background',
        'rgb(1, 2, 3)',
      );
      document.documentElement.style.setProperty('--card', 'rgb(4, 5, 6)');
    });

    await expect
      .poll(() =>
        page
          .locator('body')
          .evaluate((element) => getComputedStyle(element).backgroundColor),
      )
      .toBe('rgb(1, 2, 3)');
    await expect
      .poll(() =>
        page
          .locator('[data-sw-card]')
          .evaluate((element) => getComputedStyle(element).backgroundColor),
      )
      .toBe('rgb(4, 5, 6)');
  });

  test('reduced-motion emulation overrides real transitions', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/');
    await page.addStyleTag({
      content: '@layer probe { .motion-probe { transition-duration: 1s; } }',
    });
    await page.evaluate(() => {
      const element = document.createElement('div');
      element.className = 'motion-probe';
      document.body.append(element);
    });

    const duration = async () => {
      const value = await page
        .locator('.motion-probe')
        .evaluate((element) => getComputedStyle(element).transitionDuration);
      return value.endsWith('ms')
        ? Number.parseFloat(value) / 1000
        : Number.parseFloat(value);
    };

    await expect.poll(duration).toBe(1);

    await page.emulateMedia({ reducedMotion: 'reduce' });

    await expect
      .poll(async () => {
        const seconds = await duration();
        return seconds <= 0.00002;
      })
      .toBe(true);
  });
});
