'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeAudio } from '@/components/providers/RealtimeAudioProvider';
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
            'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-400/20',
        };
      case 'order_agent':
        return {
          label: 'مسؤول الطلبات 🛍️',
          icon: ShoppingBag,
          className:
            'bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-blue-400/20',
        };
      case 'support_agent':
        return {
          label: 'خدمة العملاء 🎧',
          icon: Headphones,
          className:
            'bg-purple-50 text-purple-800 border-purple-300 ring-1 ring-purple-400/20',
        };
      default:
        return {
          label: role,
          icon: User,
          className: 'bg-slate-100 text-slate-700 border-slate-300',
        };
    }
  };

  const roleInfo = getRoleBadge(user.role);
  const RoleIcon = roleInfo.icon;

  return (
    <header className="sticky top-0 z-30 flex h-20 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md sm:px-6">
      {/* Right Side: Mobile menu hamburger + Bot Status */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 lg:hidden"
          aria-label="فتح القائمة الجانبية"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Bot Status Indicator */}
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
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
          <Bot className="h-4 w-4 text-slate-500 hidden sm:inline" />
          <span className="font-medium text-slate-700">
            {botEnabled ? (
              <span className="text-emerald-700">البوت: نشط</span>
            ) : (
              <span className="text-rose-600">البوت: متوقف</span>
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
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition ${
            isMuted
              ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
              : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
          aria-label={isMuted ? 'تفعيل أصوات التنبيهات' : 'كتم أصوات التنبيهات'}
          title={isMuted ? 'تفعيل أصوات التنبيهات' : 'كتم أصوات التنبيهات'}
        >
          {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          <span className="hidden md:inline">{isMuted ? 'الصوت مكتوم' : 'الصوت مفعل'}</span>
        </button>
      </div>

      {/* Left Side: Role Pill, User Profile, Sign-Out */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Role Pill Badge */}
        <div
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${roleInfo.className}`}
        >
          <RoleIcon className="h-3.5 w-3.5" />
          <span>{roleInfo.label}</span>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-3">
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.full_name}
              className="h-10 w-10 rounded-full border border-slate-200 object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-amber-500 to-amber-600 font-bold text-white shadow-xs">
              {user.full_name ? user.full_name.charAt(0) : <User className="h-5 w-5" />}
            </div>
          )}

          <div className="hidden flex-col text-right sm:flex">
            <span className="text-sm font-semibold text-slate-900 leading-tight">
              {user.full_name || 'مستخدم النظام'}
            </span>
            <span className="text-xs text-slate-500 font-mono" dir="ltr">
              {user.email}
            </span>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 transition disabled:opacity-50"
          title="تسجيل الخروج"
        >
          {signingOut ? (
            <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
          ) : (
            <LogOut className="h-4 w-4 text-slate-500 group-hover:text-rose-600" />
          )}
          <span className="hidden sm:inline">{signingOut ? 'جاري الخروج...' : 'خروج'}</span>
        </button>
      </div>
    </header>
  );
}
