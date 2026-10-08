'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Utensils, Lock, Mail, AlertCircle, ArrowLeft, Loader2, ShieldAlert } from 'lucide-react';

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
        email,
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
      const message = err instanceof Error ? err.message : 'فشل تسجيل الدخول. يرجى التحقق من البيانات.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="bg-gradient-to-r from-amber-600 to-amber-700 p-8 text-center text-white">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
          <Utensils className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">مطعم الخديوي 👑</h1>
        <p className="mt-1 text-sm text-amber-100">لوحة تحكم العمليات والبوت الذكي</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5 p-8">
        {urlError === 'account_deactivated' && !error && (
          <div className="flex items-center gap-3 rounded-lg bg-rose-50 p-3.5 text-sm text-rose-800 border border-rose-200">
            <ShieldAlert className="h-5 w-5 shrink-0 text-rose-600" />
            <span>تم تعطيل هذا الحساب من قبل إدارة النظام. يرجى مراجعة المسؤول.</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            البريد الإلكتروني
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <Mail className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@khedewy.com"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 pr-10 pl-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 text-left focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            كلمة المرور
          </label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <Lock className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="password"
              required
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 pr-10 pl-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 text-left focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span>تذكر بيانات الدخول</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 py-3 text-sm font-semibold text-white shadow-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:opacity-60 transition"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري تسجيل الدخول...
            </>
          ) : (
            <>
              <span>تسجيل الدخول</span>
              <ArrowLeft className="h-4 w-4" />
            </>
          )}
        </button>

        <div className="text-center text-xs text-slate-400 pt-2">
          نظام محمي برمز الأمان وبصلاحيات الموظفين (RBAC)
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 p-4">
      <Suspense fallback={<div className="text-white text-sm">جاري التحميل...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
