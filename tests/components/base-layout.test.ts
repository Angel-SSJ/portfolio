import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import BaseLayout from '@/layouts/BaseLayout.astro';

describe('BaseLayout', () => {
  let container: AstroContainer;

  beforeAll(async () => {
    container = await AstroContainer.create();
  });

  it('renders the default title, language and slot content', async () => {
    const html = await container.renderToString(BaseLayout, {
      slots: { default: '<p>Contenido de prueba</p>' },
    });

    expect(html).toContain('<title>Angel Ramirez</title>');
    expect(html).toContain('lang="es"');
    expect(html).toContain('Contenido de prueba');
  });

  it('renders an overridden title and description', async () => {
    const html = await container.renderToString(BaseLayout, {
      props: { title: 'Título propio', description: 'Descripción propia' },
      slots: { default: '<p>Contenido</p>' },
    });

    expect(html).toContain('<title>Título propio</title>');
    expect(html).toContain('content="Descripción propia"');
  });

  it('includes exactly one Starwind theme initializer in the head', async () => {
    const html = await container.renderToString(BaseLayout, {
      slots: { default: '<p>Contenido</p>' },
    });

    expect(html.split('data-starwind-theme-init').length - 1).toBe(1);
  });
});
