export interface ScheduleMeta {
  isScheduled: boolean;
  scheduledFor: string | null;
  scheduledDate: Date | null;
  prepAlertMinutes: number;
  alertAt: Date | null;
  isAlertDue: boolean;
  isOverdue: boolean;
  minutesUntilAlert: number;
  minutesUntilDelivery: number;
}

export const PREP_ALERT_OPTIONS = [
  { value: 30, label: 'قبل الميعاد بـ 30 دقيقة (نصف ساعة)' },
  { value: 45, label: 'قبل الميعاد بـ 45 دقيقة' },
  { value: 60, label: 'قبل الميعاد بـ 60 دقيقة (ساعة كاملة - افتراضي)' },
  { value: 90, label: 'قبل الميعاد بـ 90 دقيقة (ساعة ونصف)' },
  { value: 120, label: 'قبل الميعاد بـ 120 دقيقة (ساعتين)' },
];

export function encodeScheduleMeta(scheduledForIso: string, prepAlertMinutes = 60): string {
  const safeMinutes = Number(prepAlertMinutes) > 0 ? Math.round(Number(prepAlertMinutes)) : 60;
  return `scheduled|${scheduledForIso}|${safeMinutes}`;
}

export function isScheduledPaymentMethod(paymentMethod: string | null | undefined): boolean {
  return typeof paymentMethod === 'string' && paymentMethod.startsWith('scheduled|');
}

export function parseScheduleMeta(
  paymentMethod: string | null | undefined,
  now: Date = new Date()
): ScheduleMeta {
  if (!isScheduledPaymentMethod(paymentMethod)) {
    return {
      isScheduled: false,
      scheduledFor: null,
      scheduledDate: null,
      prepAlertMinutes: 60,
      alertAt: null,
      isAlertDue: false,
      isOverdue: false,
      minutesUntilAlert: 0,
      minutesUntilDelivery: 0,
    };
  }

  const parts = String(paymentMethod).split('|');
  const rawIso = parts[1] || '';
  const prepAlertMinutes = Number(parts[2]) > 0 ? Number(parts[2]) : 60;
  const scheduledDate = rawIso ? new Date(rawIso) : null;

  if (!scheduledDate || isNaN(scheduledDate.getTime())) {
    return {
      isScheduled: true,
      scheduledFor: null,
      scheduledDate: null,
      prepAlertMinutes,
      alertAt: null,
      isAlertDue: false,
      isOverdue: false,
      minutesUntilAlert: 0,
      minutesUntilDelivery: 0,
    };
  }

  const alertAt = new Date(scheduledDate.getTime() - prepAlertMinutes * 60 * 1000);
  const minutesUntilAlert = Math.round((alertAt.getTime() - now.getTime()) / 60000);
  const minutesUntilDelivery = Math.round((scheduledDate.getTime() - now.getTime()) / 60000);

  return {
    isScheduled: true,
    scheduledFor: scheduledDate.toISOString(),
    scheduledDate,
    prepAlertMinutes,
    alertAt,
    isAlertDue: now.getTime() >= alertAt.getTime(),
    isOverdue: now.getTime() >= scheduledDate.getTime(),
    minutesUntilAlert,
    minutesUntilDelivery,
  };
}

export function formatMinutesAr(totalMinutes: number): string {
  const abs = Math.abs(Math.round(totalMinutes));
  if (abs < 1) return 'أقل من دقيقة';
  if (abs < 60) return `${abs} دقيقة`;

  const hours = Math.floor(abs / 60);
  const mins = abs % 60;

  if (hours < 24) {
    const hourLabel =
      hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : hours <= 10 ? `${hours} ساعات` : `${hours} ساعة`;
    return mins > 0 ? `${hourLabel} و ${mins} د` : hourLabel;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  const dayLabel =
    days === 1 ? 'يوم' : days === 2 ? 'يومين' : days <= 10 ? `${days} أيام` : `${days} يوم`;
  if (remHours === 0) return dayLabel;
  const remHourLabel =
    remHours === 1 ? 'ساعة' : remHours === 2 ? 'ساعتين' : `${remHours} س`;
  return `${dayLabel} و ${remHourLabel}`;
}

export function toCairoDateTimeLocalInput(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const hourVal = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hourVal}:${get('minute')}`;
}

export function fromCairoDateTimeLocalInput(localValue: string): string {
  if (!localValue) return new Date().toISOString();
  // Egypt standard time is UTC+02:00
  const withOffset = localValue.length === 16 ? `${localValue}:00+02:00` : `${localValue}+02:00`;
  const parsed = new Date(withOffset);
  return isNaN(parsed.getTime()) ? new Date(localValue).toISOString() : parsed.toISOString();
}
