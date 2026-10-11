'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ShoppingBag, AlertTriangle, X } from 'lucide-react';
import { Database, UserRole } from '@/types/database.types';

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

export interface RealtimeAudioContextType {
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  toggleSound: () => void;
  playChime: (force?: boolean) => void;
  notifications: AlertNotification[];
  dismissNotification: (id: string) => void;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (enabled: boolean) => void;
  toggleNotifications: () => void;
  notificationPermission: NotificationPermission;
  requestNotificationPermission: () => Promise<NotificationPermission>;
}

const RealtimeAudioContext = createContext<RealtimeAudioContextType | undefined>(undefined);

export function useRealtimeAudio() {
  const context = useContext(RealtimeAudioContext);
  if (!context) {
    throw new Error('useRealtimeAudio must be used within a RealtimeAudioProvider');
  }
  return context;
}

// Shared singleton AudioContext to prevent browser AudioContext limit exhaustion
let sharedAudioCtx: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

// Two-tone Web Audio chime synthesizer fallback (louder and crisp)
function synthesizeChime() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // First note: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second note: A5 (880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.0, now + 0.18);
    gain2.gain.setValueAtTime(0.4, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.65);
  } catch (err) {
    console.warn('Synthesized audio chime failed:', err);
  }
}

export function RealtimeAudioProvider({
  children,
  role,
}: {
  children: React.ReactNode;
  role?: UserRole;
}) {
  // Persistent Sound Settings
  const [isMuted, setIsMutedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('khedewy_sound_muted') === 'true';
    } catch {
      return false;
    }
  });

  // Persistent Notification Settings
  const [notificationsEnabled, setNotificationsEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem('khedewy_notifications_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const notificationsEnabledRef = useRef(notificationsEnabled);
  notificationsEnabledRef.current = notificationsEnabled;

  // Initialize permission on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Unlock browser audio autoplay on first interaction
  useEffect(() => {
    const unlockAudio = () => {
      const ctx = getSharedAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      try {
        const dummy = new Audio();
        dummy.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        dummy.play().catch(() => {});
      } catch {}

      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };

    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });

    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  const setIsMuted = useCallback((muted: boolean) => {
    setIsMutedState(muted);
    try {
      localStorage.setItem('khedewy_sound_muted', muted ? 'true' : 'false');
    } catch {}
  }, []);

  const playChime = useCallback((force = false) => {
    if (isMutedRef.current && !force) return;

    try {
      const audio = new Audio('/sounds/order-alert.mp3');
      audio.volume = 0.8;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          synthesizeChime();
        });
      }
    } catch {
      synthesizeChime();
    }
  }, []);

  const toggleSound = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      // Play immediate test chime so user knows sound works
      playChime(true);
    } else {
      setIsMuted(true);
    }
  }, [isMuted, setIsMuted, playChime]);

  const requestNotificationPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        setNotificationsEnabledState(true);
        localStorage.setItem('khedewy_notifications_enabled', 'true');
        // Test notification
        try {
          new Notification('تم تفعيل إشعارات الطلبات 🔔', {
            body: 'ستصلك تنبيهات فورية عند وصول أي أوردر جديد حتى لو المتصفح في الخلفية!',
            icon: '/favicon.ico',
          });
        } catch {}
      } else if (perm === 'denied') {
        setNotificationsEnabledState(false);
        localStorage.setItem('khedewy_notifications_enabled', 'false');
      }
      return perm;
    } catch (err) {
      console.error('Notification permission error:', err);
      return 'denied';
    }
  }, []);

  const setNotificationsEnabled = useCallback((enabled: boolean) => {
    if (enabled && typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
      requestNotificationPermission();
      return;
    }
    setNotificationsEnabledState(enabled);
    try {
      localStorage.setItem('khedewy_notifications_enabled', enabled ? 'true' : 'false');
    } catch {}
  }, [requestNotificationPermission]);

  const toggleNotifications = useCallback(() => {
    if (!notificationsEnabled) {
      setNotificationsEnabled(true);
    } else {
      setNotificationsEnabled(false);
    }
  }, [notificationsEnabled, setNotificationsEnabled]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel('realtime-dashboard-alerts');

    // Filter events based on staff role
    const listenToOrders = role !== 'support_agent';
    const listenToComplaints = role !== 'order_agent';

    if (listenToOrders) {
      channel.on(
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
            title: `طلب جديد رقم #${orderNum} 🍗`,
            message: `طلب جديد بقيمة ${amount} ج.م للعميل ${customer}`,
            href: '/dashboard/orders',
            timestamp: new Date(),
          };

          // 1. Play Chime
          playChime();

          // 2. In-app toast stack
          setNotifications((prev) => [notification, ...prev.slice(0, 4)]);

          // 3. Browser native notification (tab in background / desktop)
          if (
            notificationsEnabledRef.current &&
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            try {
              const nativeNotif = new Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico',
                tag: notification.id,
              });
              nativeNotif.onclick = () => {
                window.focus();
                window.location.href = notification.href;
              };
            } catch (err) {
              console.warn('Native notification failed:', err);
            }
          }
        }
      );
    }

    if (listenToComplaints) {
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'complaints' },
        (payload) => {
          const newComplaint = payload.new as ComplaintRow;
          const customer = newComplaint.customer_name || 'عميل';
          const ticketNum = newComplaint.ticket_number || '';

          const notification: AlertNotification = {
            id: `complaint-${newComplaint.id || Date.now()}`,
            type: 'complaint',
            title: `شكوى جديدة ${ticketNum ? `(#${ticketNum})` : ''} ⚠️`,
            message: `شكوى جديدة من العميل ${customer}!`,
            href: '/dashboard/complaints',
            timestamp: new Date(),
          };

          // 1. Play Chime
          playChime();

          // 2. In-app toast stack
          setNotifications((prev) => [notification, ...prev.slice(0, 4)]);

          // 3. Browser native notification
          if (
            notificationsEnabledRef.current &&
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            try {
              const nativeNotif = new Notification(notification.title, {
                body: notification.message,
                icon: '/favicon.ico',
                tag: notification.id,
              });
              nativeNotif.onclick = () => {
                window.focus();
                window.location.href = notification.href;
              };
            } catch (err) {
              console.warn('Native notification failed:', err);
            }
          }
        }
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playChime, role]);

  // Auto-dismiss in-app toast notifications after 9 seconds
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
        toggleSound,
        playChime,
        notifications,
        dismissNotification,
        notificationsEnabled,
        setNotificationsEnabled,
        toggleNotifications,
        notificationPermission,
        requestNotificationPermission,
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
            className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md ring-1 ring-black/10 transition-all animate-in slide-in-from-top-2"
          >
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                item.type === 'order'
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
              }`}
            >
              {item.type === 'order' ? (
                <ShoppingBag className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-100">{item.title}</h4>
              <p className="mt-0.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {item.message}
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <Link
                  href={item.href}
                  onClick={() => dismissNotification(item.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-500 transition shadow-xs"
                >
                  <span>{item.type === 'order' ? 'عرض الطلب' : 'عرض الشكوى'}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => dismissNotification(item.id)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-800 transition"
                >
                  إغلاق
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => dismissNotification(item.id)}
              className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800 transition"
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
