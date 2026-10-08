import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  evaluateCommentRule,
  matchesKeywords,
  normalizeArabicText,
  pickRandomReply,
  type PostRule,
  type GlobalCommentRule,
} from '../lib/rules-matcher.ts';

describe('Rules Matcher Engine Tests', () => {
  describe('Arabic Normalization & Keyword Matching', () => {
    it('normalizes Arabic diacritics (tashkeel) and whitespace', () => {
      const input = '  سِعْرُ   الْوَجْبَةِ  ';
      const normalized = normalizeArabicText(input);
      assert.strictEqual(normalized, 'سعر الوجبة');
    });

    it('normalizes Arabic and Latin punctuation marks', () => {
      const input = 'بكام؟ السعر! منيو، عرض: هل متاح؟';
      const normalized = normalizeArabicText(input);
      assert.ok(normalized.includes('بكام'));
      assert.ok(normalized.includes('السعر'));
      assert.ok(normalized.includes('منيو'));
      assert.ok(normalized.includes('عرض'));
      assert.ok(!normalized.includes('؟'));
      assert.ok(!normalized.includes('!'));
    });

    it('matches Arabic keywords like بكام, سعر, منيو, عرض with punctuation and whitespace', () => {
      const keywords = ['بكام', 'سعر', 'منيو', 'عرض'];

      // With question mark
      const res1 = matchesKeywords('بكام؟', keywords);
      assert.strictEqual(res1.isMatch, true);
      assert.strictEqual(res1.matchedKeyword, 'بكام');

      // With exclamation mark and prefix
      const res2 = matchesKeywords('السعر!', keywords);
      assert.strictEqual(res2.isMatch, true);

      // Embedded in sentence with whitespace
      const res3 = matchesKeywords('  ممكن   منيو   المطعم لو سمحت  ', keywords);
      assert.strictEqual(res3.isMatch, true);

      // Multiple words with 'عرض'
      const res4 = matchesKeywords('إيه أقوى عرض النهاردة؟', keywords);
      assert.strictEqual(res4.isMatch, true);
    });

    it('returns false when no keywords match the comment text', () => {
      const keywords = ['بكام', 'سعر', 'منيو', 'عرض'];
      const comments = [
        'صباح الخير يا فندم',
        'عاش يا شباب أكلكم ممتاز',
        'شكرا على التوصيل السريع',
        'العنوان فين بالتفصيل',
      ];

      for (const comment of comments) {
        const result = matchesKeywords(comment, keywords);
        assert.strictEqual(result.isMatch, false, `Expected no match for: "${comment}"`);
      }
    });

    it('returns false for empty comments or empty keywords list', () => {
      assert.strictEqual(matchesKeywords('', ['سعر']).isMatch, false);
      assert.strictEqual(matchesKeywords('   ', ['سعر']).isMatch, false);
      assert.strictEqual(matchesKeywords('سعر الوجبة', []).isMatch, false);
    });
  });

  describe('Post Rule match_type Evaluation', () => {
    it("matches any non-empty comment text when match_type === 'any'", () => {
      const postRule: PostRule = {
        id: 'rule-any-1',
        title: 'Any Comment Rule',
        match_type: 'any',
        is_active: true,
        comment_replies: ['أهلاً بحضرتك يا فندم ❤️'],
      };

      const validComments = [
        'تسلم ايديكم',
        'ممكن المنيو',
        '❤️',
        'رقم التليفون كام؟',
        'hello there',
      ];

      for (const comment of validComments) {
        const result = evaluateCommentRule(comment, postRule);
        assert.strictEqual(result.matched, true);
        assert.strictEqual(result.ruleType, 'post_rule');
        assert.strictEqual(result.selectedReply, 'أهلاً بحضرتك يا فندم ❤️');
      }

      // Empty comments should NOT match even with 'any'
      const emptyResult = evaluateCommentRule('', postRule);
      assert.strictEqual(emptyResult.matched, false);

      const whitespaceResult = evaluateCommentRule('   \n  ', postRule);
      assert.strictEqual(whitespaceResult.matched, false);
    });

    it("evaluates keywords strictly when match_type === 'keywords'", () => {
      const postRule: PostRule = {
        id: 'rule-kw-1',
        title: 'Keyword Specific Rule',
        match_type: 'keywords',
        trigger_keywords: ['بكام', 'سعر', 'منيو', 'عرض'],
        is_active: true,
        comment_replies: ['السعر موضح لحضرتك في الخاص 📩'],
      };

      // Matched comments
      assert.strictEqual(evaluateCommentRule('بكام الساندوتش؟', postRule).matched, true);
      assert.strictEqual(evaluateCommentRule('عايز اشوف منيو اليوم', postRule).matched, true);
      assert.strictEqual(evaluateCommentRule('في عرض جديد؟', postRule).matched, true);

      // Unmatched comments
      assert.strictEqual(evaluateCommentRule('الأكل كان جميل جداً', postRule).matched, false);
      assert.strictEqual(evaluateCommentRule('مواعيد العمل إيه؟', postRule).matched, false);
    });

    it('ignores inactive post rules', () => {
      const inactiveRule: PostRule = {
        id: 'rule-inactive',
        title: 'Inactive Rule',
        match_type: 'any',
        is_active: false,
        comment_replies: ['رد'],
      };

      const result = evaluateCommentRule('أي تعليق', inactiveRule);
      assert.strictEqual(result.matched, false);
    });
  });

  describe('Randomized Anti-Spam Reply Selection', () => {
    it('returns a reply from comment_replies', () => {
      const replies = [
        'شرفتنا يا فندم! بعتنالك التفاصيل في رسايل الصفحة 📩❤️',
        'أهلاً بك! تم الرد على حضرتك في الخاص بكل التفاصيل 🌟',
        'منورنا دائماً! شيك على رسايلك الخاصة بعتنالك كل التفاصيل 💬✨',
      ];

      const reply = pickRandomReply(replies);
      assert.ok(replies.includes(reply));
    });

    it('returns variations over multiple calls (anti-spam verification)', () => {
      const replies = [
        'رد رقم 1: تم الرد في الخاص 📩',
        'رد رقم 2: بعتنالك المنيو في الرسائل 🍔',
        'رد رقم 3: شرفتنا يا فندم تابع رسايلك 🌟',
        'رد رقم 4: كل التفاصيل عندك في الشات 💬',
      ];

      const selectedSet = new Set<string>();
      // Execute 40 iterations to ensure stochastic variation
      for (let i = 0; i < 40; i++) {
        selectedSet.add(pickRandomReply(replies));
      }

      // With 4 distinct replies and 40 iterations, we must observe at least 3 distinct variations
      assert.ok(
        selectedSet.size >= 3,
        `Expected at least 3 variations to prevent spam detection, but received ${selectedSet.size}`
      );
    });

    it('returns default fallback when replies list is empty or null', () => {
      const replyFromEmpty = pickRandomReply([]);
      assert.strictEqual(typeof replyFromEmpty, 'string');
      assert.ok(replyFromEmpty.length > 0);

      const replyFromNull = pickRandomReply(null);
      assert.strictEqual(typeof replyFromNull, 'string');
      assert.ok(replyFromNull.length > 0);
    });
  });

  describe('Global Comment Rule Fallback Mechanism', () => {
    const globalRule: GlobalCommentRule = {
      id: 'global-singleton',
      is_enabled: true,
      auto_like_comment: true,
      send_dm: true,
      comment_replies: [
        'شرفتنا يا فندم! بعتنالك التفاصيل في رسايل الصفحة 📩❤️',
        'أهلاً بك! تم الرد على حضرتك في الخاص 🌟',
      ],
      dm_message: 'أهلاً بحضرتك في مطعم الخديوي!',
    };

    it('falls back to global comment rule when post rule keywords do not match', () => {
      const postRule: PostRule = {
        id: 'post-rule-burger',
        match_type: 'keywords',
        trigger_keywords: ['برجر', 'كومبو'],
        comment_replies: ['تفاصيل البرجر في الخاص 🍔'],
        is_active: true,
      };

      // Unmatched for post rule keywords -> Falls back to global rule
      const comment = 'العنوان فين في الزقازيق؟';
      const result = evaluateCommentRule(comment, postRule, globalRule);

      assert.strictEqual(result.matched, true);
      assert.strictEqual(result.ruleType, 'global_rule');
      assert.ok(globalRule.comment_replies?.includes(result.selectedReply!));
    });

    it('uses post rule when keywords match, without invoking global rule', () => {
      const postRule: PostRule = {
        id: 'post-rule-burger',
        match_type: 'keywords',
        trigger_keywords: ['برجر', 'كومبو'],
        comment_replies: ['تفاصيل البرجر في الخاص 🍔'],
        is_active: true,
      };

      const comment = 'عايز اطلب برجر كومبو';
      const result = evaluateCommentRule(comment, postRule, globalRule);

      assert.strictEqual(result.matched, true);
      assert.strictEqual(result.ruleType, 'post_rule');
      assert.strictEqual(result.selectedReply, 'تفاصيل البرجر في الخاص 🍔');
    });

    it('falls back to global rule when no post rule exists', () => {
      const comment = 'السلام عليكم';
      const result = evaluateCommentRule(comment, null, globalRule);

      assert.strictEqual(result.matched, true);
      assert.strictEqual(result.ruleType, 'global_rule');
      assert.ok(globalRule.comment_replies?.includes(result.selectedReply!));
    });

    it('does not match anything when post rule fails and global rule is disabled', () => {
      const disabledGlobalRule: GlobalCommentRule = {
        ...globalRule,
        is_enabled: false,
      };

      const postRule: PostRule = {
        id: 'post-rule-1',
        match_type: 'keywords',
        trigger_keywords: ['عرض'],
        is_active: true,
      };

      const result = evaluateCommentRule('مساء الخير', postRule, disabledGlobalRule);
      assert.strictEqual(result.matched, false);
      assert.strictEqual(result.ruleType, 'none');
    });
  });
});
