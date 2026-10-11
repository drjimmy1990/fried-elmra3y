'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Drumstick,
  Lock,
  Mail,
  AlertCircle,
  ArrowLeft,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        throw signInError;
      }

      if (data.user) {
        // Query user role for smart initial redirection
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', data.user.id)
          .single();

        if (profile && profile.is_active === false) {
          await supabase.auth.signOut();
          setError('تم تعطيل هذا الحساب من قبل إدارة النظام. يرجى التواصل مع المدير.');
          setLoading(false);
          return;
        }

        const role = profile?.role || 'order_agent';
        if (role === 'order_agent') {
          router.push('/dashboard/orders');
        } else if (role === 'support_agent') {
          router.push('/dashboard/complaints');
        } else {
          router.push('/dashboard');
        }
        router.refresh();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'فشل تسجيل الدخول. يرجى التحقق من صحة البريد وكلمة المرور.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-slate-800/90 p-8 shadow-2xl shadow-black/80 relative overflow-hidden text-slate-100">
      {/* Top subtle golden ambient flare */}
      <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl" />

      {/* Brand Header */}
      <div className="text-center pb-6 relative z-10">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-red-600 to-amber-500 p-1 shadow-2xl shadow-red-500/30 ring-4 ring-amber-500/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-icon.svg"
            alt="تشيكن مراعي"
            className="h-full w-full rounded-2xl object-cover"
          />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-300 mb-2">
          <Sparkles className="h-3 w-3 text-amber-400" />
          <span>غرفة العمليات والرد الذكي</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          تشيكن مراعي
        </h1>
        <p className="mt-1 text-xs text-amber-400/90 font-medium leading-relaxed">
          ★ لأكيلة مراعي 🍗👑 ★
        </p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4 relative z-10">
        {urlError === 'account_deactivated' && !error && (
          <div className="flex items-center gap-3 rounded-2xl bg-rose-500/10 p-3.5 text-xs text-rose-300 border border-rose-500/25">
            <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
            <span>تم تعطيل هذا الحساب من قبل إدارة النظام. يرجى مراجعة المسؤول.</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 rounded-2xl bg-rose-500/10 p-3.5 text-xs text-rose-300 border border-rose-500/25">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Email Field */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-300">
            البريد الإلكتروني
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
              <Mail className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@khedewy.com"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pr-10 pl-3.5 py-3 text-sm text-slate-100 placeholder-slate-600 text-left focus:border-amber-500 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all font-mono"
            />
          </div>
        </div>

        {/* Password Field */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-300">
            كلمة المرور
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
              <Lock className="h-4 w-4 text-slate-500" />
            </div>
            <input
              type="password"
              required
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-800 bg-slate-950/70 pr-10 pl-3.5 py-3 text-sm text-slate-100 placeholder-slate-600 text-left focus:border-amber-500 focus:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all font-mono"
            />
          </div>
        </div>

        {/* Remember me */}
        <div className="flex items-center justify-between text-xs pt-1">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-400 hover:text-slate-300 transition">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500/20 accent-amber-500"
            />
            <span>تذكر بيانات الدخول</span>
          </label>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-300 hover:shadow-amber-500/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-60 transition-all active:scale-[0.99] cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
              <span>جاري التحقق والدخول...</span>
            </>
          ) : (
            <>
              <span>تسجيل الدخول للنظام</span>
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            </>
          )}
        </button>

        {/* Security badge footer */}
        <div className="flex items-center justify-center gap-1.5 pt-4 text-[11px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-400/70" />
          <span>نظام مشفر ومحمي بصلاحيات الموظفين (RBAC)</span>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      {/* Cinematic ambient background glow orbs */}
      <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-amber-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-orange-600/10 blur-[120px]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-amber-500/5 blur-[160px]" />

      <Suspense fallback={<div className="text-amber-400 text-sm font-mono">جاري التحميل...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
