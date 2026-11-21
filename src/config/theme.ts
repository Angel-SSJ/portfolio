export const THEME_OPTIONS = {
  storageKey: 'colorTheme',
  defaultTheme: 'system',
  className: 'dark',
} as const;

export const THEME_VALUES = ['light', 'dark', 'system'] as const;

export type ThemeValue = (typeof THEME_VALUES)[number];
