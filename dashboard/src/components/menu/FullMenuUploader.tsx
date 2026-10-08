'use client';

import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  UploadCloud,
  Check,
  Copy,
  ExternalLink,
  Trash2,
  Loader2,
  AlertCircle,
  Sparkles,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import { FullMenuSettings } from './types';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface FullMenuUploaderProps {
  initialSettings: FullMenuSettings;
  onSettingsUpdated: (newSettings: FullMenuSettings) => void;
}

export function FullMenuUploader({
  initialSettings,
  onSettingsUpdated,
}: FullMenuUploaderProps) {
  const [settings, setSettings] = useState<FullMenuSettings>(initialSettings);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [copiedType, setCopiedType] = useState<'image' | 'pdf' | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Helper to persist updated URLs into bot_settings
  const saveToBotSettings = async (
    updates: Partial<{ menu_full_image_url: string | null; menu_full_pdf_url: string | null }>
  ) => {
    const supabase = createClient();
    const { data: existingRow } = await supabase
      .from('bot_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (existingRow?.id) {
      const { error } = await supabase
        .from('bot_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingRow.id);

      if (error) throw error;
    } else {
      const { error } = await supabase.from('bot_settings').insert({
        ...updates,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
    }
  };

  // Upload handler for full menu file (image or pdf)
  const handleUpload = async (file: File, type: 'image' | 'pdf') => {
    const isImage = type === 'image';
    setStatusMessage(null);

    const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
    const MAX_PDF_SIZE = 25 * 1024 * 1024; // 25MB

    if (isImage && !file.type.startsWith('image/')) {
      setStatusMessage({ type: 'error', text: 'يرجى اختيار ملف صورة صالح (JPG, PNG, WEBP)' });
      return;
    }
    if (!isImage && file.type !== 'application/pdf') {
      setStatusMessage({ type: 'error', text: 'يرجى اختيار ملف PDF صالح' });
      return;
    }
    if (isImage && file.size > MAX_IMAGE_SIZE) {
      setStatusMessage({ type: 'error', text: 'حجم الصورة يتجاوز الحد الأقصى (10 ميجابايت)' });
      return;
    }
    if (!isImage && file.size > MAX_PDF_SIZE) {
      setStatusMessage({ type: 'error', text: 'حجم ملف PDF يتجاوز الحد الأقصى (25 ميجابايت)' });
      return;
    }

    if (isImage) setIsUploadingImage(true);
    else setIsUploadingPdf(true);

    try {
      const ext = file.name.split('.').pop() || (isImage ? 'webp' : 'pdf');
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `full-menu/menu-${Date.now()}-${sanitizedName}`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from('menu-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from('menu-assets')
        .getPublicUrl(filePath);

      const publicUrl = urlData.publicUrl;

      if (isImage) {
        await saveToBotSettings({ menu_full_image_url: publicUrl });
        const next = { ...settings, menu_full_image_url: publicUrl };
        setSettings(next);
        onSettingsUpdated(next);
        setStatusMessage({
          type: 'success',
          text: 'تم رفع صورة المنيو الكامل وتحديث إعدادات البوت بنجاح! 🎉',
        });
      } else {
        await saveToBotSettings({ menu_full_pdf_url: publicUrl });
        const next = { ...settings, menu_full_pdf_url: publicUrl };
        setSettings(next);
        onSettingsUpdated(next);
        setStatusMessage({
          type: 'success',
          text: 'تم رفع ملف المنيو PDF وتحديث إعدادات البوت بنجاح! 🎉',
        });
      }
    } catch (err: unknown) {
      console.error('Failed to upload full menu file:', err);
      const msg = err instanceof Error ? err.message : 'فشل الرفع إلى السحابة';
      setStatusMessage({
        type: 'error',
        text: `حدث خطأ أثناء الرفع: ${msg}`,
      });
    } finally {
      if (isImage) setIsUploadingImage(false);
      else setIsUploadingPdf(false);
    }
  };

  // Remove full menu file
  const handleRemove = async (type: 'image' | 'pdf') => {
    const isImage = type === 'image';
    setStatusMessage(null);

    try {
      if (isImage) {
        await saveToBotSettings({ menu_full_image_url: null });
        const next = { ...settings, menu_full_image_url: null };
        setSettings(next);
        onSettingsUpdated(next);
      } else {
        await saveToBotSettings({ menu_full_pdf_url: null });
        const next = { ...settings, menu_full_pdf_url: null };
        setSettings(next);
        onSettingsUpdated(next);
      }
      setStatusMessage({
        type: 'success',
        text: 'تم إزالة الرابط بنجاح',
      });
    } catch (err) {
      console.error('Failed to remove menu setting:', err);
      setStatusMessage({
        type: 'error',
        text: 'فشل إزالة الرابط، يرجى المحاولة لاحقاً',
      });
    }
  };

  // Copy link to clipboard
  const handleCopyLink = async (url: string, type: 'image' | 'pdf') => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedType(type);
      setTimeout(() => {
        setCopiedType(null);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert / Status Toast */}
      {statusMessage && (
        <div
          className={cn(
            'p-4 rounded-2xl border text-xs flex items-center justify-between animate-in fade-in',
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          )}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Info Card: Bot integration details */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/20 text-slate-300">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-white text-sm">
              كيف يستخدم بوت المسنجر (Al-Khedewy Bot) هذا المنيو المطبوع؟
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              عندما يضغط العميل على زر <strong>"قائمة المنيو 🍔"</strong> في رسائل مسنجر الترحيبية أو يطلب <strong>"عايز المنيو كامل"</strong>، يقوم البوت تلقائياً بإرسال صورة المنيو أو رابط الـ PDF المرفوع هنا مباشرة للعميل داخل شات فيسبوك مسنجر بدون أي تدخل بشري!
            </p>
          </div>
        </div>
      </div>

      {/* Grid of the 2 master files: Image & PDF */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Master Menu Image */}
        <div className="flex flex-col justify-between bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">صورة المنيو الكامل (Master Image)</h4>
                  <p className="text-[11px] text-slate-400">ملفات JPG, PNG, WEBP بدقة عالية</p>
                </div>
              </div>
              {settings.menu_full_image_url && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  مرفوع ونشط
                </span>
              )}
            </div>

            {/* Preview Box */}
            <div className="relative w-full aspect-16/10 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center">
              {settings.menu_full_image_url ? (
                <img
                  src={settings.menu_full_image_url}
                  alt="المنيو الكامل"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center p-6 space-y-2 text-slate-500">
                  <ImageIcon className="w-10 h-10 mx-auto stroke-1" />
                  <p className="text-xs font-medium">لم يتم رفع صورة المنيو بعد</p>
                  <p className="text-[10px] text-slate-600">ارفع صورة المطبوعات الورقية أو البوستر</p>
                </div>
              )}
            </div>

            {/* URL Display if present */}
            {settings.menu_full_image_url && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400 font-mono truncate" dir="ltr">
                  {settings.menu_full_image_url}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(settings.menu_full_image_url!, 'image')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="نسخ الرابط"
                  >
                    {copiedType === 'image' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <a
                    href={settings.menu_full_image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="معاينة في نافذة جديدة"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRemove('image')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="حذف الرابط"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div>
            <label
              className={cn(
                'flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl border border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 text-amber-300 font-bold text-xs cursor-pointer transition-all shadow-xs',
                isUploadingImage && 'opacity-50 pointer-events-none'
              )}
            >
              {isUploadingImage ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري رفع الصورة إلى السحابة...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>{settings.menu_full_image_url ? 'استبدال صورة المنيو' : 'رفع صورة المنيو الكامل'}</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={isUploadingImage}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f, 'image');
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Card 2: Master Menu PDF */}
        <div className="flex flex-col justify-between bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">ملف المنيو PDF (PDF Catalog)</h4>
                  <p className="text-[11px] text-slate-400">كتالوج إلكتروني قابل للتصفح والتحميل</p>
                </div>
              </div>
              {settings.menu_full_pdf_url && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  مرفوع ونشط
                </span>
              )}
            </div>

            {/* Preview Box */}
            <div className="relative w-full aspect-16/10 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col items-center justify-center p-6 text-center space-y-3">
              {settings.menu_full_pdf_url ? (
                <>
                  <div className="p-3.5 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <FileText className="w-10 h-10" />
                  </div>
                  <div>
                    <h5 className="font-bold text-white text-sm">ملف المنيو جاهز للتحميل</h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      يمكن للعملاء فتح وتصفح ملف الـ PDF مباشرة على هواتفهم
                    </p>
                  </div>
                  <a
                    href={settings.menu_full_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>تصفح ملف PDF في نافذة جديدة</span>
                  </a>
                </>
              ) : (
                <div className="space-y-2 text-slate-500">
                  <FileText className="w-10 h-10 mx-auto stroke-1" />
                  <p className="text-xs font-medium">لم يتم رفع ملف PDF بعد</p>
                  <p className="text-[10px] text-slate-600">يمكنك رفع كتالوج الأطباق بصيغة PDF</p>
                </div>
              )}
            </div>

            {/* URL Display if present */}
            {settings.menu_full_pdf_url && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400 font-mono truncate" dir="ltr">
                  {settings.menu_full_pdf_url}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyLink(settings.menu_full_pdf_url!, 'pdf')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="نسخ الرابط"
                  >
                    {copiedType === 'pdf' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <a
                    href={settings.menu_full_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="معاينة في نافذة جديدة"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRemove('pdf')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="حذف الرابط"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Upload Button */}
          <div>
            <label
              className={cn(
                'flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl border border-dashed border-blue-500/40 hover:border-blue-400 bg-blue-500/5 hover:bg-blue-500/10 text-blue-300 font-bold text-xs cursor-pointer transition-all shadow-xs',
                isUploadingPdf && 'opacity-50 pointer-events-none'
              )}
            >
              {isUploadingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري رفع ملف PDF إلى السحابة...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>{settings.menu_full_pdf_url ? 'استبدال ملف PDF' : 'رفع ملف PDF للمنيو'}</span>
                </>
              )}
              <input
                type="file"
                accept="application/pdf"
                disabled={isUploadingPdf}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f, 'pdf');
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
