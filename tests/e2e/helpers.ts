import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export async function expectNoAxeViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  expect(violations).toEqual([]);
}

export function collectPageErrors(page: Page) {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));
  return errors;
}

export async function installThemeProbe(page: Page) {
  await page.addInitScript(() => {
    const snapshots: string[] = [];
    const probe: {
      completed: boolean;
      domReadyClass: string | null;
      snapshots: string[];
    } = { completed: false, domReadyClass: null, snapshots };
    Reflect.set(window, '__themeProbe', probe);

    const observer = new MutationObserver(() => {
      if (document.documentElement) {
        snapshots.push(document.documentElement.className);
      }
    });

    observer.observe(document, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
    });

    document.addEventListener('DOMContentLoaded', () => {
      snapshots.push(document.documentElement.className);
      probe.domReadyClass = document.documentElement.className;
      probe.completed = true;
      observer.disconnect();
    });
  });
}
