import React from 'react';
import { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Radio } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { toPublicMetaApp } from '@/lib/meta/channels';
import { oauthRedirectUri } from '@/lib/site-url';
import { ChannelsManager } from '@/components/channels/ChannelsManager';
import type { MetaAppView, ChannelView } from '@/components/channels/types';

export const metadata: Metadata = {
  title: 'القنوات وربط الصفحات',
};

export const dynamic = 'force-dynamic';

export default async function ChannelsPage({
  searchParams,
}: {
  searchParams: Promise<{ oauth?: string; oauth_error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin' || !profile.is_active) redirect('/dashboard');

  let initialApps: MetaAppView[] = [];
  let initialChannels: ChannelView[] = [];

  const [{ data: settings }, sp, h] = await Promise.all([
    supabase.from('bot_settings').select('id, n8n_webhook_url').limit(1).maybeSingle(),
    searchParams,
    headers(),
  ]);

  try {
    const adminDb = createAdminClient();
    const [{ data: apps }, { data: activeChannels }, { data: allChannels }, { data: secrets }] = await Promise.all([
      adminDb.from('meta_apps').select('*').order('created_at', { ascending: true }),
      adminDb.from('channels').select('meta_app_id').neq('status', 'disconnected'),
      adminDb.from('channels').select('*').order('created_at', { ascending: true }),
      adminDb.from('channel_secrets').select('channel_id'),
    ]);

    const counts = new Map<string, number>();
    for (const c of activeChannels ?? []) {
      if (c.meta_app_id) counts.set(c.meta_app_id, (counts.get(c.meta_app_id) ?? 0) + 1);
    }
    initialApps = (apps ?? []).map((a) => toPublicMetaApp(a, counts.get(a.id) ?? 0));

    const appById = new Map((apps ?? []).map((a) => [a.id, a]));
    const withToken = new Set((secrets ?? []).map((s) => s.channel_id));
    initialChannels = (allChannels ?? []).map((c) => ({
      ...c,
      has_token: withToken.has(c.id),
      meta_app:
        c.meta_app_id && appById.has(c.meta_app_id)
          ? {
              id: appById.get(c.meta_app_id)!.id,
              name: appById.get(c.meta_app_id)!.name,
              app_id: appById.get(c.meta_app_id)!.app_id,
            }
          : null,
    }));
  } catch (err) {
    console.error('SSR prefetch error in ChannelsPage:', err);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <Radio className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">القنوات وربط الصفحات</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">اربط صفحات فيسبوك (مسنجر + التعليقات) بالبوت وتابع حالة الاتصال</p>
        </div>
      </div>

      <ChannelsManager
        redirectUri={oauthRedirectUri(h)}
        settingsId={settings?.id ?? null}
        initialWebhookUrl={settings?.n8n_webhook_url ?? ''}
        oauthStatus={sp.oauth ?? null}
        oauthError={sp.oauth_error ?? null}
        initialApps={initialApps}
        initialChannels={initialChannels}
      />
    </div>
  );
}
