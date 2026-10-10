'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  Crown,
  Pizza,
  Headphones,
  Mail,
  User,
  Phone,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { StaffMember, UserRole, InviteStaffInput, ROLE_CONFIGS } from './types';
import { cn } from '@/lib/utils';

interface InviteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStaffAdded: (staff: StaffMember) => void;
}

export function InviteStaffModal({
  isOpen,
  onClose,
  onStaffAdded,
}: InviteStaffModalProps) {
  const [formData, setFormData] = useState<InviteStaffInput>({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'order_agent',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Body scroll lock & ESC key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        role: 'order_agent',
      });
      setErrorMessage(null);
      setShowPassword(false);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!formData.full_name.trim()) {
      setErrorMessage('يرجى إدخال اسم الموظف بالكامل');
      return;
    }

    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMessage('يرجى إدخال بريد إلكتروني صالح');
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      setErrorMessage('كلمة المرور يجب أن تتكون من 6 أحرف أو أرقام على الأقل');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'فشل في إضافة الموظف، يرجى المحاولة مرة أخرى');
      }

      onStaffAdded(result.staff);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="invite-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                إضافة موظف جديد للفريق
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                إنشاء حساب موظف وتحديد صلاحياته ومسؤولياته في النظام
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-6 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-200 flex items-center gap-3 text-xs">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              الاسم بالكامل <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="أحمد محمد علي"
                className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-4 py-2.5 pr-10 text-slate-900 dark:text-white text-sm outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              البريد الإلكتروني <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                required
                dir="ltr"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="staff@khedewy.com"
                className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-4 py-2.5 pl-10 text-slate-900 dark:text-white text-sm outline-none transition text-left placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">يُستخدم هذا البريد لتسجيل دخول الموظف إلى لوحة التحكم.</p>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              رقم الهاتف المحمول (اختياري)
            </label>
            <div className="relative">
              <input
                type="tel"
                dir="ltr"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="01012345678"
                className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-4 py-2.5 pl-10 text-slate-900 dark:text-white text-sm outline-none transition text-left placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              كلمة المرور المؤقتة <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-4 py-2.5 pr-10 pl-10 text-slate-900 dark:text-white text-sm outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">6 خانات على الأقل (يمكن للموظف تغييرها لاحقاً).</p>
          </div>

          {/* Role Selector Pills */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              الدور الوظيفي والصلاحيات <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Order Agent */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'order_agent' })}
                className={cn(
                  'flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-200',
                  formData.role === 'order_agent'
                    ? 'bg-blue-500/15 border-blue-500/50 text-blue-700 dark:text-white shadow-xs shadow-blue-500/10'
                    : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center mb-1.5',
                    formData.role === 'order_agent'
                      ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  )}
                >
                  <Pizza className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold block">مسؤول الطلبات</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">المطبخ والأوردرات</span>
              </button>

              {/* Support Agent */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'support_agent' })}
                className={cn(
                  'flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-200',
                  formData.role === 'support_agent'
                    ? 'bg-purple-500/15 border-purple-500/50 text-purple-700 dark:text-white shadow-xs shadow-purple-500/10'
                    : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center mb-1.5',
                    formData.role === 'support_agent'
                      ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  )}
                >
                  <Headphones className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold block">خدمة العملاء</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">الشكاوى والمحادثات</span>
              </button>

              {/* Admin */}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'admin' })}
                className={cn(
                  'flex flex-col items-center text-center p-3 rounded-2xl border transition-all duration-200',
                  formData.role === 'admin'
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-white shadow-xs shadow-amber-500/10'
                    : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center mb-1.5',
                    formData.role === 'admin'
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  )}
                >
                  <Crown className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold block">مدير النظام</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">صلاحيات كاملة 👑</span>
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <UserPlus className="w-4 h-4" />
              {isSubmitting ? 'جارِ إنشاء الحساب...' : 'إضافة الموظف الآن'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
