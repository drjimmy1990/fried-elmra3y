'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, ClipboardPaste } from 'lucide-react';
import { Modal, btn, inputClass } from '@/components/ui/Modal';
import { MetaAppView, api } from './types';

interface Props {
  open: boolean;
  apps: MetaAppView[];
  onClose: () => void;
  onConnected: (warning: string | null) => void;
}

export function ManualTokenModal({ open, apps, onClose, onConnected }: Props) {
  const [appId, setAppId] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAppId(apps[0]?.id ?? '');
    setToken('');
    setError(null);
    setSaving(false);
  }, [open, apps]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const r = await api<{ warning: string | null }>('/api/channels/manual', {
        method: 'POST',
        body: JSON.stringify({ access_token: token, meta_app_id: appId || null }),
      });
      onConnected(r.warning);
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
      icon={<ClipboardPaste className="w-5 h-5" />}
      title="ربط يدوي برمز الصفحة"
      subtitle="بديل احتياطي — الأفضل استخدام زر “ربط عبر فيسبوك”"
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose} disabled={saving}>
            إلغاء
          </button>
          <button type="submit" form="manual-token-form" className={btn.primary} disabled={saving || !token}>
            {saving ? 'جارِ التحقق...' : 'ربط الصفحة'}
          </button>
        </>
      }
    >
      <form id="manual-token-form" onSubmit={submit} className="space-y-4">
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 flex items-start gap-2 text-xs leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>
            الرمز اللي بتاخده من Graph API Explorer مباشرة <b>بينتهي خلال ساعة</b>. استخدم الطريقة دي بس لو معاك رمز صفحة دائم
            (Page Access Token مستخرج من User Token طويل المدة).
          </span>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-200 flex items-start gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">تطبيق ميتا التابع له الرمز</label>
          <select className={inputClass} value={appId} onChange={(e) => setAppId(e.target.value)}>
            {apps.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.app_id})
              </option>
            ))}
            <option value="">بدون تطبيق (غير مستحسن)</option>
          </select>
          <p className="text-[11px] text-slate-500 mt-1">اختيار التطبيق يسمح لنا نتأكد إن الرمز رمز صفحة ونعرف تاريخ انتهائه.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Page Access Token <span className="text-rose-400">*</span>
          </label>
          <textarea
            dir="ltr"
            rows={4}
            className={`${inputClass} font-mono text-xs text-left resize-none`}
            value={token}
            onChange={(e) => setToken(e.target.value.trim())}
            placeholder="EAAG..."
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </form>
    </Modal>
  );
}
