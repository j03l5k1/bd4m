'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
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
        top: '14px',
        right: '14px',
        zIndex: 200,
        width: '38px',
        height: '38px',
        borderRadius: '12px',
        border: isDark ? '1px solid rgba(0,212,255,0.25)' : '1px solid #b9d5d1',
        background: isDark ? '#10101e' : '#ffffff',
        color: isDark ? '#00d4ff' : '#0f766e',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isDark
          ? '0 4px 16px rgba(0,0,0,0.6), 0 0 12px rgba(0,212,255,0.12)'
          : '0 2px 8px rgba(15,23,42,0.12)',
        transition: 'background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease, transform 0.16s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
