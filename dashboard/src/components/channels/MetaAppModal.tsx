'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, KeyRound, RefreshCw } from 'lucide-react';
import { Modal, btn, inputClass } from '@/components/ui/Modal';
import { MetaAppView, api } from './types';

interface Props {
  open: boolean;
  app: MetaAppView | null; // null = create
  onClose: () => void;
  onSaved: (app: MetaAppView) => void;
}

export function MetaAppModal({ open, app, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [appId, setAppId] = useState('');
  const [secret, setSecret] = useState('');
  const [configId, setConfigId] = useState('');
  const [regenerate, setRegenerate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(app?.name ?? '');
    setAppId(app?.app_id ?? '');
    setSecret('');
    setConfigId(app?.login_config_id ?? '');
    setRegenerate(false);
    setError(null);
    setSaving(false);
  }, [open, app]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const result = app
        ? await api<{ app: MetaAppView }>(`/api/meta-apps/${app.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              name,
              app_secret: secret || undefined,
              login_config_id: configId,
              regenerate_verify_token: regenerate || undefined,
            }),
          })
        : await api<{ app: MetaAppView }>('/api/meta-apps', {
            method: 'POST',
            body: JSON.stringify({ name, app_id: appId, app_secret: secret, login_config_id: configId }),
          });
      onSaved({ ...result.app, pages_count: app?.pages_count ?? 0 });
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
      icon={<KeyRound className="w-5 h-5" />}
      title={app ? 'تعديل تطبيق ميتا' : 'إضافة تطبيق ميتا'}
      subtitle="البيانات موجودة في Meta for Developers ← App settings ← Basic"
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose} disabled={saving}>
            إلغاء
          </button>
          <button type="submit" form="meta-app-form" className={btn.primary} disabled={saving}>
            {saving ? 'جارِ التحقق مع فيسبوك...' : 'حفظ'}
          </button>
        </>
      }
    >
      <form id="meta-app-form" onSubmit={submit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-200 flex items-start gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">اسم مميز (اختياري)</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: تطبيق صفحة الفرع الرئيسي" />
          <p className="text-[11px] text-slate-500 mt-1">لو تركته فاضي هنستخدم اسم التطبيق من فيسبوك.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            App ID <span className="text-rose-400">*</span>
          </label>
          <input
            dir="ltr"
            className={`${inputClass} font-mono text-left`}
            value={appId}
            onChange={(e) => setAppId(e.target.value.replace(/\D/g, ''))}
            placeholder="1234567890123456"
            disabled={!!app}
            required={!app}
            inputMode="numeric"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            App Secret {!app && <span className="text-rose-400">*</span>}
          </label>
          <input
            dir="ltr"
            type="password"
            autoComplete="off"
            className={`${inputClass} font-mono text-left`}
            value={secret}
            onChange={(e) => setSecret(e.target.value.trim())}
            placeholder={app ? `${app.secret_hint ?? ''} — اتركه فاضي لو مش هتغيره` : 'اضغط Show بجوار App secret وانسخه'}
            required={!app}
          />
          <p className="text-[11px] text-slate-500 mt-1">
            يُحفظ في قاعدة البيانات فقط ولا يظهر في المتصفح مرة أخرى. هنتأكد منه مع فيسبوك قبل الحفظ.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">Configuration ID (اختياري)</label>
          <input
            dir="ltr"
            className={`${inputClass} font-mono text-left`}
            value={configId}
            onChange={(e) => setConfigId(e.target.value.replace(/\D/g, ''))}
            placeholder="فقط لو تطبيقك فيه Facebook Login for Business"
            inputMode="numeric"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            لو لقيت في تطبيقك منتج <b>Facebook Login for Business</b> بدل Facebook Login: اعمل Configuration من نوع
            “User access token” واختار الصفحات والصلاحيات، وحط رقمها هنا. غير كده سيبه فاضي.
          </p>
        </div>

        {app && (
          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800 cursor-pointer">
            <input type="checkbox" className="mt-0.5 accent-amber-500" checked={regenerate} onChange={(e) => setRegenerate(e.target.checked)} />
            <span className="text-xs text-slate-300">
              <span className="font-semibold flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> توليد Verify Token جديد
              </span>
              <span className="text-slate-500">لو غيرته لازم تحدثه في إعدادات Webhooks في فيسبوك.</span>
            </span>
          </label>
        )}
      </form>
    </Modal>
  );
}
