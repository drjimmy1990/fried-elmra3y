import React from 'react';
import { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Radio } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { oauthRedirectUri } from '@/lib/site-url';
import { ChannelsManager } from '@/components/channels/ChannelsManager';

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

  const [{ data: settings }, sp, h] = await Promise.all([
    supabase.from('bot_settings').select('id, n8n_webhook_url').limit(1).maybeSingle(),
    searchParams,
    headers(),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 pb-6 border-b border-slate-800">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
          <Radio className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">القنوات وربط الصفحات</h1>
          <p className="text-sm text-slate-400 mt-1">اربط صفحات فيسبوك (مسنجر + التعليقات) بالبوت وتابع حالة الاتصال</p>
        </div>
      </div>

      <ChannelsManager
        redirectUri={oauthRedirectUri(h)}
        settingsId={settings?.id ?? null}
        initialWebhookUrl={settings?.n8n_webhook_url ?? ''}
        oauthStatus={sp.oauth ?? null}
        oauthError={sp.oauth_error ?? null}
      />
    </div>
  );
}
