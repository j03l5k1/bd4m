'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      setIsDark(true);
    } else if (html.classList.contains('light')) {
      setIsDark(false);
    } else {
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  function toggle() {
    const html = document.documentElement;
    const goingDark = !isDark;
    html.classList.remove('dark', 'light');
    html.classList.add(goingDark ? 'dark' : 'light');
    setIsDark(goingDark);
    try {
      localStorage.setItem('theme', goingDark ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 100,
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: '1px solid var(--line-strong)',
        background: 'var(--surface)',
        color: 'var(--text-soft)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--shadow-card)',
        transition: 'background 0.2s ease, color 0.2s ease, transform 0.16s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
