'use client';

import React, { useMemo } from 'react';
import { parseMarkdown, type InlineSegment } from './markdown';
import { cn } from '@/lib/utils';

function Inline({ segments }: { segments: InlineSegment[] }) {
  return (
    <>
      {segments.map((s, i) =>
        s.bold ? (
          <strong key={i} className="font-bold text-amber-200">
            {s.text}
          </strong>
        ) : (
          <React.Fragment key={i}>{s.text}</React.Fragment>
        )
      )}
    </>
  );
}

/** Safe Markdown preview built from React elements only (never dangerouslySetInnerHTML). */
export function MarkdownPreview({ source, className }: { source: string; className?: string }) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);

  if (!blocks.length) {
    return <p className="text-sm text-slate-500 italic">مفيش محتوى لسه… اكتب قائمة الأسعار وهتظهر هنا.</p>;
  }

  return (
    <div dir="auto" className={cn('space-y-3 text-sm leading-relaxed text-slate-200', className)}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading':
            if (b.level === 1)
              return (
                <h3 key={i} className="text-xl font-black text-white pt-1">
                  <Inline segments={b.content} />
                </h3>
              );
            if (b.level === 2)
              return (
                <h4 key={i} className="text-base font-bold text-amber-300 pt-1 border-b border-slate-800 pb-1">
                  <Inline segments={b.content} />
                </h4>
              );
            return (
              <h5 key={i} className="text-sm font-bold text-slate-100">
                <Inline segments={b.content} />
              </h5>
            );
          case 'hr':
            return <hr key={i} className="border-slate-700" />;
          case 'ul':
            return (
              <ul key={i} className="list-disc ps-5 space-y-1 marker:text-amber-500">
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inline segments={item} />
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} start={b.start} className="list-decimal ps-5 space-y-1 marker:text-amber-500">
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inline segments={item} />
                  </li>
                ))}
              </ol>
            );
          case 'paragraph':
            return (
              <p key={i}>
                {b.lines.map((line, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <br />}
                    <Inline segments={line} />
                  </React.Fragment>
                ))}
              </p>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
