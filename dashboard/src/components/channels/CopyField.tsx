'use client';

import React, { useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CopyFieldProps {
  label: string;
  value: string;
  hint?: string;
  secret?: boolean;
  className?: string;
}

/** Read-only LTR value with a copy button (and optional reveal for secrets). */
export function CopyField({ label, value, hint, secret = false, className }: CopyFieldProps) {
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(!secret);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked on http:// origins; the value stays selectable.
    }
  };

  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold text-slate-400 mb-1">{label}</label>
      <div className="flex items-stretch gap-1.5">
        <code
          dir="ltr"
          className="flex-1 min-w-0 truncate rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2 text-xs text-slate-200 font-mono select-all"
          title={revealed ? value : undefined}
        >
          {revealed ? value || '—' : '•'.repeat(Math.min(24, value.length || 8))}
        </code>
        {secret && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="shrink-0 w-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition"
            aria-label={revealed ? 'إخفاء' : 'إظهار'}
          >
            {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
        <button
          type="button"
          onClick={copy}
          disabled={!value}
          className={cn(
            'shrink-0 w-9 rounded-lg flex items-center justify-center transition disabled:opacity-40',
            copied ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
          )}
          aria-label="نسخ"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}
