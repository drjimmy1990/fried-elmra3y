'use client';

import React, { useState } from 'react';
import { Sparkles, Plus, Trash2, Pencil, Check, X, RotateCcw } from 'lucide-react';
import { Modal, btn, inputClass } from '@/components/ui/Modal';
import { QuickReply } from './types';

export const DEFAULT_CANNED_REPLIES: QuickReply[] = [
  {
    id: '1',
    text: 'أهلاً بحضرتك يا فندم 🍗 نورتنا! نعتذر عن أي إزعاج ويسعدنا جداً خدمتك.',
    label: 'ترحيب واعتذار',
  },
  {
    id: '2',
    text: 'تم تجهيز طلب حضرتك طازة وهو مع الطيار الآن في الطريق إليك 🛵.',
    label: 'تأكيد التوصيل',
  },
  {
    id: '3',
    text: 'لحظات من فضلك وأراجع الأمر لحضرتك مع إدارة الفرع والمطبخ فوراً ⏳.',
    label: 'مراجعة المطبخ',
  },
  {
    id: '4',
    text: 'شرفتنا يا فندم وبالهنا والشفا مقدماً! تحب نساعدك في أي حاجة تانية؟ 😊',
    label: 'إنهاء المحادثة',
  },
  {
    id: '5',
    text: 'تم تسجيل ملاحظات حضرتك وسيقوم مدير الفرع بالتواصل معك هاتفياً لحل المشكلة فوراً.',
    label: 'تصعيد للإدارة',
  },
  {
    id: '6',
    text: 'ممكن بعد إذنك تأكدلنا العنوان بالتفصيل (اسم الشارع، رقم العمارة، الدور والشقة) ورقم التليفون؟',
    label: 'طلب بيانات العنوان',
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
  replies: QuickReply[];
  onSave: (replies: QuickReply[]) => void;
}

export function CannedResponsesModal({ open, onClose, replies, onSave }: Props) {
  const [list, setList] = useState<QuickReply[]>(replies);
  const [newLabel, setNewLabel] = useState('');
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editText, setEditText] = useState('');

  // Sync when opened
  React.useEffect(() => {
    setList(replies);
    setEditingId(null);
  }, [open, replies]);

  const handleAdd = () => {
    if (!newText.trim()) return;
    const item: QuickReply = {
      id: Date.now().toString(),
      label: newLabel.trim() || 'رد سريع',
      text: newText.trim(),
    };
    const updated = [...list, item];
    setList(updated);
    onSave(updated);
    setNewLabel('');
    setNewText('');
  };

  const handleDelete = (id: string) => {
    const updated = list.filter((r) => r.id !== id);
    setList(updated);
    onSave(updated);
  };

  const handleStartEdit = (item: QuickReply) => {
    setEditingId(item.id);
    setEditLabel(item.label || '');
    setEditText(item.text);
  };

  const handleSaveEdit = (id: string) => {
    if (!editText.trim()) return;
    const updated = list.map((r) =>
      r.id === id ? { ...r, label: editLabel.trim() || 'رد سريع', text: editText.trim() } : r
    );
    setList(updated);
    onSave(updated);
    setEditingId(null);
  };

  const handleResetDefaults = () => {
    setList(DEFAULT_CANNED_REPLIES);
    onSave(DEFAULT_CANNED_REPLIES);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="إدارة الردود السريعة الجاهزة (Canned Responses)"
      subtitle="تخصيص الرسائل الجاهزة التي يستخدمها موظفو الدعم للرد بنقرة واحدة"
      icon={<Sparkles className="w-5 h-5 text-amber-500" />}
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-500 dark:text-slate-400 dark:hover:text-amber-400 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            استعادة الردود الافتراضية
          </button>
          <button type="button" onClick={onClose} className={btn.primary}>
            إغلاق
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 1. Add New Canned Reply Form */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
          <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-emerald-500" />
            إضافة رد سريع جديد
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="عنوان الزر (مثال: تأكيد العنوان)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className={inputClass}
            />
            <input
              type="text"
              placeholder="نص الرد الكامل الذي يتم إرساله للعميل..."
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              className={`${inputClass} sm:col-span-2`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={!newText.trim()}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              إضافة إلى القائمة
            </button>
          </div>
        </div>

        {/* 2. Canned Replies List */}
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {list.length === 0 ? (
            <p className="text-center py-6 text-xs text-slate-500 dark:text-slate-400">
              لا توجد ردود سريعة حالياً. أضف رداً جديداً أو اضغط استعادة الردود الافتراضية.
            </p>
          ) : (
            list.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950/40 flex items-start justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition"
              >
                {editingId === item.id ? (
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="عنوان الزر"
                      className={inputClass}
                    />
                    <textarea
                      rows={2}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      placeholder="نص الرد الكامل"
                      className={`${inputClass} text-xs`}
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(item.id)}
                        className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        حفظ
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                          {item.label || 'رد سريع'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed break-words">
                        {item.text}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition"
                        title="تعديل هذا الرد"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 transition"
                        title="حذف هذا الرد"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
