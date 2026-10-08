'use client';

import React, { useMemo, useState } from 'react';
import { Globe2, Image as ImageIcon, Inbox, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { btn } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import type { Json } from '@/types/database.types';
import { CommentInbox } from './CommentInbox';
import { CommentSettingsForm } from './CommentSettingsForm';
import { PostsGrid } from './PostsGrid';
import { RuleEditorModal } from './RuleEditorModal';
import { RuleList } from './RuleList';
import { RuleTester } from './RuleTester';
import {
  emptyRule,
  ruleToDraft,
  type CommentEvent,
  type CommentRule,
  type CommentSettings,
  type FbPost,
  type PageOption,
  type PostSetting,
  type RuleDraft,
} from './types';

type Tab = 'inbox' | 'posts' | 'global';

interface Props {
  role: 'admin' | 'support_agent';
  initialEvents: CommentEvent[];
  initialRules: CommentRule[];
  initialSettings: CommentSettings;
  initialPostSettings: PostSetting[];
  pages: PageOption[];
}

/** Only the columns staff may edit (never counters / timestamps the workflow maintains). */
function rulePayload(d: RuleDraft) {
  return {
    scope: d.scope,
    facebook_post_id: d.scope === 'post' ? d.facebook_post_id ?? null : null,
    channel_id: d.channel_id ?? null,
    name: d.name,
    trigger_type: d.trigger_type,
    keywords: d.keywords ?? [],
    priority: d.priority ?? 100,
    reply_enabled: !!d.reply_enabled,
    reply_variations: d.reply_variations ?? [],
    like_comment: !!d.like_comment,
    dm_enabled: !!d.dm_enabled,
    dm_message: d.dm_message ?? null,
    dm_image_url: d.dm_image_url ?? null,
    dm_buttons: d.dm_buttons as unknown as Json,
    dm_send_menu: !!d.dm_send_menu,
    dm_send_offers: !!d.dm_send_offers,
    hide_comment: !!d.hide_comment,
    create_complaint: !!d.create_complaint,
    notify_staff: !!d.notify_staff,
    is_active: d.is_active ?? true,
  };
}

export function CommentsCenter({ role, initialEvents, initialRules, initialSettings, initialPostSettings, pages }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const canEdit = role === 'admin';
  const [tab, setTab] = useState<Tab>('inbox');
  const [rules, setRules] = useState(initialRules);
  const [settings, setSettings] = useState(initialSettings);
  const [postSettings, setPostSettings] = useState(initialPostSettings);
  const [editor, setEditor] = useState<RuleDraft | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 3500);
  };

  // ---------------- rules ----------------
  const saveRule = async (draft: RuleDraft) => {
    const payload = rulePayload(draft);
    const query = draft.id
      ? supabase.from('comment_rules').update(payload).eq('id', draft.id).select().single()
      : supabase.from('comment_rules').insert(payload).select().single();
    const { data, error } = await query;
    if (error || !data) throw new Error(`تعذر حفظ القاعدة: ${error?.message ?? ''}`);
    setRules((prev) => (draft.id ? prev.map((r) => (r.id === data.id ? data : r)) : [...prev, data]));
    setEditor(null);
    flash('تم حفظ القاعدة');
  };

  const toggleRule = async (rule: CommentRule, active: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: active } : r)));
    const { error } = await supabase.from('comment_rules').update({ is_active: active }).eq('id', rule.id);
    if (error) {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: rule.is_active } : r)));
      flash(`تعذر التحديث: ${error.message}`);
    }
  };

  const deleteRule = async (rule: CommentRule) => {
    const { error } = await supabase.from('comment_rules').delete().eq('id', rule.id);
    if (error) return flash(`تعذر الحذف: ${error.message}`);
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
    flash('تم حذف القاعدة');
  };

  const ruleHandlers = {
    onEdit: (rule: CommentRule) => setEditor(ruleToDraft(rule)),
    onDuplicate: (rule: CommentRule) => {
      const { id: _id, ...rest } = ruleToDraft(rule);
      setEditor({ ...rest, name: `${rule.name} (نسخة)` });
    },
    onToggle: toggleRule,
    onDelete: deleteRule,
  };

  // ---------------- posts ----------------
  const toggleBot = async (post: FbPost, channelId: string, enabled: boolean) => {
    const { data, error } = await supabase
      .from('post_settings')
      .upsert(
        {
          facebook_post_id: post.id,
          channel_id: channelId,
          bot_enabled: enabled,
          post_caption: post.message ? post.message.slice(0, 500) : null,
          post_thumbnail_url: post.full_picture,
          post_url: post.permalink_url,
          post_created_at: post.created_time,
        },
        { onConflict: 'facebook_post_id' }
      )
      .select()
      .single();
    if (error || !data) return flash(`تعذر تحديث المنشور: ${error?.message ?? ''}`);
    setPostSettings((prev) => [data, ...prev.filter((p) => p.facebook_post_id !== data.facebook_post_id)]);
    flash(enabled ? 'البوت شغال على المنشور' : 'تم إيقاف البوت على المنشور');
  };

  const openPostRule = (postId: string, channelId: string | null) => setEditor(emptyRule('post', postId, channelId));

  // ---------------- settings ----------------
  const saveSettings = async (patch: Partial<CommentSettings>) => {
    const query = settings.id
      ? supabase.from('comment_settings').update(patch).eq('id', settings.id).select().single()
      : supabase.from('comment_settings').insert(patch).select().single();
    const { data, error } = await query;
    if (error || !data) throw new Error(error?.message ?? 'تعذر الحفظ');
    setSettings(data);
  };

  const globalRules = rules.filter((r) => r.scope === 'global');
  const editorPost = editor?.scope === 'post' ? postSettings.find((p) => p.facebook_post_id === editor.facebook_post_id) : null;

  const tabs: Array<[Tab, string, React.ReactNode]> = [
    ['inbox', 'صندوق التعليقات', <Inbox key="i" className="w-4 h-4" />],
    ['posts', 'المنشورات', <ImageIcon key="p" className="w-4 h-4" />],
    ['global', 'القواعد العامة', <Globe2 key="g" className="w-4 h-4" />],
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-1.5 p-1.5 rounded-2xl bg-slate-900/70 border border-slate-800 w-full sm:w-fit overflow-x-auto">
        {tabs.map(([v, label, icon]) => (
          <button
            key={v}
            type="button"
            onClick={() => setTab(v)}
            className={cn(
              'flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition',
              tab === v ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            )}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {tab === 'inbox' && (
        <CommentInbox
          initialEvents={initialEvents}
          rules={rules}
          posts={postSettings}
          pages={pages}
          canCreateRule={canEdit}
          onCreateRuleForPost={openPostRule}
        />
      )}

      {tab === 'posts' && (
        <PostsGrid
          pages={pages}
          postSettings={postSettings}
          rules={rules}
          canEdit={canEdit}
          onToggleBot={toggleBot}
          onAddRule={(post, channelId) => {
            // make sure the editor has a preview even for posts never toggled
            if (!postSettings.some((p) => p.facebook_post_id === post.id)) {
              setPostSettings((prev) => [
                ...prev,
                {
                  id: `local-${post.id}`,
                  facebook_post_id: post.id,
                  channel_id: channelId,
                  bot_enabled: true,
                  post_caption: post.message,
                  post_thumbnail_url: post.full_picture,
                  post_url: post.permalink_url,
                  post_created_at: post.created_time,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ]);
            }
            openPostRule(post.id, channelId);
          }}
          {...ruleHandlers}
        />
      )}

      {tab === 'global' && (
        <div className="space-y-6">
          <CommentSettingsForm settings={settings} canEdit={canEdit} onSave={saveSettings} />

          <section className="space-y-3 pt-4 border-t border-slate-800/80">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">قواعد مخصصة لكلمات معينة (اختياري)</h3>
                <p className="text-[11px] text-slate-400">
                  قواعد إضافية تتجاوز الذكاء الاصطناعي لو حابب تثبت رد معين على كلمات محددة.
                </p>
              </div>
              {canEdit && (
                <button type="button" className={btn.secondary} onClick={() => setEditor(emptyRule('global'))}>
                  <Plus className="w-4 h-4" /> إضافة قاعدة كلمات مخصصة
                </button>
              )}
            </div>
            <RuleList rules={globalRules} pages={pages} canEdit={canEdit} emptyText="لا توجد قواعد مخصصة (الذكاء الاصطناعي يتولى جميع الردود)" {...ruleHandlers} />
          </section>

          <RuleTester rules={rules} settings={settings} posts={postSettings.filter((p) => !p.id.startsWith('local-'))} />
        </div>
      )}

      <RuleEditorModal
        open={!!editor}
        draft={editor}
        pages={pages}
        postPreview={editorPost ? { caption: editorPost.post_caption, thumbnail: editorPost.post_thumbnail_url } : null}
        onClose={() => setEditor(null)}
        onSave={saveRule}
      />

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}
