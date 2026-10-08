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

const FRIED_CHICKEN_TEMPLATE = `# قائمة الأسعار 🍗🔥

## عروض التوفير 👑
- **وجبة التوفير**: 3 قطع كريسبي + بطاطس + كول سلو + عيش (150 ج.م)
- **وجبة اللمة**: 10 قطع استربس + بطاطس عائلي + لتر بيبسي (350 ج.م)

## البروستد 🍗
1. **وجبة 3 قطع**: (140 ج.م)
2. **وجبة 4 قطع**: (175 ج.م)

## استربس 🍟
* **وجبة 3 قطع استربس**: (135 ج.م)
* **وجبة 5 قطع استربس**: (190 ج.م)

## إضافات وصوصات 🧀
- **بطاطس محمرة**: (25 ج.م)
- **صوص جبنة شيدر**: (15 ج.م)
- **صوص ثومية**: (10 ج.م)

---
*تضاف 15 ج.م لخدمة التوصيل.*
*الأسعار شاملة الضريبة.*`;

export function MenuManager({ initialSettings }: MenuManagerProps) {
  const supabase = createClient();
  const [images, setImages] = useState<string[]>(initialSettings.menu_images || []);
  const [pdfUrl, setPdfUrl] = useState<string | null>(initialSettings.menu_pdf_url);
  const [priceList, setPriceList] = useState<string>(initialSettings.price_list || '');
  const [isPriceListDirty, setIsPriceListDirty] = useState(false);
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
      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-rose-400" />
              صور المنيو
            </h2>
            <p className="text-xs text-slate-400 mt-1">يتم إرسالها للعميل عند طلبه المنيو. الترتيب مهم.</p>
          </div>
          <div>
            <input type="file" multiple accept="image/*" className="hidden" ref={imageInputRef} onChange={handleImageUpload} />
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={isUploadingImage}
              className="inline-flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50"
            >
              {isUploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              رفع صور جديدة
            </button>
          </div>
        </div>

        {images.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-slate-800 rounded-xl">
            <ImageIcon className="w-8 h-8 mx-auto text-slate-600 mb-2" />
            <p className="text-sm text-slate-400">لا توجد صور للمنيو حالياً</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {images.map((url, idx) => (
              <div key={idx} className="group relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
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
      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-rose-400" />
              ملف المنيو (PDF)
            </h2>
            <p className="text-xs text-slate-400 mt-1">نسخة للتحميل والمشاركة (اختياري)</p>
          </div>
          <div>
            <input type="file" accept="application/pdf" className="hidden" ref={pdfInputRef} onChange={handlePdfUpload} />
            <button
              onClick={() => pdfInputRef.current?.click()}
              disabled={isUploadingPdf}
              className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition disabled:opacity-50"
            >
              {isUploadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {pdfUrl ? 'استبدال الملف' : 'رفع ملف PDF'}
            </button>
          </div>
        </div>

        {pdfUrl ? (
          <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-rose-500/10 text-rose-400 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-white font-medium">تم رفع ملف الـ PDF بنجاح</p>
                <button onClick={() => copyLink(pdfUrl)} className="text-xs text-blue-400 hover:underline">نسخ الرابط</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href={pdfUrl} target="_blank" rel="noreferrer" className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-white">
                <Eye className="w-4 h-4" />
              </a>
              <button onClick={deletePdf} className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">لا يوجد ملف PDF مرفوع.</p>
        )}
      </section>

      {/* 3. Price List Editor */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-md flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              قائمة الأسعار النصية (Price List)
            </h2>
            <p className="text-xs text-slate-400 mt-1">يستخدمها البوت للرد على الاستفسارات (Markdown). تقدر تستخدمها في n8n بالتعبير {'{{ $json.price_list }}'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (priceList && !confirm('هل أنت متأكد من مسح المحتوى الحالي وتطبيق النموذج؟')) return;
                setPriceList(FRIED_CHICKEN_TEMPLATE);
                setIsPriceListDirty(true);
              }}
              className="inline-flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg text-xs font-bold transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              نموذج قائمة أسعار فرايد تشيكن
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
        <div className="flex md:hidden border-b border-slate-800 mb-4">
          <button
            className={cn('flex-1 pb-2 text-sm font-bold border-b-2 transition', activeTab === 'editor' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-500')}
            onClick={() => setActiveTab('editor')}
          >
            المحرر
          </button>
          <button
            className={cn('flex-1 pb-2 text-sm font-bold border-b-2 transition', activeTab === 'preview' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-500')}
            onClick={() => setActiveTab('preview')}
          >
            المعاينة
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[400px]">
          <div className={cn("flex-col", activeTab === 'editor' ? 'flex' : 'hidden md:flex')}>
            <label className="text-xs font-bold text-slate-400 mb-2 block">المحرر (Markdown)</label>
            <textarea
              dir="auto"
              value={priceList}
              onChange={(e) => {
                setPriceList(e.target.value);
                setIsPriceListDirty(true);
              }}
              className="flex-1 w-full bg-slate-950/70 border border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl p-4 text-white text-sm font-mono outline-none transition resize-y min-h-[400px]"
              placeholder="اكتب الأسعار هنا..."
            />
          </div>

          <div className={cn("flex-col", activeTab === 'preview' ? 'flex' : 'hidden md:flex')}>
            <label className="text-xs font-bold text-slate-400 mb-2 block">المعاينة المباشرة (Live Preview)</label>
            <div className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-6 overflow-y-auto min-h-[400px]">
              <MarkdownPreview source={priceList} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
