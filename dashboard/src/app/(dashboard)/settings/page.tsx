import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BotSettingsForm } from '@/components/settings/BotSettingsForm';
import { Sliders, Sparkles } from 'lucide-react';
import { BotSettings } from '@/components/settings/types';

export const metadata: Metadata = {
  title: 'إعدادات البوت والتشغيل | مطعم الخديوي',
  description: 'التحكم في أتمتة الرد الذكي، ساعات العمل، أسعار التوصيل وإشعارات التيليجرام',
};

export const revalidate = 0; // Dynamic server component

export default async function SettingsPage() {
  const supabase = await createClient();

  // 1. RBAC Guard: Strictly restricted to active admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    redirect('/dashboard');
  }

  // 2. Fetch single row from bot_settings or seed default
  let { data: settings, error: fetchError } = await supabase
    .from('bot_settings')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching bot_settings:', fetchError);
  }

  if (!settings) {
    const { data: created, error: createError } = await supabase
      .from('bot_settings')
      .insert({
        bot_enabled: true,
        auto_pause_on_complaint: true,
        notify_telegram: true,
        notify_dashboard: true,
        business_hours_enabled: false,
        open_time: '10:00:00',
        close_time: '02:00:00',
        currency: 'EGP',
        delivery_fee: 15.0,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating default bot_settings:', createError);
    }
    settings = created;
  }

  // Fallback safe representation if database returned null
  const safeSettings: BotSettings = settings || {
    id: '00000000-0000-0000-0000-000000000001',
    bot_enabled: true,
    auto_pause_on_complaint: true,
    notify_telegram: true,
    telegram_bot_token: null,
    telegram_chat_id: null,
    facebook_page_id: null,
    facebook_page_access_token: null,
    notify_dashboard: true,
    business_hours_enabled: false,
    open_time: '10:00:00',
    close_time: '02:00:00',
    off_hours_message: null,
    ai_system_prompt: null,
    menu_full_image_url: null,
    menu_full_pdf_url: null,
    currency: 'EGP',
    delivery_fee: 15.0,
    updated_at: new Date().toISOString(),
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/5">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">إعدادات البوت والتشغيل</h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                تحكم المدير
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              إدارة الأتمتة الشاملة لمحادثات مسنجر، ساعات العمل، وموجه الذكاء الاصطناعي وتنبيهات الطوارئ
            </p>
          </div>
        </div>
      </div>

      {/* Settings Form */}
      <BotSettingsForm initialSettings={safeSettings} />
    </div>
  );
}
