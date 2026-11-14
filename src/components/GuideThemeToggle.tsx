import { useEffect, useLayoutEffect, useState } from 'react';

/** Absent value means follow the system color scheme. Kept in sync with the script in index.html. */
export const GUIDE_THEME_KEY = 'tracktidy.guides.theme';

type Choice = 'system' | 'light' | 'dark';

function storedChoice(): Choice {
  try {
    const value = localStorage.getItem(GUIDE_THEME_KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch {
    /* Private browsing can block storage. The system scheme still applies. */
  }
  return 'system';
}

function systemNight(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function applyChoice(choice: Choice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-guide-theme');
  else root.setAttribute('data-guide-theme', choice);
}

export function GuideThemeToggle() {
  const [choice, setChoice] = useState<Choice>(storedChoice);
  const [systemIsNight, setSystemIsNight] = useState(systemNight);
  const night = choice === 'dark' || (choice === 'system' && systemIsNight);

  useLayoutEffect(() => {
    applyChoice(choice);
    return () => {
      document.documentElement.removeAttribute('data-guide-theme');
    };
  }, [choice]);

  useEffect(() => {
    let media: MediaQueryList;
    try {
      media = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }
    const onChange = () => setSystemIsNight(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  function toggle() {
    const next: Choice = night ? 'light' : 'dark';
    try {
      localStorage.setItem(GUIDE_THEME_KEY, next);
    } catch {
      /* The switch still changes this visit. */
    }
    setChoice(next);
  }

  return (
    <button
      type="button"
      className="guide-night"
      aria-pressed={night}
      aria-label={night ? 'Night mode on' : 'Night mode off'}
      onClick={toggle}
    >
      <span className="guide-night-track" aria-hidden="true">
        <span className="guide-night-thumb" />
      </span>
      <span className="guide-night-label">{night ? 'Dark' : 'Light'}</span>
    </button>
  );
}
