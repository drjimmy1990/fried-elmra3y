/**
 * Comment rule engine (pure, no I/O, safe on client and server).
 *
 * This is the reference implementation of how the bot decides what to do with a
 * Facebook comment. The dashboard uses it for the live "rule tester"; the n8n
 * comments workflow must follow the same order:
 *
 *   1. Pre-checks      bot off / page's own comment / post bot off / nested reply / mentions-only
 *   2. Complaint words  comment_settings.sensitive_keywords  -> complaint flow
 *   3. Post rules       keywords (by priority)  ->  "any"
 *   4. Global rules     keywords (by priority)  ->  "any" (fallback)
 *   5. Nothing matched  -> ignored (no_rule)
 *
 * After a rule matches, the DM is skipped when the same commenter already got a DM
 * within `dm_cooldown_hours` (see isInDmCooldown); like / public reply still run.
 */

export type RuleMatchType = 'any' | 'keywords';
export type RuleScope = 'post' | 'global';

/** Minimal rule shape needed for matching (a `comment_rules` row satisfies it). */
export interface MatchableRule {
  id: string;
  name?: string;
  scope: RuleScope;
  facebook_post_id: string | null;
  channel_id?: string | null;
  trigger_type: RuleMatchType;
  keywords: string[];
  priority: number;
  is_active: boolean;
}

export interface CommentContext {
  text: string;
  postId: string | null;
  /** channels.id of the page that received the comment (rules with another channel_id are skipped). */
  channelId?: string | null;
  /** Comment is a reply to another comment (parent_comment_id set). */
  isNestedReply?: boolean;
  /** Comment was written by the page itself. */
  isFromPage?: boolean;
  /** Comment text consists only of tagged people (computed from message_tags by the workflow). */
  isMentionsOnly?: boolean;
  /** bot_settings.bot_enabled (default true). */
  botEnabled?: boolean;
  /** post_settings.bot_enabled for this post (default true when no row). */
  postBotEnabled?: boolean;
}

export interface ResolveSettings {
  sensitive_keywords: string[];
  ignore_nested_replies: boolean;
  ignore_mentions_only: boolean;
}

export type IgnoreReason = 'bot_off' | 'page_own_comment' | 'post_off' | 'nested_reply' | 'mentions_only' | 'no_rule';
export type MatchLevel = 'post_keywords' | 'post_any' | 'global_keywords' | 'global_any';

export type Resolution<R extends MatchableRule = MatchableRule> =
  | { decision: 'ignored'; reason: IgnoreReason }
  | { decision: 'complaint'; matchedKeyword: string }
  | { decision: 'rule'; rule: R; level: MatchLevel; matchedKeyword?: string };

// ---------------------------------------------------------------------------
// Text normalization & keyword matching
// ---------------------------------------------------------------------------

/**
 * Normalizes Arabic/Latin text for matching:
 * lowercase, strip tashkeel + tatweel, unify alef/yaa/taa-marbuta/hamza forms,
 * collapse repeated letters ("بكاااام" -> "بكام"), punctuation -> spaces.
 * Applied to both the comment and the keywords, so matching stays symmetric.
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // tashkeel + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/(\p{L})\1+/gu, '$1') // elongation
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // punctuation, emoji, symbols
    .replace(/\s+/g, ' ')
    .trim();
}

/** Arabic clitics allowed before a keyword: "المنيو", "والسعر", "بالعرض", "للعروض"... */
const PREFIXES = ['وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'و', 'ب', 'ف', 'ل', 'ك'];
/** Common suffixes allowed after a keyword: "سعره", "سعرها", "عرضكم", "وحشه"... */
const SUFFIXES = ['هم', 'ها', 'كم', 'نا', 'ه', 'ك', 'ي', 'ات'];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whole-word keyword match (multi-word keywords supported) tolerant to Arabic
 * prefixes/suffixes. A short keyword never matches inside an unrelated word
 * (e.g. "ني" does not match "تاني").
 */
export function matchesKeywords(commentText: string, keywords: string[]): { isMatch: boolean; matchedKeyword?: string } {
  const comment = normalizeArabicText(commentText);
  if (!comment || !keywords?.length) return { isMatch: false };

  for (const raw of keywords) {
    const kw = normalizeArabicText(raw ?? '');
    if (!kw) continue;
    const pattern = new RegExp(
      `(?:^|\\s)(?:${PREFIXES.join('|')})?${escapeRegex(kw)}(?:${SUFFIXES.join('|')})?(?=\\s|$)`,
      'u'
    );
    if (pattern.test(comment)) return { isMatch: true, matchedKeyword: raw };
  }
  return { isMatch: false };
}

/** True when the text has at least one letter or digit (not only emoji / punctuation). */
export function hasMeaningfulText(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text ?? '');
}

/** Picks a random reply (anti-spam variation). Returns `fallback` when the list is empty. */
export function pickRandomReply(replies?: string[] | null, fallback = 'تم الرد في الخاص يا فندم ❤️'): string {
  const list = (replies ?? []).map((r) => r?.trim()).filter(Boolean) as string[];
  if (list.length === 0) return fallback;
  return list[Math.floor(Math.random() * list.length)];
}

/** Random human-like delay in seconds within [min, max]. */
export function pickReplyDelaySec(min: number, max: number): number {
  const lo = Math.max(0, Math.min(min, max));
  const hi = Math.max(lo, max);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

/** True when the commenter already received a DM less than `cooldownHours` ago. */
export function isInDmCooldown(lastDmAt: string | Date | null | undefined, cooldownHours: number, now: Date = new Date()): boolean {
  if (!lastDmAt || cooldownHours <= 0) return false;
  const last = lastDmAt instanceof Date ? lastDmAt : new Date(lastDmAt);
  if (Number.isNaN(last.getTime())) return false;
  return now.getTime() - last.getTime() < cooldownHours * 3600 * 1000;
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

const byPriority = <R extends MatchableRule>(a: R, b: R) =>
  a.priority - b.priority || (a.name ?? '').localeCompare(b.name ?? '') || a.id.localeCompare(b.id);

/** Decides what the bot does with a comment. See the file header for the order. */
export function resolveComment<R extends MatchableRule>(
  ctx: CommentContext,
  rules: R[],
  settings: ResolveSettings
): Resolution<R> {
  const text = ctx.text ?? '';

  // 1. Pre-checks
  if (ctx.botEnabled === false) return { decision: 'ignored', reason: 'bot_off' };
  if (ctx.isFromPage) return { decision: 'ignored', reason: 'page_own_comment' };
  if (ctx.postBotEnabled === false) return { decision: 'ignored', reason: 'post_off' };
  if (ctx.isNestedReply && settings.ignore_nested_replies) return { decision: 'ignored', reason: 'nested_reply' };
  if (settings.ignore_mentions_only && (ctx.isMentionsOnly || !hasMeaningfulText(text))) {
    return { decision: 'ignored', reason: 'mentions_only' };
  }

  // 2. Complaint / sensitive words win over every rule
  const sensitive = matchesKeywords(text, settings.sensitive_keywords ?? []);
  if (sensitive.isMatch) return { decision: 'complaint', matchedKeyword: sensitive.matchedKeyword! };

  // 3 + 4. Rules
  const usable = rules
    .filter((r) => r.is_active)
    .filter((r) => !r.channel_id || !ctx.channelId || r.channel_id === ctx.channelId)
    .sort(byPriority);

  const postRules = ctx.postId ? usable.filter((r) => r.scope === 'post' && r.facebook_post_id === ctx.postId) : [];
  const globalRules = usable.filter((r) => r.scope === 'global');

  const levels: Array<[MatchLevel, R[], RuleMatchType]> = [
    ['post_keywords', postRules, 'keywords'],
    ['post_any', postRules, 'any'],
    ['global_keywords', globalRules, 'keywords'],
    ['global_any', globalRules, 'any'],
  ];

  for (const [level, list, type] of levels) {
    for (const rule of list) {
      if (rule.trigger_type !== type) continue;
      if (type === 'any') return { decision: 'rule', rule, level };
      const m = matchesKeywords(text, rule.keywords);
      if (m.isMatch) return { decision: 'rule', rule, level, matchedKeyword: m.matchedKeyword };
    }
  }

  return { decision: 'ignored', reason: 'no_rule' };
}

/** Arabic labels for the UI. */
export const IGNORE_REASON_LABELS: Record<IgnoreReason | 'cooldown', string> = {
  bot_off: 'البوت متوقف بالكامل',
  page_own_comment: 'تعليق من الصفحة نفسها',
  post_off: 'البوت متوقف على هذا المنشور',
  nested_reply: 'رد على تعليق آخر',
  mentions_only: 'منشن أو إيموجي فقط',
  no_rule: 'لا توجد قاعدة مطابقة',
  cooldown: 'العميل استلم رسالة خاصة مؤخراً',
};

export const MATCH_LEVEL_LABELS: Record<MatchLevel, string> = {
  post_keywords: 'قاعدة المنشور (كلمات)',
  post_any: 'قاعدة المنشور (أي تعليق)',
  global_keywords: 'قاعدة عامة (كلمات)',
  global_any: 'الرد العام الاحتياطي',
};
