/**
 * Tiny, dependency-free Markdown parser for the price-list preview.
 * Supports: # / ## / ### headings, **bold**, "-" / "*" bullet lists,
 * numbered lists ("1." or "1)"), horizontal rules (---) and line breaks.
 * Output is plain data — rendering is done with React elements (no innerHTML).
 */

export interface InlineSegment {
  text: string;
  bold: boolean;
}

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3; content: InlineSegment[] }
  | { type: 'paragraph'; lines: InlineSegment[][] }
  | { type: 'ul'; items: InlineSegment[][] }
  | { type: 'ol'; start: number; items: InlineSegment[][] }
  | { type: 'hr' };

const HEADING_RE = /^\s{0,3}(#{1,3})\s+(.*?)\s*#*\s*$/;
const HR_RE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const BULLET_RE = /^\s*[-*•]\s+(.*)$/;
const NUMBERED_RE = /^\s*(\d{1,4})[.)]\s+(.*)$/;

/** Splits a line into plain / bold segments using **double asterisks**. */
export function parseInline(line: string): InlineSegment[] {
  const segments: InlineSegment[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    if (match.index > last) segments.push({ text: line.slice(last, match.index), bold: false });
    segments.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < line.length) segments.push({ text: line.slice(last), bold: false });
  return segments.length ? segments : [{ text: '', bold: false }];
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');

  let paragraph: InlineSegment[][] | null = null;
  let list: { type: 'ul' | 'ol'; start: number; items: InlineSegment[][] } | null = null;

  const flushParagraph = () => {
    if (paragraph && paragraph.length) blocks.push({ type: 'paragraph', lines: paragraph });
    paragraph = null;
  };
  const flushList = () => {
    if (list) {
      blocks.push(
        list.type === 'ul'
          ? { type: 'ul', items: list.items }
          : { type: 'ol', start: list.start, items: list.items }
      );
    }
    list = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    if (HR_RE.test(line)) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'hr' });
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        content: parseInline(heading[2]),
      });
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      flushParagraph();
      if (!list || list.type !== 'ul') {
        flushList();
        list = { type: 'ul', start: 1, items: [] };
      }
      list.items.push(parseInline(bullet[1]));
      continue;
    }

    const numbered = NUMBERED_RE.exec(line);
    if (numbered) {
      flushParagraph();
      if (!list || list.type !== 'ol') {
        flushList();
        list = { type: 'ol', start: Number(numbered[1]) || 1, items: [] };
      }
      list.items.push(parseInline(numbered[2]));
      continue;
    }

    // Plain text line: continues the current paragraph (rendered with a line break).
    flushList();
    if (!paragraph) paragraph = [];
    paragraph.push(parseInline(line.trim()));
  }

  flushParagraph();
  flushList();
  return blocks;
}
