import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { MenuManager } from '@/components/menu/MenuManager';
import { FileText, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'المنيو | لوحة التحكم',
  description: 'إدارة المنيو، قائمة الأسعار، وملفات المنيو',
};

export const revalidate = 0;

export default async function MenuPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    redirect('/dashboard');
  }

  const { data: settings } = await supabase
    .from('bot_settings')
    .select('id, menu_images, menu_pdf_url, price_list')
    .limit(1)
    .maybeSingle();

  if (!settings) {
    return (
      <div className="p-8 text-center text-slate-400">
        الرجاء ضبط الإعدادات الأساسية للبوت أولاً من صفحة الإعدادات
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/5">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">المنيو</h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" />
                تحكم المدير
              </span>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              إدارة صور المنيو وملف الـ PDF وقائمة الأسعار للمحادثة
            </p>
          </div>
        </div>
      </div>

      <MenuManager initialSettings={settings} />
    </div>
  );
}
