'use client';

import React, { useState } from 'react';
import { BookOpen, ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: 'اعمل تطبيق في Meta for Developers',
    body: (
      <>
        ادخل{' '}
        <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-amber-300 underline">
          developers.facebook.com/apps
        </a>{' '}
        ← Create App ← اختار نوع <b>Business</b> (أو Use case: “Engage with customers on Messenger” + “Manage everything on your Page”).
      </>
    ),
  },
  {
    title: 'انسخ App ID و App Secret وضيف التطبيق هنا',
    body: (
      <>
        من <b>App settings ← Basic</b>: انسخ App ID، واضغط Show جنب App Secret وانسخه. بعدين اضغط “إضافة تطبيق ميتا” في الصفحة دي.
        <br />
        في نفس الصفحة حط <b>Privacy Policy URL</b> (مطلوب عشان تنشر التطبيق Live بعدين).
      </>
    ),
  },
  {
    title: 'فعّل تسجيل الدخول بفيسبوك وحط رابط الرجوع',
    body: (
      <>
        أضف منتج <b>Facebook Login</b> (أو Facebook Login for Business) ← Settings ← في خانة <b>Valid OAuth Redirect URIs</b> الصق “رابط
        الرجوع” اللي ظاهر في كارت التطبيق تحت. لو المنتج اسمه “for Business”: اعمل Configuration (User access token + Pages + الصلاحيات)
        وحط رقمها في إعدادات التطبيق هنا.
      </>
    ),
  },
  {
    title: 'اربط الويب هوك بـ n8n',
    body: (
      <>
        أضف منتج <b>Messenger</b> و <b>Webhooks</b>. في Webhooks اختار <b>Page</b> ← Subscribe ← الصق <b>Callback URL</b> (رابط n8n
        من فوق) و <b>Verify Token</b> (من كارت التطبيق) ← Verify and save. بعدها فعّل الحقول: <code dir="ltr">feed</code>،{' '}
        <code dir="ltr">messages</code>، <code dir="ltr">messaging_postbacks</code>، <code dir="ltr">message_echoes</code>.
        <br />
        <span className="text-slate-500">(التحقق بيشتغل لما يكون workflow الراوتر في n8n شغال — ممكن تأجل الخطوة دي.)</span>
      </>
    ),
  },
  {
    title: 'اضغط “ربط صفحات عبر فيسبوك”',
    body: <>وافق على كل الصلاحيات واختار الصفحات. هنحفظ رمز دائم لكل صفحة ونشترك لها في الويب هوك تلقائياً. اضغط “اختبار” للتأكد.</>,
  },
  {
    title: 'وضع التطوير مقابل Live',
    body: (
      <>
        وهو في <b>Development</b>: البوت بيرد بس على الناس اللي ليهم دور في التطبيق (Admin / Developer / Tester) — مناسب للتجربة. عشان يرد
        على كل العملاء: اعمل <b>Business Verification</b> واطلب <b>Advanced Access</b> في App Review للصلاحيات:
        pages_messaging، pages_manage_metadata، pages_read_engagement، pages_manage_engagement، pages_read_user_content، وبعدين حوّل التطبيق
        لـ <b>Live</b>.
      </>
    ),
  },
];

export function SetupGuide() {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-xs">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-5 text-right hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-3xl transition"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-300 flex items-center justify-center">
            <BookOpen className="w-5 h-5" />
          </span>
          <span>
            <span className="block text-sm font-bold text-slate-900 dark:text-white">دليل الربط خطوة بخطوة</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">أول مرة؟ افتح الدليل — 6 خطوات</span>
          </span>
        </span>
        <ChevronDown className={cn('w-5 h-5 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ol className="px-5 pb-5 space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800">
              <span className="w-7 h-7 shrink-0 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-xs font-black flex items-center justify-center">
                {i + 1}
              </span>
              <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{s.title}</p>
                {s.body}
              </div>
            </li>
          ))}
          <li className="text-[11px] text-slate-500 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> كل صفحة ممكن تكون على تطبيق مختلف — ضيف كل التطبيقات واربط كل صفحة من التطبيق بتاعها.
          </li>
        </ol>
      )}
    </section>
  );
}
