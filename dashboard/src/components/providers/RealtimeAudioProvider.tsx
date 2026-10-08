'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ShoppingBag, AlertTriangle, X, Volume2, VolumeX, CheckCircle2 } from 'lucide-react';
import { Database } from '@/types/database.types';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type ComplaintRow = Database['public']['Tables']['complaints']['Row'];

export interface AlertNotification {
  id: string;
  type: 'order' | 'complaint';
  title: string;
  message: string;
  href: string;
  timestamp: Date;
}

interface RealtimeAudioContextType {
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  playChime: () => void;
  notifications: AlertNotification[];
  dismissNotification: (id: string) => void;
}

const RealtimeAudioContext = createContext<RealtimeAudioContextType | undefined>(undefined);

export function useRealtimeAudio() {
  const context = useContext(RealtimeAudioContext);
  if (!context) {
    throw new Error('useRealtimeAudio must be used within a RealtimeAudioProvider');
  }
  return context;
}

// Two-tone Web Audio chime synthesizer
function synthesizeChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // First note: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second note: A5 (880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.15);
    gain2.gain.setValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.warn('Synthesized audio chime failed:', err);
  }
}

export function RealtimeAudioProvider({ children }: { children: React.ReactNode }) {
  const [isMuted, setIsMuted] = useState(false);
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const playChime = useCallback(() => {
    if (isMutedRef.current) return;

    // Primary: Synthesize two-tone melodious chime via Web Audio API
    synthesizeChime();

    // Secondary: Also try playing public HTML audio file if browser allows
    try {
      const audio = new Audio('/sounds/order-alert.mp3');
      audio.volume = 0.6;
      audio.play().catch(() => {
        // Autoplay may be blocked before interaction, handled gracefully
      });
    } catch {
      // Audio element creation fallback
    }
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // Subscribe to Postgres Changes on orders and complaints
    const channel = supabase
      .channel('realtime-dashboard-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const newOrder = payload.new as OrderRow;
          const orderNum = newOrder.order_number || 'جديد';
          const amount = newOrder.total_amount ? Number(newOrder.total_amount).toFixed(2) : '0';
          const customer = newOrder.customer_name || 'عميل';

          const notification: AlertNotification = {
            id: `order-${newOrder.id || Date.now()}`,
            type: 'order',
            title: `طلب جديد رقم #${orderNum}`,
            message: `طلب جديد رقم #${orderNum} بقيمة ${amount} ج.م للعميل ${customer}`,
            href: '/dashboard/orders',
            timestamp: new Date(),
          };

          setNotifications((prev) => [notification, ...prev.slice(0, 4)]);
          playChime();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'complaints' },
        (payload) => {
          const newComplaint = payload.new as ComplaintRow;
          const customer = newComplaint.customer_name || 'عميل';
          const ticketNum = newComplaint.ticket_number || '';

          const notification: AlertNotification = {
            id: `complaint-${newComplaint.id || Date.now()}`,
            type: 'complaint',
            title: `شكوى جديدة ${ticketNum ? `(#${ticketNum})` : ''}`,
            message: `شكوى جديدة من ${customer}!`,
            href: '/dashboard/complaints',
            timestamp: new Date(),
          };

          setNotifications((prev) => [notification, ...prev.slice(0, 4)]);
          playChime();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playChime]);

  // Auto-dismiss notifications after 9 seconds
  useEffect(() => {
    if (notifications.length === 0) return;
    const timer = setTimeout(() => {
      setNotifications((prev) => (prev.length > 0 ? prev.slice(0, prev.length - 1) : prev));
    }, 9000);
    return () => clearTimeout(timer);
  }, [notifications]);

  return (
    <RealtimeAudioContext.Provider
      value={{
        isMuted,
        setIsMuted,
        playChime,
        notifications,
        dismissNotification,
      }}
    >
      {children}

      {/* Floating Realtime Alerts Toast Stack */}
      <div
        dir="rtl"
        className="fixed top-4 left-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
        aria-live="polite"
      >
        {notifications.map((item) => (
          <div
            key={item.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xl ring-1 ring-black/5 transition-all animate-in slide-in-from-top-2"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                item.type === 'order'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}
            >
              {item.type === 'order' ? (
                <ShoppingBag className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
              <p className="mt-0.5 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {item.message}
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <Link
                  href={item.href}
                  onClick={() => dismissNotification(item.id)}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 transition"
                >
                  <span>{item.type === 'order' ? 'عرض الطلب' : 'عرض الشكوى'}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => dismissNotification(item.id)}
                  className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 transition"
                >
                  إغلاق
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => dismissNotification(item.id)}
              className="text-slate-400 hover:text-slate-600 p-1"
              aria-label="إغلاق التنبيه"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </RealtimeAudioContext.Provider>
  );
}
