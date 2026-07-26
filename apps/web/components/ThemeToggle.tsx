'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'ally.theme';

export const THEME_INIT_SCRIPT = `(function(){try{
var t=localStorage.getItem('${STORAGE_KEY}');
if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}
document.documentElement.dataset.theme=t;
}catch(e){document.documentElement.dataset.theme='dark';}})();`;

function systemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme =
    theme === 'system' ? systemTheme() : theme;
}

function nextTheme(theme: Theme): Theme {
  return theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    setTheme(stored === 'light' || stored === 'dark' ? stored : 'system');
    setMounted(true);
  }, []);

  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const update = () => applyTheme('system');
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [theme]);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
    if (next === 'system') window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, next);
  }

  if (!mounted) return <span className="theme-toggle" aria-hidden="true" />;

  const next = nextTheme(theme);
  return (
    <button
      type="button"
      className="btn-ghost theme-toggle"
      onClick={() => choose(next)}
      aria-label={`Theme is ${theme}. Switch to ${next}.`}
      title={`Theme: ${theme}`}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {theme === 'system' ? (
          <>
            <rect x="1.75" y="2.75" width="12.5" height="8.5" rx="1.25" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5.5 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </>
        ) : theme === 'light' ? (
          <>
            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.1 1.1M11.85 11.85l1.1 1.1M12.95 3.05l-1.1 1.1M4.15 11.85l-1.1 1.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </>
        ) : (
          <path d="M13.5 9.6A5.9 5.9 0 0 1 6.4 2.5a5.9 5.9 0 1 0 7.1 7.1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        )}
      </svg>
    </button>
  );
}
