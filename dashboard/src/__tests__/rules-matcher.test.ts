import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  hasMeaningfulText,
  isInDmCooldown,
  matchesKeywords,
  normalizeArabicText,
  pickRandomReply,
  pickReplyDelaySec,
  resolveComment,
  type MatchableRule,
  type ResolveSettings,
} from '../lib/rules-matcher.ts';

const settings: ResolveSettings = {
  sensitive_keywords: ['شكوى', 'وحش', 'بارد', 'اتأخر', 'ني'],
  ignore_nested_replies: true,
  ignore_mentions_only: true,
};

let seq = 0;
function rule(partial: Partial<MatchableRule>): MatchableRule {
  seq += 1;
  return {
    id: `r${seq}`,
    name: `rule ${seq}`,
    scope: 'global',
    facebook_post_id: null,
    channel_id: null,
    trigger_type: 'any',
    keywords: [],
    priority: 100,
    is_active: true,
    ...partial,
  };
}

const POST = '111_222';

describe('normalizeArabicText', () => {
  it('strips tashkeel, tatweel and collapses whitespace', () => {
    assert.strictEqual(normalizeArabicText('  سِعْرُ   الْوَجْبَـــةِ  '), 'سعر الوجبه');
  });

  it('unifies alef / yaa / taa marbuta forms and elongation', () => {
    assert.strictEqual(normalizeArabicText('الأسعار'), normalizeArabicText('الاسعار'));
    assert.strictEqual(normalizeArabicText('بكاااام'), normalizeArabicText('بكام'));
    assert.strictEqual(normalizeArabicText('مستوى'), normalizeArabicText('مستوي'));
  });

  it('turns punctuation and emoji into spaces', () => {
    assert.strictEqual(normalizeArabicText('بكام؟!🔥السعر'), 'بكام السعر');
  });
});

describe('matchesKeywords', () => {
  const kws = ['بكام', 'سعر', 'منيو', 'عرض'];

  it('matches with punctuation, prefixes and suffixes', () => {
    assert.strictEqual(matchesKeywords('بكام؟', kws).matchedKeyword, 'بكام');
    assert.ok(matchesKeywords('السعر!', kws).isMatch);
    assert.ok(matchesKeywords('ممكن المنيو لو سمحت', kws).isMatch);
    assert.ok(matchesKeywords('سعرها كام', kws).isMatch);
    assert.ok(matchesKeywords('والعرض ده لحد امتى', kws).isMatch);
  });

  it('does not match a short keyword inside an unrelated word', () => {
    assert.strictEqual(matchesKeywords('عايز وجبه تانيه', ['ني']).isMatch, false);
    assert.strictEqual(matchesKeywords('معرض الكتاب', ['عرض']).isMatch, false);
  });

  it('supports multi-word keywords', () => {
    assert.ok(matchesKeywords('الفراخ مش مستويه خالص', ['مش مستوي']).isMatch);
    assert.strictEqual(matchesKeywords('مستوي جدا', ['مش مستوي']).isMatch, false);
  });

  it('returns false when nothing matches or input is empty', () => {
    for (const c of ['صباح الخير', 'تسلم ايديكم', 'العنوان فين']) {
      assert.strictEqual(matchesKeywords(c, kws).isMatch, false, c);
    }
    assert.strictEqual(matchesKeywords('', kws).isMatch, false);
    assert.strictEqual(matchesKeywords('سعر', []).isMatch, false);
  });
});

describe('helpers', () => {
  it('hasMeaningfulText detects emoji-only comments', () => {
    assert.strictEqual(hasMeaningfulText('❤️🔥'), false);
    assert.strictEqual(hasMeaningfulText('تمام ❤️'), true);
  });

  it('pickRandomReply returns variations and a fallback', () => {
    const replies = ['a', 'b', 'c', 'd'];
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) seen.add(pickRandomReply(replies));
    assert.ok(seen.size >= 3);
    assert.ok(pickRandomReply([]).length > 0);
    assert.ok(pickRandomReply(['  ', '']).length > 0);
  });

  it('pickReplyDelaySec stays within range', () => {
    for (let i = 0; i < 50; i++) {
      const d = pickReplyDelaySec(5, 40);
      assert.ok(d >= 5 && d <= 40);
    }
    assert.strictEqual(pickReplyDelaySec(10, 10), 10);
  });

  it('isInDmCooldown respects the window', () => {
    const now = new Date('2026-10-08T12:00:00Z');
    assert.strictEqual(isInDmCooldown('2026-10-08T00:00:00Z', 24, now), true);
    assert.strictEqual(isInDmCooldown('2026-10-06T00:00:00Z', 24, now), false);
    assert.strictEqual(isInDmCooldown('2026-10-08T11:00:00Z', 0, now), false);
    assert.strictEqual(isInDmCooldown(null, 24, now), false);
  });
});

describe('resolveComment: pre-checks', () => {
  const rules = [rule({ trigger_type: 'any' })];

  it('ignores when the bot or the post is off', () => {
    assert.deepStrictEqual(resolveComment({ text: 'hi', postId: POST, botEnabled: false }, rules, settings), {
      decision: 'ignored',
      reason: 'bot_off',
    });
    assert.deepStrictEqual(resolveComment({ text: 'hi', postId: POST, postBotEnabled: false }, rules, settings), {
      decision: 'ignored',
      reason: 'post_off',
    });
  });

  it("ignores the page's own comments, nested replies and mentions-only", () => {
    assert.strictEqual(resolveComment({ text: 'hi', postId: POST, isFromPage: true }, rules, settings).decision, 'ignored');
    const nested = resolveComment({ text: 'hi', postId: POST, isNestedReply: true }, rules, settings);
    assert.deepStrictEqual(nested, { decision: 'ignored', reason: 'nested_reply' });
    const emoji = resolveComment({ text: '😍😍', postId: POST }, rules, settings);
    assert.deepStrictEqual(emoji, { decision: 'ignored', reason: 'mentions_only' });
  });

  it('processes nested replies / emoji when those settings are off', () => {
    const loose = { ...settings, ignore_nested_replies: false, ignore_mentions_only: false };
    assert.strictEqual(resolveComment({ text: '😍', postId: POST, isNestedReply: true }, rules, loose).decision, 'rule');
  });
});

describe('resolveComment: order', () => {
  const postKw = rule({ scope: 'post', facebook_post_id: POST, trigger_type: 'keywords', keywords: ['بكام'], priority: 10 });
  const postAny = rule({ scope: 'post', facebook_post_id: POST, trigger_type: 'any', priority: 50 });
  const globalKw = rule({ scope: 'global', trigger_type: 'keywords', keywords: ['منيو'], priority: 10 });
  const globalAny = rule({ scope: 'global', trigger_type: 'any', priority: 1000 });
  const all = [globalAny, globalKw, postAny, postKw];

  it('complaint words win over every rule', () => {
    const r = resolveComment({ text: 'الأكل كان بارد وبكام ده اصلا', postId: POST }, all, settings);
    assert.deepStrictEqual(r, { decision: 'complaint', matchedKeyword: 'بارد' });
  });

  it('post keyword rule first', () => {
    const r = resolveComment({ text: 'بكام الوجبة؟', postId: POST }, all, settings);
    assert.strictEqual(r.decision === 'rule' && r.rule.id, postKw.id);
    assert.strictEqual(r.decision === 'rule' && r.level, 'post_keywords');
  });

  it('post "any" beats global keywords on that post', () => {
    const r = resolveComment({ text: 'ممكن المنيو', postId: POST }, all, settings);
    assert.strictEqual(r.decision === 'rule' && r.level, 'post_any');
  });

  it('global keyword rule on other posts, then global fallback', () => {
    const kw = resolveComment({ text: 'ممكن المنيو', postId: 'other' }, all, settings);
    assert.strictEqual(kw.decision === 'rule' && kw.rule.id, globalKw.id);
    const any = resolveComment({ text: 'تسلم ايديكم', postId: 'other' }, all, settings);
    assert.strictEqual(any.decision === 'rule' && any.level, 'global_any');
  });

  it('returns no_rule when nothing applies', () => {
    const r = resolveComment({ text: 'تسلم ايديكم', postId: 'other' }, [globalKw], settings);
    assert.deepStrictEqual(r, { decision: 'ignored', reason: 'no_rule' });
  });

  it('skips inactive rules and respects priority within a level', () => {
    const a = rule({ trigger_type: 'keywords', keywords: ['عرض'], priority: 20 });
    const b = rule({ trigger_type: 'keywords', keywords: ['عرض'], priority: 5 });
    const off = rule({ trigger_type: 'keywords', keywords: ['عرض'], priority: 1, is_active: false });
    const r = resolveComment({ text: 'في عرض؟', postId: null }, [a, b, off], settings);
    assert.strictEqual(r.decision === 'rule' && r.rule.id, b.id);
  });

  it('skips rules bound to another page', () => {
    const otherPage = rule({ trigger_type: 'any', channel_id: 'page-B', priority: 1 });
    const anyPage = rule({ trigger_type: 'any', channel_id: null, priority: 2 });
    const r = resolveComment({ text: 'اهلا', postId: null, channelId: 'page-A' }, [otherPage, anyPage], settings);
    assert.strictEqual(r.decision === 'rule' && r.rule.id, anyPage.id);
  });
});
