'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeAudio } from '@/components/providers/RealtimeAudioProvider';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  Menu,
  LogOut,
  User,
  Bot,
  Volume2,
  VolumeX,
  Loader2,
  ShieldCheck,
  Headphones,
  ShoppingBag,
} from 'lucide-react';
import { UserRole } from '@/types/database.types';

interface TopbarProps {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    avatar_url?: string | null;
  };
  botEnabled?: boolean;
  onToggleSidebar: () => void;
}

export function Topbar({ user, botEnabled = true, onToggleSidebar }: TopbarProps) {
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const { isMuted, setIsMuted, playChime } = useRealtimeAudio();

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setSigningOut(false);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return {
          label: 'مدير النظام 👑',
          icon: ShieldCheck,
          className:
            'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30',
        };
      case 'order_agent':
        return {
          label: 'مسؤول الطلبات 🍗',
          icon: ShoppingBag,
          className:
            'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30',
        };
      case 'support_agent':
        return {
          label: 'خدمة العملاء 🎧',
          icon: Headphones,
          className:
            'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/30',
        };
      default:
        return {
          label: role,
          icon: User,
          className: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
        };
    }
  };

  const roleInfo = getRoleBadge(user.role);
  const RoleIcon = roleInfo.icon;

  return (
    <header className="sticky top-0 z-30 flex h-20 w-full items-center justify-between border-b border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-[#0E1424]/90 px-4 backdrop-blur-md sm:px-6 transition-colors duration-200">
      {/* Right Side: Mobile menu hamburger + Bot Status */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 lg:hidden"
          aria-label="فتح القائمة الجانبية"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Bot Status Indicator */}
        <div className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700/80 bg-slate-100/90 dark:bg-[#121B2D] px-3 py-1.5 text-xs shadow-xs">
          <div className="relative flex h-2.5 w-2.5 items-center justify-center">
            {botEnabled ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </>
            ) : (
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
            )}
          </div>
          <Bot className="h-4 w-4 text-slate-500 dark:text-slate-400 hidden sm:inline" />
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            {botEnabled ? (
              <span className="text-emerald-600 dark:text-emerald-400">البوت: نشط</span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400">البوت: متوقف</span>
            )}
          </span>
        </div>

        {/* Sound alerts mute/unmute toggle */}
        <button
          type="button"
          onClick={() => {
            if (isMuted) {
              setIsMuted(false);
              playChime();
            } else {
              setIsMuted(true);
            }
          }}
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition ${
            isMuted
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
          aria-label={isMuted ? 'تفعيل أصوات التنبيهات' : 'كتم أصوات التنبيهات'}
          title={isMuted ? 'تفعيل أصوات التنبيهات' : 'كتم أصوات التنبيهات'}
        >
          {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          <span className="hidden md:inline">{isMuted ? 'الصوت مكتوم' : 'الصوت مفعل'}</span>
        </button>
      </div>

      {/* Left Side: Theme Toggle, Role Pill, User Profile, Sign-Out */}
      <div className="flex items-center gap-2.5 sm:gap-3.5">
        {/* Theme Toggle (Light / Dark) */}
        <ThemeToggle />

        {/* Role Pill Badge */}
        <div
          className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${roleInfo.className}`}
        >
          <RoleIcon className="h-3.5 w-3.5" />
          <span>{roleInfo.label}</span>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-2.5">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.full_name}
              className="h-9 w-9 rounded-full border border-slate-300 dark:border-slate-700 object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 font-bold text-white shadow-xs">
              {user.full_name ? user.full_name.charAt(0) : <User className="h-4 w-4" />}
            </div>
          )}

          <div className="hidden flex-col text-right sm:flex">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
              {user.full_name || 'مستخدم النظام'}
            </span>
            <span className="text-[11px] text-slate-500 font-mono" dir="ltr">
              {user.email}
            </span>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-500 transition disabled:opacity-50"
          title="تسجيل الخروج"
        >
          {signingOut ? (
            <Loader2 className="h-4 w-4 animate-spin text-rose-400" />
          ) : (
            <LogOut className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          )}
          <span className="hidden sm:inline">{signingOut ? 'جاري الخروج...' : 'خروج'}</span>
        </button>
      </div>
    </header>
  );
}
