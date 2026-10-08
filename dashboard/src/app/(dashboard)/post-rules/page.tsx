import React from 'react';
import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { PostRulesContainer } from '@/components/post-rules/PostRulesContainer';
import { PostRuleRow, GlobalCommentRuleRow } from '@/components/post-rules/types';

export const metadata: Metadata = {
  title: 'قواعد ردود البوستات ومسنجر | مطعم الخديوي',
  description: 'إدارة الردود الآلية المخصصة لمنشورات فيسبوك ورسائل المسنجر الترحيبية في مطعم الخديوي',
};

export const revalidate = 0; // Dynamic server component

export default async function PostRulesPage() {
  const supabase = await createClient();

  // Fetch post rules and global fallback comment rule in parallel
  const [postRulesRes, globalRuleRes] = await Promise.all([
    supabase
      .from('post_rules')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('global_comment_rules')
      .select('*')
      .limit(1)
      .maybeSingle(),
  ]);

  if (postRulesRes.error) {
    console.error('Failed to fetch post rules:', postRulesRes.error);
  }

  if (globalRuleRes.error) {
    console.error('Failed to fetch global comment rule:', globalRuleRes.error);
  }

  const initialRules: PostRuleRow[] = postRulesRes.data || [];
  const initialGlobalRule: GlobalCommentRuleRow | null = globalRuleRes.data || null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <PostRulesContainer
        initialRules={initialRules}
        initialGlobalRule={initialGlobalRule}
      />
    </div>
  );
}
