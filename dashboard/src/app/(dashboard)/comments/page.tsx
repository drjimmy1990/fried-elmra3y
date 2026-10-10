import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MessagesSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { CommentsCenter } from '@/components/comments/CommentsCenter';
import type { CommentSettings } from '@/components/comments/types';

export const metadata: Metadata = {
  title: 'التعليقات',
};

export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS: CommentSettings = {
  id: '',
  ai_enabled: true,
  ai_system_prompt: null,
  sensitive_keywords: [],
  complaint_public_reply: null,
  complaint_dm_message: null,
  complaint_hide_comment: false,
  complaint_create_ticket: true,
  complaint_notify_staff: true,
  dm_cooldown_hours: 24,
  reply_delay_min_sec: 5,
  reply_delay_max_sec: 40,
  ignore_nested_replies: true,
  ignore_mentions_only: true,
  branches_image_url: null,
  menu_image_url: null,
  offers_image_url: null,
  action_assets: [],
  fallback_dm_message: 'أهلاً بحضرتك يا فندم نورتنا! 🍗 تقدر تطلب أو تستفسر عن أي حاجة من هنا مباشرة 🛵',
  updated_at: new Date(0).toISOString(),
};

export default async function CommentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', user.id).single();
  if (!profile || !profile.is_active || (profile.role !== 'admin' && profile.role !== 'support_agent')) {
    redirect('/dashboard');
  }

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [events, rules, settings, posts, pages] = await Promise.all([
    supabase
      .from('comment_events')
      .select('*')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(300),
    supabase.from('comment_rules').select('*').order('priority', { ascending: true }),
    supabase.from('comment_settings').select('*').limit(1).maybeSingle(),
    supabase.from('post_settings').select('*').order('post_created_at', { ascending: false, nullsFirst: false }).limit(500),
    supabase
      .from('channels')
      .select('id, name, external_id, picture_url, status')
      .eq('platform', 'facebook')
      .order('connected_at', { ascending: true }),
  ]);

  const loadError = [events.error, rules.error, settings.error, posts.error, pages.error].find(Boolean);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <MessagesSquare className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">مركز التعليقات</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">تابع ردود البوت على تعليقات فيسبوك، تحكم في كل منشور، وظبط القواعد العامة</p>
        </div>
      </div>

      {loadError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">
          تعذر تحميل بعض البيانات: {loadError.message}. تأكد من تشغيل ملف قاعدة البيانات 04_v2_upgrade.sql.
        </div>
      )}

      <CommentsCenter
        role={profile.role as 'admin' | 'support_agent'}
        initialEvents={events.data ?? []}
        initialRules={rules.data ?? []}
        initialSettings={settings.data ?? DEFAULT_SETTINGS}
        initialPostSettings={posts.data ?? []}
        pages={pages.data ?? []}
      />
    </div>
  );
}
