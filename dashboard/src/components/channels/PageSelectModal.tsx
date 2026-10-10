'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, CheckCircle2, Facebook, Loader2 } from 'lucide-react';
import { Modal, btn } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { SelectablePage, api } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: (summary: { connected: number; warnings: string[]; errors: string[] }) => void;
}

const TASK_LABELS: Record<string, string> = { MODERATE: 'إدارة التعليقات', MESSAGING: 'الرسائل' };

/** Shown after Facebook Login: lets the admin pick which pages to connect. */
export function PageSelectModal({ open, onClose, onDone }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appName, setAppName] = useState('');
  const [pages, setPages] = useState<SelectablePage[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    api<{ app: { name: string }; pages: SelectablePage[] }>('/api/channels/oauth/pages')
      .then((r) => {
        setAppName(r.app.name);
        setPages(r.pages);
        // Preselect pages that are new or need reconnecting and have the required access
        setSelected(new Set(r.pages.filter((p) => p.current_status !== 'connected' && p.missing_tasks.length === 0).map((p) => p.id)));
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [open]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const connect = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await api<{ results: Array<{ name: string; ok: boolean; warning?: string | null; error?: string }> }>(
        '/api/channels/oauth/pages',
        { method: 'POST', body: JSON.stringify({ pageIds: [...selected] }) }
      );
      onDone({
        connected: r.results.filter((x) => x.ok).length,
        warnings: r.results.filter((x) => x.warning).map((x) => `${x.name}: ${x.warning}`),
        errors: r.results.filter((x) => !x.ok).map((x) => `${x.name}: ${x.error}`),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      locked={saving}
      size="lg"
      icon={<Facebook className="w-5 h-5" />}
      title="اختر الصفحات اللي عايز تربطها"
      subtitle={appName ? `عن طريق تطبيق: ${appName}` : undefined}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose} disabled={saving}>
            إلغاء
          </button>
          <button type="button" className={btn.primary} onClick={connect} disabled={saving || loading || selected.size === 0}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'جارِ الربط...' : `ربط ${selected.size} صفحة`}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="py-12 flex flex-col items-center gap-3 text-slate-400 text-sm">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          جارِ جلب صفحاتك من فيسبوك...
        </div>
      ) : (
        <div className="space-y-3">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-200 flex items-start gap-2 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {!error && pages.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">
              مفيش صفحات ظهرت. تأكد إنك اخترت الصفحات في نافذة فيسبوك وإنك أدمن عليها، وبعدين جرّب تاني.
            </p>
          )}
          {pages.map((p) => {
            const isSel = selected.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-2xl border text-right transition',
                  isSel ? 'bg-amber-500/10 border-amber-500/40' : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                )}
              >
                <input type="checkbox" readOnly checked={isSel} className="accent-amber-500 w-4 h-4 shrink-0" tabIndex={-1} />
                {p.picture_url ? (
                  <Image src={p.picture_url} alt="" width={40} height={40} className="w-10 h-10 rounded-xl object-cover" unoptimized />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                    <Facebook className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{p.name}</p>
                  <p dir="ltr" className="text-[11px] text-slate-500 font-mono text-right">{p.id}</p>
                  {p.missing_tasks.length > 0 && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-300 mt-0.5">
                      صلاحيتك على الصفحة ناقصة: {p.missing_tasks.map((t) => TASK_LABELS[t] ?? t).join('، ')}
                    </p>
                  )}
                </div>
                {p.current_status === 'connected' && (
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-2 py-0.5 shrink-0">
                    متصلة بالفعل
                  </span>
                )}
              </button>
            );
          })}
          <p className="text-[11px] text-slate-500 pt-1">
            إعادة ربط صفحة متصلة بالفعل بتجدد الرمز بتاعها وبتصلح الاشتراك في الويب هوك.
          </p>
        </div>
      )}
    </Modal>
  );
}
