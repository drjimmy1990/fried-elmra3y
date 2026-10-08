export type RuleMatchType = 'any' | 'keywords';

export interface PostRule {
  id?: string;
  title?: string;
  facebook_post_id?: string;
  match_type: RuleMatchType;
  trigger_keywords?: string[];
  comment_replies?: string[];
  auto_like_comment?: boolean;
  dm_message?: string;
  dm_image_url?: string | null;
  dm_buttons?: any;
  is_active?: boolean;
}

export interface GlobalCommentRule {
  id?: string;
  is_enabled: boolean;
  auto_like_comment?: boolean;
  comment_replies?: string[];
  send_dm?: boolean;
  dm_message?: string;
  dm_image_url?: string | null;
  dm_buttons?: any;
}

export interface MatchEvaluationResult {
  matched: boolean;
  ruleType: 'post_rule' | 'global_rule' | 'none';
  selectedReply?: string;
  matchedKeyword?: string;
  rule?: PostRule | GlobalCommentRule;
}

/**
 * Normalizes Arabic text by removing tashkeel diacritics,
 * stripping common punctuation (both Arabic and Latin), and collapsing extra whitespace.
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    // Remove Arabic diacritics (tashkeel: fatha, damma, kasra, sukun, shadda, tanween)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Replace punctuation marks (Arabic & Latin) with spaces
    .replace(/[؟!?.,;:،؛"'()[\]{}«»ـ\-_/\\|*&#^%$#@~`+=]/g, ' ')
    // Collapse consecutive whitespaces into a single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether comment text matches the given trigger keywords.
 * Supports punctuation resilience, substring/stem presence, and whitespace normalization.
 */
export function matchesKeywords(commentText: string, keywords: string[]): { isMatch: boolean; matchedKeyword?: string } {
  if (!commentText || !commentText.trim() || !keywords || keywords.length === 0) {
    return { isMatch: false };
  }

  const normalizedComment = normalizeArabicText(commentText);
  if (!normalizedComment) {
    return { isMatch: false };
  }

  for (const rawKw of keywords) {
    if (!rawKw || !rawKw.trim()) continue;
    const normalizedKw = normalizeArabicText(rawKw);
    if (!normalizedKw) continue;

    // 1. Direct normalized substring check
    if (normalizedComment.includes(normalizedKw)) {
      return { isMatch: true, matchedKeyword: rawKw };
    }

    // 2. Token-level check (e.g. comment has prefixes/suffixes)
    const tokens = normalizedComment.split(' ');
    for (const token of tokens) {
      if (token === normalizedKw || token.includes(normalizedKw) || normalizedKw.includes(token)) {
        return { isMatch: true, matchedKeyword: rawKw };
      }
    }
  }

  return { isMatch: false };
}

/**
 * Selects a random reply from the provided reply list.
 * Fallbacks to a polite default reply if none provided.
 */
export function pickRandomReply(
  replies?: string[] | null,
  defaultReply = 'تم الرد في الخاص يا فندم ❤️'
): string {
  if (!replies || replies.length === 0) {
    return defaultReply;
  }
  const index = Math.floor(Math.random() * replies.length);
  return replies[index] || defaultReply;
}

/**
 * Evaluates an incoming comment against a specific post rule with automatic
 * fallback to global comment rules.
 */
export function evaluateCommentRule(
  commentText: string,
  postRule?: PostRule | null,
  globalRule?: GlobalCommentRule | null
): MatchEvaluationResult {
  const trimmed = (commentText || '').trim();

  // 1. Check specific post rule (if present and active)
  if (postRule && postRule.is_active !== false) {
    if (postRule.match_type === 'any') {
      if (trimmed.length > 0) {
        return {
          matched: true,
          ruleType: 'post_rule',
          selectedReply: pickRandomReply(postRule.comment_replies),
          rule: postRule,
        };
      }
    } else if (postRule.match_type === 'keywords') {
      const { isMatch, matchedKeyword } = matchesKeywords(trimmed, postRule.trigger_keywords || []);
      if (isMatch) {
        return {
          matched: true,
          ruleType: 'post_rule',
          selectedReply: pickRandomReply(postRule.comment_replies),
          matchedKeyword,
          rule: postRule,
        };
      }
    }
  }

  // 2. Fallback to global comment rule (if enabled)
  if (globalRule && globalRule.is_enabled !== false) {
    if (trimmed.length > 0) {
      return {
        matched: true,
        ruleType: 'global_rule',
        selectedReply: pickRandomReply(globalRule.comment_replies),
        rule: globalRule,
      };
    }
  }

  // 3. No match found
  return {
    matched: false,
    ruleType: 'none',
  };
}
