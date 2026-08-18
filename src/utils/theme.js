const STORAGE_KEY = 'text-encoder-theme';

export function getInitialTheme() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  localStorage.setItem(STORAGE_KEY, theme);
}

export function toggleTheme(current) {
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
