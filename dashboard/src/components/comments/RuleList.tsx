'use client';

import React, { useState } from 'react';
import { Copy, Pencil, Trash2, Zap } from 'lucide-react';
import { Switch } from '@/components/ui/FormControls';
import { cn, formatTimeElapsed } from '@/lib/utils';
import { ruleActionBadges, type CommentRule, type PageOption } from './types';

interface Props {
  rules: CommentRule[];
  pages: PageOption[];
  canEdit: boolean;
  emptyText: string;
  onEdit: (rule: CommentRule) => void;
  onDuplicate: (rule: CommentRule) => void;
  onToggle: (rule: CommentRule, active: boolean) => Promise<void>;
  onDelete: (rule: CommentRule) => Promise<void>;
}

export function RuleList({ rules, pages, canEdit, emptyText, onEdit, onDuplicate, onToggle, onDelete }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const pageName = (id: string | null) => (id ? pages.find((p) => p.id === id)?.name ?? 'صفحة محذوفة' : null);

  const sorted = [...rules].sort(
    (a, b) =>
      (a.trigger_type === b.trigger_type ? 0 : a.trigger_type === 'keywords' ? -1 : 1) ||
      a.priority - b.priority ||
      a.name.localeCompare(b.name)
  );

  if (sorted.length === 0) {
    return <div className="p-6 text-center text-xs text-slate-500 rounded-2xl border border-dashed border-slate-800">{emptyText}</div>;
  }

  return (
    <ul className="space-y-2.5">
      {sorted.map((rule) => (
        <li
          key={rule.id}
          className={cn(
            'p-3.5 rounded-2xl border bg-slate-900/60 transition',
            rule.is_active ? 'border-slate-800' : 'border-slate-800/60 opacity-60'
          )}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-sm font-bold text-white">{rule.name}</h4>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400">أولوية {rule.priority}</span>
                {pageName(rule.channel_id) && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-300">{pageName(rule.channel_id)}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {rule.trigger_type === 'any' ? (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    أي تعليق
                  </span>
                ) : (
                  rule.keywords.slice(0, 8).map((k) => (
                    <span key={k} className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-200 border border-amber-500/20">
                      {k}
                    </span>
                  ))
                )}
                {rule.trigger_type === 'keywords' && rule.keywords.length > 8 && (
                  <span className="text-[11px] text-slate-500">+{rule.keywords.length - 8}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span>← {ruleActionBadges(rule).join(' · ') || 'بدون إجراء'}</span>
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <Zap className="w-3 h-3" />
                  {rule.total_triggers} مرة
                  {rule.last_triggered_at && ` · آخر مرة ${formatTimeElapsed(rule.last_triggered_at)}`}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <Switch
                checked={rule.is_active}
                disabled={!canEdit || busy === rule.id}
                label={rule.is_active ? 'إيقاف القاعدة' : 'تفعيل القاعدة'}
                size="sm"
                onChange={async (v) => {
                  setBusy(rule.id);
                  await onToggle(rule, v).finally(() => setBusy(null));
                }}
              />
              {canEdit && (
                <div className="flex items-center gap-1">
                  <IconBtn label="تعديل" onClick={() => onEdit(rule)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </IconBtn>
                  <IconBtn label="نسخ" onClick={() => onDuplicate(rule)}>
                    <Copy className="w-3.5 h-3.5" />
                  </IconBtn>
                  {confirmId === rule.id ? (
                    <button
                      type="button"
                      disabled={busy === rule.id}
                      onClick={async () => {
                        setBusy(rule.id);
                        await onDelete(rule).finally(() => {
                          setBusy(null);
                          setConfirmId(null);
                        });
                      }}
                      onBlur={() => setConfirmId(null)}
                      className="px-2 py-1 rounded-lg text-[11px] font-bold bg-rose-500/20 text-rose-200"
                    >
                      تأكيد الحذف
                    </button>
                  ) : (
                    <IconBtn label="حذف" danger onClick={() => setConfirmId(rule.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </IconBtn>
                  )}
                </div>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 transition',
        danger ? 'hover:text-rose-300 hover:bg-rose-500/10' : 'hover:text-white hover:bg-slate-800'
      )}
    >
      {children}
    </button>
  );
}
