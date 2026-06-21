/** The five selectable theme enum values. Mirrors tokens.css [data-theme=...]. */
export type ThemeName = 'ocean' | 'mint' | 'violet' | 'coral' | 'sunset'

export const THEME_NAMES: ThemeName[] = ['ocean', 'mint', 'violet', 'coral', 'sunset']

export const DEFAULT_THEME: ThemeName = 'ocean'

/**
 * The swatch fill color for each theme (matches the design). The display label
 * is localized via the i18n key `theme.<name>` (see parts/settings.ts).
 */
export const THEME_META: Record<ThemeName, { swatch: string }> = {
  ocean: { swatch: '#1366CE' },
  mint: { swatch: '#0FB5A0' },
  violet: { swatch: '#6B5BD0' },
  coral: { swatch: '#FF7A6B' },
  sunset: { swatch: '#FF9D52' },
}

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && (THEME_NAMES as string[]).includes(value)
}

/** Coerces an arbitrary stored theme string to a known theme (defaults to ocean). */
export function normalizeTheme(value: unknown): ThemeName {
  return isThemeName(value) ? value : DEFAULT_THEME
}

/**
 * Applies the theme + dark mode to the document root by setting the
 * `data-theme` and `data-dark` attributes that tokens.css keys its CSS-variable
 * overrides off of. This recolors the whole app instantly.
 */
export function applyTheme(theme: string | null | undefined, darkMode: boolean): void {
  const root = document.documentElement
  root.dataset.theme = normalizeTheme(theme)
  root.dataset.dark = darkMode ? 'true' : 'false'
}
