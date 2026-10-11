'use client';

import React, { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MarkdownPreview } from './MarkdownPreview';
import {
  Upload,
  Image as ImageIcon,
  FileText,
  Trash2,
  MoveUp,
  MoveDown,
  Eye,
  Link as LinkIcon,
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MenuManagerProps {
  initialSettings: {
    id: string;
    menu_images: string[];
    menu_pdf_url: string | null;
    price_list: string | null;
  };
}

const FRIED_CHICKEN_TEMPLATE = `# منيو وقائمة أسعار تشيكن مراعي (Chicken Maraei) 🍗👑
> **الخط الساخن:** 17330 | **الشعار:** لأكيلة مراعي 🍟🔥

## 🍗 وجبات البروست (Broast Meals)
*مع بطاطس، خبز، كلوسلو أو تومية، وكاتشب*
- **سناك بوكس (2 قطعة)**: 140 ج.م
- **دينر بوكس (3 قطع)**: 195 ج.م
- **سوبر دينر بوكس (4 قطع)**: 240 ج.م
- **مراعي دينر بوكس (5 قطع)**: 310 ج.م
- **فاملي بوكس (9 قطع)**: 540 ج.م
- **شير بوكس (12 قطعة)**: 675 ج.م
- **مراعي فاملي بوكس (15 قطعة)**: 790 ج.م
- **بارتي بوكس (21 قطعة)**: 1125 ج.م

## 🍟 وجبات استربس (Strips Meals)
*مع بطاطس، خبز، كلوسلو أو تومية، وكاتشب*
- **وجبة استربس 3 قطع**: 130 ج.م
- **وجبة استربس 5 قطع**: 180 ج.م
- **وجبة استربس 10 قطع**: 350 ج.م
- **وجبة استربس 15 قطعة**: 500 ج.م

## 🍗🍟 وجبات ميكس (دجاج + استربس)
- **ميكس 2 قطعة دجاج + 2 استربس**: 210 ج.م
- **ميكس 3 قطع دجاج + 3 استربس**: 295 ج.م
- **ميكس 5 قطع دجاج + 5 استربس**: 450 ج.م

## 💰 وجبات التوفير (دجاج + خبز)
- **وجبة سناك التوفير (2 قطعة دجاج)**: 125 ج.م
- **وجبة دينر التوفير (3 قطع دجاج)**: 175 ج.م
- **وجبة مراعي التوفير (8 قطع دجاج)**: 450 ج.م

## 🍚 وجبات الأرز والريزو
- **أرز دجاج (2 قطعة بروست + أرز مبهر كبير + تومية + بطاطس)**: 165 ج.م
- **أرز استربس (4 قطع استربس + أرز مبهر كبير + تومية + بطاطس)**: 165 ج.م
- **ريزو مراعي (سبايسي أو باربكيو)**: 85 ج.م

## 🥪 سندوتشات فرايد تشيكن المميزة
- **تشيكن زنجر**: سنجل 100 ج.م / دبل 150 ج.م
- **تشيكن سوبريم (مع تركي وجبنة)**: سنجل 115 ج.م / دبل 170 ج.م
- **تشيكن هالبينو (سبايسي)**: سنجل 110 ج.م / دبل 160 ج.م
- **تويستر رول استربس**: 85 ج.م
- **فاير جن (مع شيدر هالبينو وصوص تايجر)**: سنجل 115 / دبل 170 / تريبل 225 ج.م
- **جودزيلا ستيكس (مع أصابع موتزاريلا)**: سنجل 115 / دبل 170 / تريبل 225 ج.م
- **مراعي بوووم (مع روزبيف وتكساس)**: سنجل 115 / دبل 170 / تريبل 225 ج.م
- **بركان مراعي (3 طبقات كرسبي وغرقان شيدر)**: تريبل 215 ج.م
- **مراعي ميكس (بيف برجر + دجاج كرسبي)**: 175 ج.م

## 🥖 ساندوتشات فرنساوي
- **ميجا زنجر فرنساوي**: 125 ج.م
- **ميجا سوبريم فرنساوي**: 140 ج.م
- **بيج فيلر مراعي فرنساوي**: 140 ج.م
- **بطاطس سوري**: 35 ج.م

## 🍔 ساندوتشات بيف برجر مشوي
- **كلاسيك كينج**: سنجل (150جم) 115 ج.م / دبل (300جم) 195 ج.م / محشو جبنة (250جم) 195 ج.م
- **مراعي كينج**: سنجل 135 ج.م / دبل 200 ج.م / محشو جبنة 200 ج.م
- **ستيكس كينج (مع موتزاريلا ستيكس)**: سنجل 140 ج.م / دبل 205 ج.م / محشو جبنة 205 ج.م
- **هالبينو كينج**: سنجل 120 ج.م / دبل 200 ج.م / محشو جبنة 200 ج.م
- **رينجز كينج (مع حلقات بصل)**: سنجل 125 ج.م / دبل 200 ج.م / محشو جبنة 200 ج.م

## 🍔 ساندوتشات تشيكن برجر
- **تشيز برجر**: سنجل 110 ج.م / دبل 160 ج.م / تريبل 205 ج.م
- **ستيكس برجر**: سنجل 120 ج.م / دبل 165 ج.م / تريبل 215 ج.م
- **رينجز برجر**: سنجل 110 ج.م / دبل 160 ج.م / تريبل 205 ج.م

## 🍟 بطاطس وسناكس وإضافات
- **فرايز مراعي (صوص جبنة + استربس)**: 60 ج.م
- **فرايز تشيز (صوص جبنة)**: 50 ج.م
- **فرايز هالبينو (جبنة + هالبينو)**: 55 ج.م
- **باكت بطاطس**: صغير 20 ج.م / كبير 35 ج.م
- **3 أصابع موتزاريلا + صوص جبنة**: 55 ج.م
- **4 حلقات بصل مقرمشة + صوص باربكيو**: 45 ج.م
- **3 أصابع شيدر هالبينو + صوص تايجر**: 55 ج.م
- **أرز مبهر**: صغير 25 ج.م / كبير 35 ج.م
- **كلوسلو**: صغير 20 ج.م / كبير 35 ج.م
- **تومية**: 15 ج.م | **جار جبنة**: 85 ج.م
- **قطعة بروست**: 75 ج.م | **قطعة استربس**: 45 ج.م
- **أي صوص إضافي (شيدر، باربكيو، تايجر، تاي شيلي، رانش، تكساس، 1000 جزيرة)**: 25 ج.م

## 🍔🍟 عروض الكومبو
- **كومبو 1 (فرايز + كانز)**: 35 ج.م
- **كومبو 2 (فرايز + كانز + كلوسلو)**: 50 ج.م

## 👶 وجبات الأطفال
- **وجبة دجاج أو استربس (دبوس أو 2 استربس + بطاطس + عصير + لعبة)**: 130 ج.م
- **وجبة تشيكن برجر (ساندوتش + بطاطس + عصير + لعبة)**: 140 ج.م

## 🍫 عرض الحلو
- **شوكو بامب (نوتيلا / وايت / لوتس)**: 40 ج.م
- **عرض 3 شوكو بامب**: 100 ج.م
- **عرض 6 شوكو بامب**: 180 ج.م

## 🥤 المشروبات
- **مياه صغيرة**: 10 ج.م | **كانز**: 20 ج.م | **عصير**: 20 ج.م | **1 لتر**: 35 ج.م

---
📍 **الفروع:** فيصل • إمبابة • حدائق أكتوبر • الهرم • الوراق • السيدة زينب  
📞 **الخط الساخن:** 17330`;

export function MenuManager({ initialSettings }: MenuManagerProps) {
  const supabase = createClient();
  const [images, setImages] = useState<string[]>(initialSettings.menu_images || []);
  const [pdfUrl, setPdfUrl] = useState<string | null>(initialSettings.menu_pdf_url);
  const [priceList, setPriceList] = useState<string>(initialSettings.price_list || FRIED_CHICKEN_TEMPLATE);
  const [isPriceListDirty, setIsPriceListDirty] = useState(!initialSettings.price_list);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isSavingPrices, setIsSavingPrices] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // === Images Logic ===
  const saveImages = async (newImages: string[]) => {
    setImages(newImages);
    await supabase.from('bot_settings').update({ menu_images: newImages }).eq('id', initialSettings.id);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploadingImage(true);
    
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(e.target.files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `menu/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('menu-assets').upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('menu-assets').getPublicUrl(filePath);
        newUrls.push(publicUrl);
      }
      await saveImages([...images, ...newUrls]);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('حدث خطأ أثناء رفع الصور.');
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const deleteImage = async (index: number) => {
    if (!confirm('هل أنت متأكد من حذف هذه الصورة؟')) return;
    const url = images[index];
    const newImages = [...images];
    newImages.splice(index, 1);
    await saveImages(newImages);

    // best effort delete from storage
    if (url.includes('menu-assets')) {
      const pathMatch = url.match(/menu-assets\/(.+)/);
      if (pathMatch && pathMatch[1]) {
        await supabase.storage.from('menu-assets').remove([pathMatch[1]]);
      }
    }
  };

  const moveImage = async (index: number, dir: 'up' | 'down') => {
    if (dir === 'up' && index === 0) return;
    if (dir === 'down' && index === images.length - 1) return;

    const newImages = [...images];
    const target = dir === 'up' ? index - 1 : index + 1;
    [newImages[index], newImages[target]] = [newImages[target], newImages[index]];
    await saveImages(newImages);
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    alert('تم نسخ الرابط!');
  };

  // === PDF Logic ===
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploadingPdf(true);
    
    try {
      const file = e.target.files[0];
      const fileName = `${Date.now()}-menu.pdf`;
      const filePath = `menu/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('menu-assets').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('menu-assets').getPublicUrl(filePath);
      
      setPdfUrl(publicUrl);
      await supabase.from('bot_settings').update({ menu_pdf_url: publicUrl }).eq('id', initialSettings.id);
      
      // try to delete old pdf if exists
      if (pdfUrl && pdfUrl.includes('menu-assets')) {
        const pathMatch = pdfUrl.match(/menu-assets\/(.+)/);
        if (pathMatch && pathMatch[1]) {
          supabase.storage.from('menu-assets').remove([pathMatch[1]]);
        }
      }
    } catch (err) {
      console.error('PDF upload failed:', err);
      alert('حدث خطأ أثناء رفع ملف الـ PDF.');
    } finally {
      setIsUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const deletePdf = async () => {
    if (!confirm('هل أنت متأكد من حذف ملف الـ PDF؟')) return;
    setPdfUrl(null);
    await supabase.from('bot_settings').update({ menu_pdf_url: null }).eq('id', initialSettings.id);
    
    if (pdfUrl && pdfUrl.includes('menu-assets')) {
      const pathMatch = pdfUrl.match(/menu-assets\/(.+)/);
      if (pathMatch && pathMatch[1]) {
        supabase.storage.from('menu-assets').remove([pathMatch[1]]);
      }
    }
  };

  // === Price List Logic ===
  const handleSavePriceList = async () => {
    setIsSavingPrices(true);
    try {
      const { error } = await supabase.from('bot_settings').update({ price_list: priceList }).eq('id', initialSettings.id);
      if (error) throw error;
      setIsPriceListDirty(false);
      alert('تم الحفظ بنجاح!');
    } catch (err) {
      console.error('Save failed:', err);
      alert('حدث خطأ أثناء حفظ قائمة الأسعار.');
    } finally {
      setIsSavingPrices(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Images Gallery */}
      <section className="bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-rose-500 dark:text-rose-400" />
              صور المنيو
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">يتم إرسالها للعميل عند طلبه المنيو. الترتيب مهم.</p>
          </div>
          <div>
            <input type="file" multiple accept="image/*" className="hidden" ref={imageInputRef} onChange={handleImageUpload} />
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploadingImage}
              className="inline-flex items-center gap-2 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50"
            >
              {isUploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              رفع صور جديدة
            </button>
          </div>
        </div>

        {images.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            <ImageIcon className="w-8 h-8 mx-auto text-slate-400 dark:text-slate-600 mb-2" />
            <p className="text-sm text-slate-500 dark:text-slate-400">لا توجد صور للمنيو حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {images.map((url, idx) => (
              <div key={idx} className="group relative bg-slate-100 dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs">
                <img src={url} alt={`Menu ${idx + 1}`} className="w-full h-48 object-cover" />
                <div className="absolute top-2 right-2 bg-slate-900/80 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm border border-slate-700">
                  {idx + 1}
                </div>
                <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                  <div className="flex items-center gap-2">
                    <button onClick={() => moveImage(idx, 'up')} disabled={idx === 0} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 text-white"><MoveUp className="w-4 h-4" /></button>
                    <button onClick={() => moveImage(idx, 'down')} disabled={idx === images.length - 1} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 disabled:opacity-50 text-white"><MoveDown className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => window.open(url, '_blank')} className="p-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"><Eye className="w-4 h-4" /></button>
                    <button onClick={() => copyLink(url)} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30"><LinkIcon className="w-4 h-4" /></button>
                    <button onClick={() => deleteImage(idx)} className="p-2 bg-rose-500/20 text-rose-400 rounded-lg hover:bg-rose-500/30"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. PDF Upload */}
      <section className="bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-rose-500 dark:text-rose-400" />
              ملف المنيو (PDF)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">نسخة للتحميل والمشاركة (اختياري)</p>
          </div>
          <div>
            <input type="file" accept="application/pdf" className="hidden" ref={pdfInputRef} onChange={handlePdfUpload} />
            <button
              onClick={() => pdfInputRef.current?.click()}
              disabled={isUploadingPdf}
              className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50"
            >
              {isUploadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {pdfUrl ? 'استبدال الملف' : 'رفع ملف PDF'}
            </button>
          </div>
        </div>

        {pdfUrl ? (
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-500/10 text-rose-500 dark:text-rose-400 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-slate-900 dark:text-white font-medium">تم رفع ملف الـ PDF بنجاح</p>
                <button onClick={() => copyLink(pdfUrl)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">نسخ الرابط</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-white">
                <Eye className="w-4 h-4" />
              </a>
              <button onClick={deletePdf} className="p-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500 italic">لا يوجد ملف PDF مرفوع.</p>
        )}
      </section>

      {/* 3. Price List Editor */}
      <section className="bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-6 shadow-xs flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              قائمة الأسعار النصية (Price List)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">يستخدمها البوت للرد على الاستفسارات (Markdown). تقدر تستخدمها في n8n بالتعبير {'{{ $json.price_list }}'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (priceList && priceList.trim() && !confirm('هل تريد استبدال المحتوى الحالي بنموذج منيو تشيكن مراعي الافتراضي؟')) return;
                setPriceList(FRIED_CHICKEN_TEMPLATE);
                setIsPriceListDirty(true);
              }}
              className="inline-flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 px-3.5 py-1.5 rounded-lg text-xs font-bold transition border border-amber-500/20"
              title="تطبيق نموذج قائمة أسعار تشيكن مراعي الرسمية المفرغة من المنيو"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              نموذج منيو تشيكن مراعي 🍗
            </button>
            <button
              onClick={handleSavePriceList}
              disabled={!isPriceListDirty || isSavingPrices}
              className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-emerald-950 px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50 disabled:grayscale"
            >
              {isSavingPrices ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ قائمة الأسعار
            </button>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="flex md:hidden border-b border-slate-200 dark:border-slate-800 mb-4">
          <button
            className={cn('flex-1 pb-2 text-sm font-bold border-b-2 transition', activeTab === 'editor' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-400 dark:text-slate-500')}
            onClick={() => setActiveTab('editor')}
          >
            المحرر
          </button>
          <button
            className={cn('flex-1 pb-2 text-sm font-bold border-b-2 transition', activeTab === 'preview' ? 'border-amber-500 text-amber-600 dark:text-amber-400' : 'border-transparent text-slate-400 dark:text-slate-500')}
            onClick={() => setActiveTab('preview')}
          >
            المعاينة
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[400px]">
          <div className={cn("flex-col", activeTab === 'editor' ? 'flex' : 'hidden md:flex')}>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block">المحرر (Markdown)</label>
            <textarea
              dir="auto"
              value={priceList}
              onChange={(e) => {
                setPriceList(e.target.value);
                setIsPriceListDirty(true);
              }}
              className="flex-1 w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl p-4 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm font-mono outline-none transition resize-y min-h-[400px]"
              placeholder="اكتب الأسعار هنا..."
            />
          </div>

          <div className={cn("flex-col", activeTab === 'preview' ? 'flex' : 'hidden md:flex')}>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 block">المعاينة المباشرة (Live Preview)</label>
            <div className="flex-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 overflow-y-auto min-h-[400px]">
              <MarkdownPreview source={priceList} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
