'use client';

import React, { useState } from 'react';
import {
  Sliders,
  Facebook,
  MessageCircle,
  Sparkles,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import { PostRuleRow, GlobalCommentRuleRow } from './types';
import { PostRulesManager } from './PostRulesManager';
import { GlobalCommentRuleForm } from './GlobalCommentRuleForm';

interface PostRulesContainerProps {
  initialRules: PostRuleRow[];
  initialGlobalRule: GlobalCommentRuleRow | null;
}

export function PostRulesContainer({
  initialRules,
  initialGlobalRule,
}: PostRulesContainerProps) {
  const [activeTab, setActiveTab] = useState<'posts' | 'global'>('posts');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              قواعد ردود البوستات ومسنجر
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            إدارة الردود التلقائية الذكية على تعليقات فيسبوك وإرسال المنيو والعروض في رسائل المسنجر الفورية
          </p>
        </div>

        {/* Brand / Status Badge */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            نظام الردود الفورية قيد التشغيل
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 w-full sm:w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('posts')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'posts'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Facebook className="w-4 h-4 fill-current" />
          <span>قواعد المنشورات المحددة (Post Rules)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
              activeTab === 'posts'
                ? 'bg-slate-950/20 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300 border border-slate-700'
            }`}
          >
            {initialRules.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('global')}
          className={`flex-1 sm:flex-initial flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'global'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>الرد الاحتياطي العام للتعليقات (Global Fallback)</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              activeTab === 'global'
                ? 'bg-slate-950/20 text-slate-950'
                : initialGlobalRule?.is_enabled
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {initialGlobalRule?.is_enabled ?? true ? 'نشط' : 'معطل'}
          </span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'posts' ? (
          <PostRulesManager initialRules={initialRules} />
        ) : (
          <GlobalCommentRuleForm initialRule={initialGlobalRule} />
        )}
      </div>
    </div>
  );
}
