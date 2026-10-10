'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ClipboardPaste,
  Facebook,
  KeyRound,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Stethoscope,
  Trash2,
  Unplug,
  Webhook,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { btn, inputClass } from '@/components/ui/Modal';
import { cn, formatDateTime } from '@/lib/utils';
import { CopyField } from './CopyField';
import { ManualTokenModal } from './ManualTokenModal';
import { MetaAppModal } from './MetaAppModal';
import { PageSelectModal } from './PageSelectModal';
import { SetupGuide } from './SetupGuide';
import { ChannelView, MetaAppView, Notice, api } from './types';

interface Props {
  redirectUri: string;
  settingsId: string | null;
  initialWebhookUrl: string;
  oauthStatus: string | null;
  oauthError: string | null;
}

type TestResult = { ok: boolean; checks: Array<{ label: string; ok: boolean; detail?: string }> };

const STATUS_BADGE: Record<ChannelView['status'], { label: string; cls: string }> = {
  connected: { label: 'متصلة وتعمل', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25' },
  error: { label: 'فيها مشكلة', cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25' },
  disconnected: { label: 'مفصولة', cls: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700' },
};

export function ChannelsManager({ redirectUri, settingsId, initialWebhookUrl, oauthStatus, oauthError }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [apps, setApps] = useState<MetaAppView[]>([]);
  const [channels, setChannels] = useState<ChannelView[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(oauthError ? { type: 'error', text: oauthError } : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, TestResult>>({});

  const [appModal, setAppModal] = useState<{ open: boolean; app: MetaAppView | null }>({ open: false, app: null });
  const [manualOpen, setManualOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(oauthStatus === 'select');

  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl);
  const [savedWebhookUrl, setSavedWebhookUrl] = useState(initialWebhookUrl);
  const [savingWebhook, setSavingWebhook] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, c] = await Promise.all([
        api<{ apps: MetaAppView[] }>('/api/meta-apps'),
        api<{ channels: ChannelView[] }>('/api/channels'),
      ]);
      setApps(a.apps);
      setChannels(c.channels);
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Drop ?oauth / ?oauth_error from the URL once handled so a refresh doesn't repeat them
  useEffect(() => {
    if (oauthStatus || oauthError) router.replace('/dashboard/channels', { scroll: false });
  }, [oauthStatus, oauthError, router]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (err) {
      setNotice({ type: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
    }
  };

  // ---------------------------------------------------------------- webhook URL
  const saveWebhook = async () => {
    const url = webhookUrl.trim();
    if (url && !/^https:\/\/\S+$/i.test(url)) {
      setNotice({ type: 'error', text: 'رابط n8n لازم يبدأ بـ https:// (فيسبوك مش بيقبل http)' });
      return;
    }
    if (!settingsId) {
      setNotice({ type: 'error', text: 'صف إعدادات البوت غير موجود — شغّل 04_v2_upgrade.sql' });
      return;
    }
    setSavingWebhook(true);
    const { error } = await supabase.from('bot_settings').update({ n8n_webhook_url: url || null }).eq('id', settingsId);
    setSavingWebhook(false);
    if (error) setNotice({ type: 'error', text: error.message });
    else {
      setSavedWebhookUrl(url);
      setNotice({ type: 'success', text: 'تم حفظ رابط الويب هوك' });
    }
  };

  // ---------------------------------------------------------------- apps
  const toggleApp = (app: MetaAppView) =>
    run(`app-${app.id}`, async () => {
      const r = await api<{ app: MetaAppView }>(`/api/meta-apps/${app.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !app.is_active }),
      });
      setApps((prev) => prev.map((a) => (a.id === app.id ? { ...r.app, pages_count: a.pages_count } : a)));
    });

  const deleteApp = (app: MetaAppView) => {
    const msg = app.pages_count
      ? `حذف التطبيق "${app.name}"؟\n${app.pages_count} صفحة مربوطة بيه هتفضل محفوظة لكن من غير تطبيق، ولازم تربطها بتطبيق تاني.`
      : `حذف التطبيق "${app.name}"؟`;
    if (!window.confirm(msg)) return;
    run(`app-${app.id}`, async () => {
      await api(`/api/meta-apps/${app.id}`, { method: 'DELETE' });
      await load();
      setNotice({ type: 'success', text: 'تم حذف التطبيق' });
    });
  };

  // ---------------------------------------------------------------- channels
  const testChannel = (ch: ChannelView) =>
    run(`ch-${ch.id}`, async () => {
      const r = await api<TestResult & { channel: ChannelView }>(`/api/channels/${ch.id}/test`, { method: 'POST' });
      setTests((prev) => ({ ...prev, [ch.id]: { ok: r.ok, checks: r.checks } }));
      setChannels((prev) => prev.map((c) => (c.id === ch.id ? { ...c, ...r.channel } : c)));
    });

  const relinkChannel = (ch: ChannelView, metaAppId: string) =>
    run(`ch-${ch.id}`, async () => {
      await api(`/api/channels/${ch.id}`, { method: 'PATCH', body: JSON.stringify({ meta_app_id: metaAppId || null }) });
      await load();
    });

  const disconnectChannel = (ch: ChannelView, purge = false) => {
    const msg = purge
      ? `حذف الصفحة "${ch.name}" نهائياً من لوحة التحكم؟ (العملاء والطلبات القديمة مش هتتمسح)`
      : `فصل الصفحة "${ch.name}"؟ البوت هيبطل يرد على تعليقاتها ورسائلها.`;
    if (!window.confirm(msg)) return;
    run(`ch-${ch.id}`, async () => {
      const r = await api<{ warning: string | null }>(`/api/channels/${ch.id}${purge ? '?purge=1' : ''}`, { method: 'DELETE' });
      await load();
      setNotice(r.warning ? { type: 'warning', text: r.warning } : { type: 'success', text: purge ? 'تم حذف الصفحة' : 'تم فصل الصفحة' });
    });
  };

  const activeApps = apps.filter((a) => a.is_active);
  const connectedCount = channels.filter((c) => c.status === 'connected').length;

  return (
    <div className="space-y-6">
      {notice && (
        <div
          role="status"
          className={cn(
            'p-4 rounded-2xl border flex items-start gap-3 text-sm',
            notice.type === 'success' && 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200',
            notice.type === 'error' && 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-500/30 text-rose-800 dark:text-rose-200',
            notice.type === 'warning' && 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-200'
          )}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : notice.type === 'error' ? (
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
          ) : (
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          )}
          <span className="flex-1 whitespace-pre-line leading-relaxed">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="إغلاق" className="opacity-70 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <SetupGuide />

      {/* ------------------------------------------------------------ Webhook URL */}
      <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-300 flex items-center justify-center">
            <Webhook className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">رابط الويب هوك (n8n)</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              رابط واحد لكل الصفحات وكل التطبيقات — n8n بيعرف الصفحة من رقمها. ده اللي بتحطه في Callback URL في فيسبوك.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            dir="ltr"
            className={`${inputClass} font-mono text-left flex-1`}
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-n8n.example.com/webhook/meta-router"
          />
          <button type="button" className={btn.primary} onClick={saveWebhook} disabled={savingWebhook || webhookUrl.trim() === savedWebhookUrl}>
            {savingWebhook ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            حفظ
          </button>
        </div>
        {savedWebhookUrl && <CopyField label="Callback URL (انسخه لفيسبوك)" value={savedWebhookUrl} />}
      </section>

      {/* ------------------------------------------------------------ Meta apps */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" /> تطبيقات ميتا
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">كل تطبيق له App ID و Secret — ممكن تضيف أكتر من تطبيق لو صفحاتك على تطبيقات مختلفة.</p>
          </div>
          <button type="button" className={btn.primary} onClick={() => setAppModal({ open: true, app: null })}>
            <Plus className="w-4 h-4" /> إضافة تطبيق ميتا
          </button>
        </div>

        {loading ? (
          <div className="h-32 rounded-3xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 animate-pulse" />
        ) : apps.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            لسه مفيش تطبيقات. ابدأ بـ “إضافة تطبيق ميتا” (افتح الدليل فوق لو أول مرة).
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {apps.map((app) => (
              <article
                key={app.id}
                className={cn('rounded-3xl border bg-white dark:bg-slate-900/60 p-5 space-y-4 shadow-xs', app.is_active ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800 opacity-60')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{app.name}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      App ID: <span dir="ltr" className="font-mono">{app.app_id}</span> · Secret:{' '}
                      <span dir="ltr" className="font-mono">{app.secret_hint}</span> · {app.pages_count} صفحة
                      {app.login_config_id && ' · Login for Business'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleApp(app)}
                      disabled={busy === `app-${app.id}`}
                      className={cn(
                        'text-[11px] font-bold rounded-full px-2.5 py-1 border transition',
                        app.is_active ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                      )}
                      aria-pressed={app.is_active}
                    >
                      {app.is_active ? 'مفعّل' : 'موقوف'}
                    </button>
                    <button type="button" onClick={() => setAppModal({ open: true, app })} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400" aria-label="تعديل">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => deleteApp(app)} className="p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300" aria-label="حذف">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <CopyField label="Verify Token (لإعدادات Webhooks في فيسبوك)" value={app.webhook_verify_token} secret />
                  <CopyField label="رابط الرجوع — Valid OAuth Redirect URI" value={redirectUri} />
                </div>

                <a
                  href={app.is_active ? `/api/channels/oauth/start?app=${app.id}` : undefined}
                  aria-disabled={!app.is_active}
                  className={cn(btn.facebook, 'w-full', !app.is_active && 'pointer-events-none opacity-50')}
                >
                  <Facebook className="w-4 h-4" /> ربط صفحات عبر فيسبوك
                </a>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------ Pages */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Link2 className="w-4 h-4 text-amber-500" /> الصفحات المتصلة
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">({connectedCount} شغالة)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">مسنجر وتعليقات فيسبوك حالياً — انستجرام وواتساب هيتضافوا هنا بعدين.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className={btn.secondary} onClick={() => load()} aria-label="تحديث">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button type="button" className={btn.secondary} onClick={() => setManualOpen(true)} disabled={loading}>
              <ClipboardPaste className="w-4 h-4" /> ربط يدوي برمز
            </button>
          </div>
        </div>

        {loading ? (
          <div className="h-40 rounded-3xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 animate-pulse" />
        ) : channels.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            مفيش صفحات متصلة. اضغط “ربط صفحات عبر فيسبوك” من كارت التطبيق.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {channels.map((ch) => {
              const badge = STATUS_BADGE[ch.status];
              const test = tests[ch.id];
              const isBusy = busy === `ch-${ch.id}`;
              return (
                <article key={ch.id} className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    {ch.picture_url ? (
                      <Image src={ch.picture_url} alt="" width={48} height={48} className="w-12 h-12 rounded-2xl object-cover border border-slate-200 dark:border-slate-700" unoptimized />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-600 dark:text-blue-300 flex items-center justify-center">
                        <Facebook className="w-6 h-6" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">{ch.name || 'صفحة بدون اسم'}</h3>
                        <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5 border', badge.cls)}>{badge.label}</span>
                      </div>
                      <p dir="ltr" className="text-[11px] text-slate-500 dark:text-slate-400 font-mono text-right">
                        Page ID: {ch.external_id}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {ch.status === 'disconnected'
                          ? 'لا يوجد رمز محفوظ'
                          : ch.token_expires_at
                            ? `الرمز ينتهي: ${formatDateTime(ch.token_expires_at)}`
                            : 'رمز دائم ✓'}
                        {ch.last_checked_at && ` · آخر فحص ${formatDateTime(ch.last_checked_at)}`}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-400 mb-1">تطبيق ميتا</label>
                    <select
                      className={`${inputClass} py-2 text-xs`}
                      value={ch.meta_app_id ?? ''}
                      onChange={(e) => relinkChannel(ch, e.target.value)}
                      disabled={isBusy}
                    >
                      <option value="">— بدون تطبيق —</option>
                      {apps.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {ch.last_error && ch.status === 'error' && (
                    <p className="text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/20 rounded-xl p-3 leading-relaxed">{ch.last_error}</p>
                  )}

                  {test && (
                    <ul className="space-y-1.5 text-xs">
                      {test.checks.map((c) => (
                        <li key={c.label} className="flex items-start gap-2">
                          {c.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />}
                          <span className="text-slate-700 dark:text-slate-300">
                            {c.label}
                            {c.detail && <span className="block text-slate-500 dark:text-slate-400">{c.detail}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {ch.status !== 'disconnected' ? (
                      <>
                        <button type="button" className={btn.secondary} onClick={() => testChannel(ch)} disabled={isBusy || !ch.has_token}>
                          {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />}
                          اختبار وإصلاح
                        </button>
                        <button type="button" className={btn.danger} onClick={() => disconnectChannel(ch)} disabled={isBusy}>
                          <Unplug className="w-4 h-4" /> فصل
                        </button>
                      </>
                    ) : (
                      <>
                        {ch.meta_app && activeApps.some((a) => a.id === ch.meta_app_id) && (
                          <a href={`/api/channels/oauth/start?app=${ch.meta_app_id}`} className={btn.facebook}>
                            <Facebook className="w-4 h-4" /> إعادة الربط
                          </a>
                        )}
                        <button type="button" className={btn.danger} onClick={() => disconnectChannel(ch, true)} disabled={isBusy}>
                          <Trash2 className="w-4 h-4" /> حذف نهائي
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <MetaAppModal
        open={appModal.open}
        app={appModal.app}
        onClose={() => setAppModal({ open: false, app: null })}
        onSaved={(saved) => {
          setApps((prev) => (prev.some((a) => a.id === saved.id) ? prev.map((a) => (a.id === saved.id ? saved : a)) : [...prev, saved]));
          setNotice({ type: 'success', text: 'تم حفظ التطبيق — الخطوة الجاية: حط رابط الرجوع في Facebook Login ثم اضغط “ربط صفحات عبر فيسبوك”' });
        }}
      />
      <ManualTokenModal
        open={manualOpen}
        apps={activeApps}
        onClose={() => setManualOpen(false)}
        onConnected={(warning) => {
          load();
          setNotice(warning ? { type: 'warning', text: warning } : { type: 'success', text: 'تم ربط الصفحة بنجاح' });
        }}
      />
      <PageSelectModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onDone={({ connected, warnings, errors }) => {
          load();
          const lines = [`تم ربط ${connected} صفحة`, ...warnings, ...errors];
          setNotice({ type: errors.length ? 'error' : warnings.length ? 'warning' : 'success', text: lines.join('\n') });
        }}
      />
    </div>
  );
}
