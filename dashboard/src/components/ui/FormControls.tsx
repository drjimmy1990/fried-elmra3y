'use client';

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inputClass } from '@/components/ui/Modal';

/** Accessible toggle switch. */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
  size = 'md',
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative shrink-0 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        size === 'md' ? 'w-11 h-6' : 'w-9 h-5',
        checked ? 'bg-emerald-500' : 'bg-slate-700'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 rounded-full bg-white shadow transition-all',
          size === 'md' ? 'w-5 h-5' : 'w-4 h-4',
          checked ? (size === 'md' ? 'right-[22px]' : 'right-[18px]') : 'right-0.5'
        )}
      />
    </button>
  );
}

/** Keyword chips: Enter / comma / button to add, × to remove. */
export function TagInput({
  value,
  onChange,
  placeholder,
  disabled,
  tone = 'amber',
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  tone?: 'amber' | 'rose';
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const parts = draft
      .split(/[,،\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !value.includes(s));
    if (parts.length) onChange([...value, ...parts]);
    setDraft('');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={draft}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          onClick={add}
          disabled={disabled || !draft.trim()}
          className="shrink-0 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40"
          aria-label="إضافة"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span
              key={t}
              className={cn(
                'inline-flex items-center gap-1 pl-1.5 pr-2.5 py-1 rounded-lg text-xs font-semibold border',
                tone === 'rose'
                  ? 'bg-rose-500/10 text-rose-200 border-rose-500/25'
                  : 'bg-amber-500/10 text-amber-200 border-amber-500/25'
              )}
            >
              {t}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(value.filter((x) => x !== t))}
                  className="hover:text-white"
                  aria-label={`حذف ${t}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Editable list of multi-line texts (reply variations). */
export function TextListEditor({
  value,
  onChange,
  placeholder,
  addLabel = 'إضافة صيغة',
  disabled,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {value.map((text, i) => (
        <div key={i} className="flex gap-2 items-start">
          <span className="mt-2.5 w-6 shrink-0 text-center text-[11px] font-bold text-slate-500">{i + 1}</span>
          <textarea
            rows={2}
            className={cn(inputClass, 'resize-y')}
            value={text}
            disabled={disabled}
            placeholder={placeholder}
            onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="mt-1.5 w-8 h-8 shrink-0 rounded-lg text-slate-500 hover:text-rose-300 hover:bg-rose-500/10 flex items-center justify-center"
              aria-label="حذف الصيغة"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => onChange([...value, ''])}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200"
        >
          <Plus className="w-3.5 h-3.5" />
          {addLabel}
        </button>
      )}
    </div>
  );
}
