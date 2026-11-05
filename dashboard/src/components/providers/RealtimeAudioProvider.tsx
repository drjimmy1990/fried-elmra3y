'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ShoppingBag, AlertTriangle, CalendarClock, X } from 'lucide-react';
import { Database, UserRole } from '@/types/database.types';
import { parseScheduleMeta } from '@/lib/scheduled-orders';
import { formatDateTime } from '@/lib/utils';

type OrderRow = Database['public']['Tables']['orders']['Row'];
type ComplaintRow = Database['public']['Tables']['complaints']['Row'];

export interface AlertNotification {
  id: string;
  type: 'order' | 'complaint' | 'scheduled_order';
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

// Repeated two-tone Web Audio chime synthesizer fallback (longer ~3.6s alert)
function synthesizeChime() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const baseNow = ctx.currentTime;

    for (let i = 0; i < 4; i++) {
      const offset = i * 0.85;

      // First note: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, baseNow + offset);
      gain1.gain.setValueAtTime(0.35, baseNow + offset);
      gain1.gain.exponentialRampToValueAtTime(0.0001, baseNow + offset + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(baseNow + offset);
      osc1.stop(baseNow + offset + 0.35);

      // Second note: A5 (880.00 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.0, baseNow + offset + 0.18);
      gain2.gain.setValueAtTime(0.4, baseNow + offset + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.0001, baseNow + offset + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(baseNow + offset + 0.18);
      osc2.stop(baseNow + offset + 0.65);
    }
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

  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const setIsMuted = useCallback((muted: boolean) => {
    setIsMutedState(muted);
    if (muted && activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
      } catch {}
    }
    try {
      localStorage.setItem('khedewy_sound_muted', muted ? 'true' : 'false');
    } catch {}
  }, []);

  const playChime = useCallback((force = false) => {
    if (isMutedRef.current && !force) return;

    try {
      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.pause();
          activeAudioRef.current.currentTime = 0;
        } catch {}
      }
      const audio = new Audio('/sounds/order-alert.mp3?v=2');
      audio.volume = 0.85;
      activeAudioRef.current = audio;
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

  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const seenComplaintIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();
    let activeChannel: ReturnType<typeof supabase.channel> | null = null;

    // Filter events based on staff role
    const listenToOrders = role !== 'support_agent';
    const listenToComplaints = role !== 'order_agent';

    const triggerOrderAlert = (newOrder: Partial<OrderRow>) => {
      if (!newOrder.id || seenOrderIdsRef.current.has(newOrder.id)) return;
      seenOrderIdsRef.current.add(newOrder.id);

      const orderNum = newOrder.order_number || 'جديد';
      const amount = newOrder.total_amount ? Number(newOrder.total_amount).toFixed(2) : '0';
      const customer = newOrder.customer_name || 'عميل';

      const notification: AlertNotification = {
        id: `order-${newOrder.id}`,
        type: 'order',
        title: `طلب جديد رقم #${orderNum} 🍗`,
        message: `طلب جديد بقيمة ${amount} ج.م للعميل ${customer}`,
        href: '/orders',
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
    };

    const triggerComplaintAlert = (newComplaint: Partial<ComplaintRow>) => {
      if (!newComplaint.id || seenComplaintIdsRef.current.has(newComplaint.id)) return;
      seenComplaintIdsRef.current.add(newComplaint.id);

      const customer = newComplaint.customer_name || 'عميل';
      const ticketNum = newComplaint.ticket_number || '';

      const notification: AlertNotification = {
        id: `complaint-${newComplaint.id}`,
        type: 'complaint',
        title: `شكوى جديدة ${ticketNum ? `(#${ticketNum})` : ''} ⚠️`,
        message: `شكوى جديدة من العميل ${customer}!`,
        href: '/complaints',
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
    };

    let baselineInitialized = false;
    const mountedAtIso = new Date(Date.now() - 15000).toISOString();

    const pollRecentAlerts = async () => {
      if (!isMounted) return;
      try {
        if (!baselineInitialized) {
          const [ordersRes, complaintsRes] = await Promise.all([
            listenToOrders
              ? supabase
                  .from('orders')
                  .select('id')
                  .order('created_at', { ascending: false })
                  .limit(50)
              : Promise.resolve({ data: [] as { id: string }[] }),
            listenToComplaints
              ? supabase
                  .from('complaints')
                  .select('id')
                  .order('created_at', { ascending: false })
                  .limit(50)
              : Promise.resolve({ data: [] as { id: string }[] }),
          ]);

          (ordersRes.data || []).forEach((o) => seenOrderIdsRef.current.add(o.id));
          (complaintsRes.data || []).forEach((c) => seenComplaintIdsRef.current.add(c.id));
          baselineInitialized = true;
          return;
        }

        if (listenToOrders) {
          const { data: recentOrders } = await supabase
            .from('orders')
            .select('id, order_number, customer_name, total_amount, created_at')
            .gte('created_at', mountedAtIso)
            .order('created_at', { ascending: true })
            .limit(15);

          if (recentOrders && isMounted) {
            for (const ord of recentOrders) {
              if (!seenOrderIdsRef.current.has(ord.id)) {
                triggerOrderAlert(ord);
              }
            }
          }
        }

        if (listenToComplaints) {
          const { data: recentComplaints } = await supabase
            .from('complaints')
            .select('id, ticket_number, customer_name, created_at')
            .gte('created_at', mountedAtIso)
            .order('created_at', { ascending: true })
            .limit(15);

          if (recentComplaints && isMounted) {
            for (const comp of recentComplaints) {
              if (!seenComplaintIdsRef.current.has(comp.id)) {
                triggerComplaintAlert(comp);
              }
            }
          }
        }
      } catch {}
    };

    const initRealtime = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          supabase.realtime.setAuth(session.access_token);
        }
      } catch {}

      await pollRecentAlerts();
      if (!isMounted) return;

      const channelName = `realtime_dashboard_alerts_${Date.now()}`;
      activeChannel = supabase.channel(channelName);

      if (listenToOrders) {
        activeChannel.on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders' },
          (payload) => {
            if (!isMounted) return;
            triggerOrderAlert(payload.new as OrderRow);
          }
        );
      }

      if (listenToComplaints) {
        activeChannel.on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'complaints' },
          (payload) => {
            if (!isMounted) return;
            triggerComplaintAlert(payload.new as ComplaintRow);
          }
        );
      }

      activeChannel.subscribe();
    };

    initRealtime();
    const pollInterval = setInterval(pollRecentAlerts, 5000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [playChime, role]);

  // Periodic watcher for Scheduled Orders reaching their preparation alert window
  const alertedScheduledMapRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    if (role === 'support_agent') return;
    const supabase = createClient();

    const checkScheduledOrders = async () => {
      try {
        const { data } = await supabase
          .from('orders')
          .select('id, order_number, customer_name, total_amount, payment_method')
          .like('payment_method', 'scheduled|%');

        if (!data || data.length === 0) return;
        const now = new Date();

        for (const ord of data) {
          const meta = parseScheduleMeta(ord.payment_method, now);
          if (!meta.isScheduled || !meta.isAlertDue || !meta.scheduledFor) continue;

          // Re-alert every 10 minutes until staff sends the scheduled order to the kitchen
          const lastAlertedAt = alertedScheduledMapRef.current.get(ord.id) || 0;
          if (now.getTime() - lastAlertedAt < 10 * 60 * 1000) continue;

          alertedScheduledMapRef.current.set(ord.id, now.getTime());

          const deliveryTimeFormatted = formatDateTime(meta.scheduledFor);
          const notification: AlertNotification = {
            id: `sched-${ord.id}-${now.getTime()}`,
            type: 'scheduled_order',
            title: `⏰ حان موعد تحضير طلب مجدول #${ord.order_number}`,
            message: `العميل: ${ord.customer_name} — موعد التوصيل الفعلي: ${deliveryTimeFormatted}`,
            href: '/scheduled-orders',
            timestamp: now,
          };

          playChime();
          setNotifications((prev) => [notification, ...prev.slice(0, 4)]);

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
                tag: `sched-${ord.id}`,
              });
              nativeNotif.onclick = () => {
                window.focus();
                window.location.href = notification.href;
              };
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Scheduled orders check error:', err);
      }
    };

    checkScheduledOrders();
    const interval = setInterval(checkScheduledOrders, 30000);
    return () => clearInterval(interval);
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
                  : item.type === 'scheduled_order'
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                  : 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
              }`}
            >
              {item.type === 'order' ? (
                <ShoppingBag className="h-5 w-5" />
              ) : item.type === 'scheduled_order' ? (
                <CalendarClock className="h-5 w-5" />
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
                  <span>
                    {item.type === 'order'
                      ? 'عرض الطلب'
                      : item.type === 'scheduled_order'
                      ? 'فتح الطلب المجدول 📅'
                      : 'عرض الشكوى'}
                  </span>
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
