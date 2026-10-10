'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`h-9 w-9 rounded-xl border border-slate-700/50 bg-slate-800/40 opacity-0 ${className}`} />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all duration-200 cursor-pointer ${
        isDark
          ? 'border-slate-800 bg-slate-900 text-amber-400 hover:border-amber-500/40 hover:bg-slate-800 hover:text-amber-300 shadow-xs'
          : 'border-slate-200 bg-white text-slate-700 hover:border-amber-400 hover:bg-amber-50/50 hover:text-amber-600 shadow-xs'
      } ${className}`}
      title={isDark ? 'التبديل إلى الوضع الفاتح (Light)' : 'التبديل إلى الوضع الداكن (Dark)'}
      aria-label={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
    >
      <div className="relative h-4.5 w-4.5 flex items-center justify-center">
        {isDark ? (
          <Sun className="h-4.5 w-4.5 transition-transform duration-300 hover:rotate-45" />
        ) : (
          <Moon className="h-4.5 w-4.5 transition-transform duration-300 hover:-rotate-12" />
        )}
      </div>
    </button>
  );
}
