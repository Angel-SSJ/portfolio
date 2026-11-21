import { z } from 'astro/zod';

const httpUrl = z.url().refine((value) => /^https?:\/\//i.test(value), {
  message: 'Site URL must use HTTP or HTTPS',
});

export const SiteConfigSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  lang: z.string().trim().min(1),
  siteUrl: httpUrl.optional(),
});

export type SiteConfig = z.infer<typeof SiteConfigSchema>;

export const siteConfig: SiteConfig = SiteConfigSchema.parse({
  name: 'Angel Ramirez',
  description: 'Portafolio personal',
  lang: 'es',
});
