export type Theme = 'system' | 'light' | 'dark';

const THEME_KEY = 'rv.theme';

export function getStoredTheme(): Theme {
  return (localStorage.getItem(THEME_KEY) as Theme) || 'system';
}

export function applyTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
  const root = document.documentElement;
  
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

export function initTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);
}

