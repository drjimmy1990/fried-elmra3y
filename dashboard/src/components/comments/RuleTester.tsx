'use client';

import React, { useMemo, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { inputClass } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { IGNORE_REASON_LABELS, MATCH_LEVEL_LABELS, pickRandomReply, resolveComment } from '@/lib/rules-matcher';
import { ruleActionBadges, type CommentRule, type CommentSettings, type PostSetting } from './types';

interface Props {
  rules: CommentRule[];
  settings: CommentSettings;
  posts: PostSetting[];
}

/** Type a comment and see which rule the bot would use (same engine as the workflow). */
export function RuleTester({ rules, settings, posts }: Props) {
  const [text, setText] = useState('');
  const [postId, setPostId] = useState('');
  const [nested, setNested] = useState(false);

  const result = useMemo(() => {
    if (!text.trim()) return null;
    const post = posts.find((p) => p.facebook_post_id === postId);
    return resolveComment(
      { text, postId: postId || null, isNestedReply: nested, postBotEnabled: post ? post.bot_enabled : true },
      rules,
      settings
    );
  }, [text, postId, nested, rules, settings, posts]);

  const sampleReply = useMemo(
    () => (result?.decision === 'rule' && result.rule.reply_enabled ? pickRandomReply(result.rule.reply_variations, '') : null),
    [result]
  );

  return (
    <section className="p-5 rounded-3xl bg-white dark:bg-slate-900/60 border border-purple-500/20 space-y-4 shadow-xs">
      <header className="flex items-center gap-2">
        <FlaskConical className="w-5 h-5 text-purple-500 dark:text-purple-400" />
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">جرّب تعليق</h3>
          <p className="text-[11px] text-slate-600 dark:text-slate-400">اكتب تعليق وشوف البوت هيعمل إيه — بنفس ترتيب القواعد الحقيقي.</p>
        </div>
      </header>

      <div className="grid md:grid-cols-3 gap-3">
        <input
          className={cn(inputClass, 'md:col-span-2')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="مثال: الوجبة العائلي بكام؟"
        />
        <select className={inputClass} value={postId} onChange={(e) => setPostId(e.target.value)}>
          <option value="">منشور بدون قواعد خاصة</option>
          {posts.map((p) => (
            <option key={p.facebook_post_id} value={p.facebook_post_id}>
              {(p.post_caption || p.facebook_post_id).slice(0, 50)}
            </option>
          ))}
        </select>
      </div>
      <label className="inline-flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
        <input type="checkbox" className="accent-purple-500" checked={nested} onChange={(e) => setNested(e.target.checked)} />
        التعليق رد على تعليق تاني
      </label>

      {result && (
        <div
          className={cn(
            'p-4 rounded-2xl border text-xs space-y-1.5',
            result.decision === 'rule' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100',
            result.decision === 'complaint' && 'bg-rose-500/10 border-rose-500/30 text-rose-100',
            result.decision === 'ignored' && 'bg-slate-800/60 border-slate-700 text-slate-300'
          )}
        >
          {result.decision === 'rule' && (
            <>
              <p className="font-bold">
                ✅ هيشتغل: {result.rule.name} <span className="font-normal opacity-80">({MATCH_LEVEL_LABELS[result.level]})</span>
              </p>
              {result.matchedKeyword && <p>الكلمة اللي اتلقطت: «{result.matchedKeyword}»</p>}
              <p>الإجراءات: {ruleActionBadges(result.rule).join(' · ')}</p>
              {sampleReply && <p className="opacity-90">مثال للرد العلني: {sampleReply}</p>}
            </>
          )}
          {result.decision === 'complaint' && (
            <>
              <p className="font-bold">🚨 هيتعامل معاه كشكوى</p>
              <p>الكلمة الحساسة: «{result.matchedKeyword}»</p>
            </>
          )}
          {result.decision === 'ignored' && <p className="font-bold">⏭️ هيتجاهله: {IGNORE_REASON_LABELS[result.reason]}</p>}
        </div>
      )}
    </section>
  );
}
