'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Crown,
  Pizza,
  Headphones,
  UserPlus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Phone,
  Mail,
  Calendar,
  Trash2,
  Filter,
  Check,
  ChevronDown,
  UserCheck,
  UserX,
} from 'lucide-react';
import { StaffMember, UserRole, StaffRoleFilter, ROLE_CONFIGS } from './types';
import { InviteStaffModal } from './InviteStaffModal';
import { cn } from '@/lib/utils';

interface TeamManagerProps {
  initialStaff: StaffMember[];
  currentUserId: string;
}

export function TeamManager({ initialStaff, currentUserId }: TeamManagerProps) {
  const [staffList, setStaffList] = useState<StaffMember[]>(initialStaff);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRoleFilter>('all');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Deletion Confirmation Modal State
  const [staffToDelete, setStaffToDelete] = useState<StaffMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Active updating tracker to avoid duplicate clicks
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Keyboard accessibility & body scroll lock for delete confirmation modal
  useEffect(() => {
    if (!staffToDelete) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setStaffToDelete(null);
      }
    };
    const prevOverflow = document.body.style.overflow;
    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [staffToDelete]);

  // 1. KPI Counts
  const stats = useMemo(() => {
    const totalStaff = staffList.length;
    const admins = staffList.filter((s) => s.role === 'admin').length;
    const orderAgents = staffList.filter((s) => s.role === 'order_agent').length;
    const supportAgents = staffList.filter((s) => s.role === 'support_agent').length;
    const activeStaff = staffList.filter((s) => s.is_active).length;

    return { totalStaff, admins, orderAgents, supportAgents, activeStaff };
  }, [staffList]);

  // 2. Filtered Staff List
  const filteredStaff = useMemo(() => {
    return staffList.filter((staff) => {
      // Role filter
      if (roleFilter !== 'all' && staff.role !== roleFilter) {
        return false;
      }

      // Search query (name, phone, email)
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const nameMatch = staff.full_name?.toLowerCase().includes(query);
        const phoneMatch = staff.phone?.toLowerCase().includes(query);
        const emailMatch = staff.email?.toLowerCase().includes(query);
        if (!nameMatch && !phoneMatch && !emailMatch) {
          return false;
        }
      }

      return true;
    });
  }, [staffList, roleFilter, searchQuery]);

  // Handle Role Change (Optimistic Update)
  const handleRoleChange = async (targetStaff: StaffMember, newRole: UserRole) => {
    if (targetStaff.role === newRole) return;

    if (targetStaff.id === currentUserId && newRole !== 'admin') {
      showToast('error', 'لا يمكنك سحب صلاحيات الإدارة عن حسابك الشخصي الحالي');
      return;
    }

    const previousRole = targetStaff.role;
    setUpdatingId(targetStaff.id);

    // Optimistic Update
    setStaffList((prev) =>
      prev.map((s) => (s.id === targetStaff.id ? { ...s, role: newRole } : s))
    );

    try {
      const res = await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetStaff.id, role: newRole }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تحديث الدور الوظيفي');
      }

      showToast('success', `تم تغيير دور (${targetStaff.full_name}) إلى ${ROLE_CONFIGS[newRole].shortLabel} بنجاح`);
    } catch (err: any) {
      // Rollback on failure
      setStaffList((prev) =>
        prev.map((s) => (s.id === targetStaff.id ? { ...s, role: previousRole } : s))
      );
      showToast('error', err.message || 'حدث خطأ أثناء تغيير الدور');
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Active Status Toggle (Optimistic Update)
  const handleToggleActive = async (targetStaff: StaffMember) => {
    if (targetStaff.id === currentUserId) {
      showToast('error', 'لا يمكنك تعطيل حسابك الشخصي أثناء تسجيل الدخول كمدير للنظام');
      return;
    }

    const newActiveState = !targetStaff.is_active;
    setUpdatingId(targetStaff.id);

    // Optimistic Update
    setStaffList((prev) =>
      prev.map((s) => (s.id === targetStaff.id ? { ...s, is_active: newActiveState } : s))
    );

    try {
      const res = await fetch('/api/team', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: targetStaff.id, is_active: newActiveState }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل تحديث حالة الحساب');
      }

      showToast(
        'success',
        newActiveState
          ? `تم تفعيل حساب الموظف (${targetStaff.full_name}) بنجاح`
          : `تم تعليق حساب الموظف (${targetStaff.full_name}) مؤقتاً`
      );
    } catch (err: any) {
      // Rollback on failure
      setStaffList((prev) =>
        prev.map((s) => (s.id === targetStaff.id ? { ...s, is_active: !newActiveState } : s))
      );
      showToast('error', err.message || 'حدث خطأ أثناء تحديث حالة النشاط');
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Staff Deletion
  const handleDeleteStaff = async () => {
    if (!staffToDelete) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/team?id=${staffToDelete.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل حذف الموظف');
      }

      setStaffList((prev) => prev.filter((s) => s.id !== staffToDelete.id));
      showToast('success', `تم حذف حساب (${staffToDelete.full_name}) بنجاح`);
      setStaffToDelete(null);
    } catch (err: any) {
      showToast('error', err.message || 'حدث خطأ أثناء محاولة الحذف');
    } finally {
      setIsDeleting(false);
    }
  };

  // Callback when a staff member is invited
  const handleStaffAdded = (newStaff: StaffMember) => {
    setStaffList((prev) => [newStaff, ...prev]);
    showToast('success', `تم إضافة (${newStaff.full_name}) بنجاح إلى فريق العمل 🎉`);
  };

  // Helper for Initials
  const getInitials = (name: string) => {
    if (!name) return 'م';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2);
    return `${parts[0][0]}${parts[1][0]}`;
  };

  return (
    <div className="space-y-8">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          role="alert"
          className={cn(
            'fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4',
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border border-emerald-500/40'
              : 'bg-rose-950/90 text-rose-200 border border-rose-500/40'
          )}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span className="text-sm font-semibold">{toastMessage.text}</span>
        </div>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">إدارة فريق العمل والصلاحيات</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            إدارة حسابات الوكلاء، أدوار التشغيل (RBAC)، وتفعيل أو تعليق وصول الموظفين
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsInviteModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition-all duration-200 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          إضافة موظف جديد
        </button>
      </div>

      {/* 1. Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Staff */}
        <div className="bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">إجمالي فريق العمل</span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.totalStaff}</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">({stats.activeStaff} نشط)</span>
          </div>
        </div>

        {/* Admins */}
        <div className="bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">المديرون 👑</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
              <Crown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.admins}</span>
          </div>
        </div>

        {/* Order Agents */}
        <div className="bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">مسؤولو الطلبات 🍕</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center">
              <Pizza className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.orderAgents}</span>
          </div>
        </div>

        {/* Support Agents */}
        <div className="bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">خدمة العملاء 🎧</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20 flex items-center justify-center">
              <Headphones className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{stats.supportAgents}</span>
          </div>
        </div>
      </div>

      {/* 2. Filters & Search Bar */}
      <div className="bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Role Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap',
              roleFilter === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-100 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
            )}
          >
            الكل ({stats.totalStaff})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('admin')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap',
              roleFilter === 'admin'
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40'
                : 'bg-slate-100 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
            )}
          >
            المديرون 👑 ({stats.admins})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('order_agent')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap',
              roleFilter === 'order_agent'
                ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/40'
                : 'bg-slate-100 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
            )}
          >
            مسؤولو الطلبات 🍕 ({stats.orderAgents})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter('support_agent')}
            className={cn(
              'px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap',
              roleFilter === 'support_agent'
                ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40'
                : 'bg-slate-100 dark:bg-slate-950/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
            )}
          >
            خدمة العملاء 🎧 ({stats.supportAgents})
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو الهاتف..."
            className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-700/80 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl px-4 py-2 pr-9 text-xs text-slate-900 dark:text-white outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* 3. Staff Members Table */}
      <div className="bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-2xl shadow-xs overflow-hidden">
        {filteredStaff.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-700 dark:text-slate-300">لا يوجد موظفون يطابقون خيارات البحث</p>
            <p className="text-xs text-slate-500 mt-1">جرّب تغيير فلتر الدور أو مسح نص البحث</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40 text-xs font-bold text-slate-500 dark:text-slate-400">
                  <th className="py-4 px-6">الموظف</th>
                  <th className="py-4 px-6">الدور الوظيفي والصلاحيات</th>
                  <th className="py-4 px-6">حالة الحساب</th>
                  <th className="py-4 px-6">تاريخ الانضمام</th>
                  <th className="py-4 px-6 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80">
                {filteredStaff.map((staff) => {
                  const roleConfig = ROLE_CONFIGS[staff.role] || ROLE_CONFIGS.order_agent;
                  const isCurrent = staff.id === currentUserId;
                  const isBusy = updatingId === staff.id;

                  return (
                    <tr
                      key={staff.id}
                      className={cn(
                        'hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors',
                        !staff.is_active && 'opacity-60 bg-slate-50/40 dark:bg-slate-950/30'
                      )}
                    >
                      {/* Name & Avatar */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3.5">
                          <div className="relative">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-950 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-sm font-bold text-amber-600 dark:text-amber-400 shadow-inner">
                              {staff.avatar_url ? (
                                <img
                                  src={staff.avatar_url}
                                  alt={staff.full_name}
                                  className="w-full h-full rounded-2xl object-cover"
                                />
                              ) : (
                                <span>{getInitials(staff.full_name)}</span>
                              )}
                            </div>
                            <span
                              className={cn(
                                'absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900',
                                staff.is_active ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-500'
                              )}
                              title={staff.is_active ? 'نشط' : 'معطل'}
                            />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white text-sm">{staff.full_name}</span>
                              {isCurrent && (
                                <span className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                                  أنت (الحساب الحالي)
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {staff.phone && (
                                <span className="flex items-center gap-1 font-mono text-[11px]" dir="ltr">
                                  <Phone className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                  {staff.phone}
                                </span>
                              )}
                              {staff.email && (
                                <span className="flex items-center gap-1 font-mono text-[11px]" dir="ltr">
                                  <Mail className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                                  {staff.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role Dropdown / Selector */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className="relative inline-block text-right">
                            <select
                              disabled={isBusy || (isCurrent && staff.role === 'admin')}
                              value={staff.role}
                              onChange={(e) => handleRoleChange(staff, e.target.value as UserRole)}
                              className={cn(
                                'appearance-none font-bold text-xs rounded-xl px-3 py-1.5 pr-8 border transition cursor-pointer outline-none',
                                roleConfig.badgeClass,
                                isCurrent && staff.role === 'admin' && 'cursor-not-allowed opacity-90'
                              )}
                            >
                              <option value="admin" className="bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300">
                                مدير النظام 👑
                              </option>
                              <option value="order_agent" className="bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300">
                                مسؤول الطلبات 🍕
                              </option>
                              <option value="support_agent" className="bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300">
                                خدمة العملاء 🎧
                              </option>
                            </select>
                            <ChevronDown className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                          </div>
                        </div>
                      </td>

                      {/* Active Status Switch */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <label
                            className={cn(
                              'relative inline-flex items-center select-none',
                              isCurrent ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                            )}
                            title={isCurrent ? 'لا يمكنك تعطيل حسابك الشخصي' : ''}
                          >
                            <input
                              type="checkbox"
                              disabled={isBusy || isCurrent}
                              checked={staff.is_active}
                              onChange={() => handleToggleActive(staff)}
                              className="sr-only peer"
                            />
                            <div className="w-10 h-5 bg-slate-200 dark:bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                          </label>
                          <span
                            className={cn(
                              'text-xs font-semibold',
                              staff.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'
                            )}
                          >
                            {staff.is_active ? 'نشط' : 'معلق'}
                          </span>
                        </div>
                      </td>

                      {/* Join Date */}
                      <td className="py-4 px-6 text-xs text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                          <span>
                            {new Date(staff.created_at).toLocaleDateString('ar-EG', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-center">
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => setStaffToDelete(staff)}
                            title="حذف الموظف"
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                        {isCurrent && (
                          <span className="text-slate-400 dark:text-slate-600 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Staff Modal */}
      <InviteStaffModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onStaffAdded={handleStaffAdded}
      />

      {/* Delete Confirmation Modal */}
      {staffToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setStaffToDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#101726] border border-slate-200/90 dark:border-slate-700/80 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">تأكيد حذف حساب الموظف</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف حساب الموظف{' '}
              <strong className="text-slate-900 dark:text-white">({staffToDelete.full_name})</strong>؟ لن يتمكن من تسجيل الدخول بعد الآن، وسيتم تحرير أي مهام مسندة إليه.
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteStaff}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20 transition disabled:opacity-50"
              >
                {isDeleting ? 'جارِ الحذف...' : 'نعم، حذف الحساب'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
