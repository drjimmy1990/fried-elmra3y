'use client';

import React, { useState, useMemo } from 'react';
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  Globe,
  Bike,
  Edit2,
  Trash2,
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { BranchWithZones, BranchRow } from './types';
import { BranchModal } from './BranchModal';
import { DeliveryZonesModal } from './DeliveryZonesModal';

interface BranchesManagerProps {
  initialBranches: BranchWithZones[];
}

export function BranchesManager({ initialBranches }: BranchesManagerProps) {
  const [branches, setBranches] = useState<BranchWithZones[]>(initialBranches);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [selectedBranchForEdit, setSelectedBranchForEdit] = useState<BranchWithZones | null>(null);

  const [isZonesModalOpen, setIsZonesModalOpen] = useState(false);
  const [selectedBranchForZones, setSelectedBranchForZones] = useState<BranchWithZones | null>(null);

  const supabase = useMemo(() => createClient(), []);

  // Filtered branches
  const filteredBranches = useMemo(() => {
    if (!searchQuery.trim()) return branches;
    const q = searchQuery.trim().toLowerCase();
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.phone && b.phone.includes(q)) ||
        b.address.toLowerCase().includes(q)
    );
  }, [branches, searchQuery]);

  // Handle branch active toggle
  const handleToggleActive = async (branch: BranchWithZones) => {
    const newStatus = !branch.is_active;

    // Optimistic UI update
    setBranches((prev) =>
      prev.map((b) => (b.id === branch.id ? { ...b, is_active: newStatus } : b))
    );

    const { error } = await supabase
      .from('branches')
      .update({ is_active: newStatus, updated_at: new Date().toISOString() })
      .eq('id', branch.id);

    if (error) {
      console.error('Failed to toggle branch status:', error);
      setBranches((prev) =>
        prev.map((b) => (b.id === branch.id ? { ...b, is_active: !newStatus } : b))
      );
      alert('تعذر تحديث حالة الفرع');
    }
  };

  // Handle branch deletion
  const handleDeleteBranch = async (branchId: string, branchName: string) => {
    if (
      !confirm(
        `هل أنت متأكد من حذف ${branchName}؟ سيتم حذف جميع مناطق التوصيل المرتبطة به أيضاً.`
      )
    ) {
      return;
    }

    const prev = [...branches];
    setBranches((b) => b.filter((item) => item.id !== branchId));

    const { error } = await supabase.from('branches').delete().eq('id', branchId);

    if (error) {
      console.error('Failed to delete branch:', error);
      setBranches(prev);
      alert('تعذر حذف الفرع. قد توجد طلبات مسجلة مرتبطة به.');
    }
  };

  // Callback when branch is created or updated
  const handleBranchSaved = (saved: BranchRow) => {
    setBranches((prev) => {
      const exists = prev.some((b) => b.id === saved.id);
      if (exists) {
        return prev.map((b) => (b.id === saved.id ? { ...b, ...saved } : b));
      } else {
        return [{ ...saved, zones_count: 0 }, ...prev];
      }
    });
  };

  // Callback to refresh zones count
  const refreshZonesCount = async () => {
    const { data: zones } = await supabase
      .from('branch_delivery_zones')
      .select('branch_id');

    if (zones) {
      const counts: Record<string, number> = {};
      zones.forEach((z) => {
        counts[z.branch_id] = (counts[z.branch_id] || 0) + 1;
      });

      setBranches((prev) =>
        prev.map((b) => ({
          ...b,
          zones_count: counts[b.id] || 0,
        }))
      );
    }
  };

  // KPI Calculations
  const totalBranches = branches.length;
  const activeBranches = branches.filter((b) => b.is_active).length;
  const totalZones = branches.reduce((sum, b) => sum + (b.zones_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white">إدارة الفروع ومناطق التوصيل</h1>
            <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Building2 className="w-3.5 h-3.5" />
              <span>{totalBranches} فروع</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            إضافة فروع المطعم وتحديد أسعار ومناطق التوصيل الخاصة بكل فرع لتوجيه البوت والأوردرات
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setSelectedBranchForEdit(null);
            setIsBranchModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-amber-950/50 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة فرع جديد</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">إجمالي فروع المطعم</span>
            <div className="text-2xl font-black text-white mt-1">{totalBranches}</div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-800 text-slate-400 border border-slate-700">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-400 font-medium">فروع نشطة ومتاحة للطلب</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">{activeBranches}</div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="rounded-2xl bg-amber-500/5 border border-amber-500/20 p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-amber-400 font-medium">إجمالي مناطق وأحياء التوصيل</span>
            <div className="text-2xl font-black text-amber-400 mt-1">{totalZones}</div>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Bike className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="flex items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-3 rounded-2xl">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم الفرع، العنوان، أو الهاتف..."
            className="w-full rounded-xl bg-slate-950 border border-slate-800 pr-9 pl-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-slate-400 hidden sm:inline">
          عرض {filteredBranches.length} من {branches.length} فرع
        </span>
      </div>

      {/* Branches Grid */}
      {filteredBranches.length === 0 ? (
        <div className="py-20 text-center rounded-3xl bg-slate-900/40 border border-slate-800">
          <Building2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-300">لا توجد فروع مطابقة للبحث</h3>
          <p className="text-xs text-slate-500 mt-1">
            أضف فرعك الأول لبدء تشغيل نظام الفروع والتوصيل الذكي.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBranches.map((branch) => (
            <div
              key={branch.id}
              className={`rounded-3xl border p-5 flex flex-col justify-between transition-all duration-200 ${
                branch.is_active
                  ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700/80 shadow-md'
                  : 'bg-slate-950/60 border-slate-800/40 opacity-75'
              }`}
            >
              <div>
                {/* Branch Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-white">{branch.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            branch.is_active ? 'bg-emerald-500' : 'bg-slate-600'
                          }`}
                        />
                        <span className="text-[11px] text-slate-400">
                          {branch.is_active ? 'متاح للطلب' : 'متوقف حالياً'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Active Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggleActive(branch)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      branch.is_active ? 'bg-emerald-600' : 'bg-slate-700'
                    }`}
                    title={branch.is_active ? 'تعطيل الفرع' : 'تفعيل الفرع'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                        branch.is_active ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Details */}
                <div className="space-y-2 py-3 border-y border-slate-800/60 text-xs">
                  {branch.phone && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <a
                        href={`tel:${branch.phone}`}
                        className="hover:text-amber-300 font-mono"
                        dir="ltr"
                      >
                        {branch.phone}
                      </a>
                    </div>
                  )}

                  <div className="flex items-start gap-2 text-slate-300 leading-relaxed">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-2">{branch.address}</span>
                  </div>

                  {branch.google_maps_url && (
                    <div className="pt-0.5">
                      <a
                        href={branch.google_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                      >
                        <Globe className="w-3 h-3" />
                        <span>فتح على خرائط Google Maps</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer: Delivery Zones Button & Actions */}
              <div className="pt-4 space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBranchForZones(branch);
                    setIsZonesModalOpen(true);
                  }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-slate-200 hover:text-white transition group"
                >
                  <div className="flex items-center gap-2">
                    <Bike className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
                    <span className="text-xs font-semibold">مناطق وأسعار التوصيل</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[11px] font-bold">
                    {branch.zones_count || 0} منطقة
                  </span>
                </button>

                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBranchForEdit(branch);
                      setIsBranchModalOpen(true);
                    }}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                    title="تعديل بيانات الفرع"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteBranch(branch.id, branch.name)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                    title="حذف الفرع"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Branch Modal */}
      <BranchModal
        branch={selectedBranchForEdit}
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        onSaved={handleBranchSaved}
      />

      {/* Delivery Zones Modal */}
      <DeliveryZonesModal
        branch={selectedBranchForZones}
        isOpen={isZonesModalOpen}
        onClose={() => setIsZonesModalOpen(false)}
        onZonesUpdated={refreshZonesCount}
      />
    </div>
  );
}
