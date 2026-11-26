export type ThemeMode = 'light' | 'dark';
export type ThemeToggleIcon = 'moon' | 'sun';

export const THEME_STORAGE_KEY = 'pixora_theme_mode';

export function resolveThemePreference(storedValue: string | null | undefined): ThemeMode {
  return storedValue === 'dark' ? 'dark' : 'light';
}

export function toggleThemeMode(current: ThemeMode): ThemeMode {
  return current === 'dark' ? 'light' : 'dark';
}

/**
 * Shows the Moon icon in light mode (click to switch to dark)
 * and the Sun icon in dark mode (click to switch to light).
 */
export function getThemeToggleIcon(current: ThemeMode): ThemeToggleIcon {
  return current === 'dark' ? 'sun' : 'moon';
}
