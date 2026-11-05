export const DEMO_ACCOUNT_EMAIL = 'test@pr-media.forum';
export const DEMO_COOKIE_NAME = 'khedewy_demo_mode';

export function isDemoUser(
  user?: {
    email?: string | null;
    user_metadata?: Record<string, unknown> | null;
    app_metadata?: Record<string, unknown> | null;
  } | null
): boolean {
  if (!user) return false;
  if ((user.email || '').trim().toLowerCase() === DEMO_ACCOUNT_EMAIL) return true;
  if (user.user_metadata?.is_demo === true || user.app_metadata?.is_demo === true) return true;
  return false;
}

function decodeBase64Safe(str: string): string {
  try {
    const clean = str.replace(/^base64-/, '').replace(/-/g, '+').replace(/_/g, '/');
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(clean, 'base64').toString('utf8');
    }
    if (typeof atob !== 'undefined') {
      return atob(clean);
    }
  } catch {}
  return '';
}

export function isDemoFromCookies(
  cookies: Array<{ name: string; value: string }>
): boolean {
  try {
    const demoFlag = cookies.find((c) => c.name === DEMO_COOKIE_NAME);
    if (demoFlag?.value === '1') return true;
    if (demoFlag?.value === '0') return false;

    const authCookies = cookies.filter(
      (c) => c.name.includes('-auth-token') || c.name.startsWith('sb-')
    );
    if (authCookies.length === 0) return false;

    const combinedRaw = authCookies.map((c) => c.value).join('');
    if (
      combinedRaw.toLowerCase().includes(DEMO_ACCOUNT_EMAIL) ||
      combinedRaw.includes('"is_demo":true')
    ) {
      return true;
    }

    const decoded = decodeBase64Safe(combinedRaw);
    if (
      decoded.toLowerCase().includes(DEMO_ACCOUNT_EMAIL) ||
      decoded.includes('"is_demo":true')
    ) {
      return true;
    }
  } catch {}
  return false;
}

export function isDemoInBrowser(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const pairs = document.cookie
      .split(';')
      .map((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return { name: part.trim(), value: '' };
        return {
          name: part.slice(0, idx).trim(),
          value: decodeURIComponent(part.slice(idx + 1).trim()),
        };
      });
    return isDemoFromCookies(pairs);
  } catch {
    return false;
  }
}

export function maskDemoPhone(phone?: string | null): string {
  if (!phone) return '010•••••000';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 6) {
    return `${digits.slice(0, 3)}•••••${digits.slice(-2)}`;
  }
  return '010•••••000';
}

export function maskDemoName(name?: string | null): string {
  if (!name) return 'عميل (وضع العرض)';
  const trimmed = String(name).trim();
  if (!trimmed) return 'عميل (وضع العرض)';
  const parts = trimmed.split(/\s+/);
  const first = parts[0];
  const secondInitial = parts.length > 1 && parts[1].length > 0 ? ` ${parts[1][0]}.` : '';
  return `${first}${secondInitial} 🔒`;
}

export function maskDemoAddress(address?: string | null): string {
  if (!address) return 'منطقة التوصيل — عنوان محمي في وضع العرض التجريبي 🔒';
  const trimmed = String(address).trim();
  if (!trimmed) return 'منطقة التوصيل — عنوان محمي في وضع العرض التجريبي 🔒';
  const firstZone = trimmed.split(/[،,\-|/]/)[0]?.trim().slice(0, 22) || 'منطقة التوصيل';
  return `${firstZone} — شارع ••••، عمارة ••، شقة •• (بيانات العميل محمية 🔒)`;
}

export function scrubFreeTextPII(text?: string | null): string {
  if (!text) return '';
  return String(text)
    // Mask Egyptian mobile numbers (010/011/012/015 or +201...)
    .replace(/(?:\+?20|0)?1[0125]\d{8}/g, (m) => `${m.slice(0, 3)}•••••${m.slice(-2)}`)
    // Mask any 8+ digit sequences that look like phone numbers or PSIDs
    .replace(/\b\d{8,18}\b/g, (m) => `${m.slice(0, 3)}•••••`)
    // Mask building / floor / apartment numbers in Arabic text
    .replace(/(عمارة|عماره|برج|عقار|شقة|شقه|الدور|دور|فيلا|بوابة|بوابه)\s*([^\s،,|]+)/g, '$1 ••')
    .replace(/(شارع|ش\.)\s+([^\s،,|]+(?:\s+[^\s،,|]+)?)/g, '$1 ••••');
}

const DEMO_PROMPT_PREVIEW = `🔒 [وضع العرض التجريبي — البرومبت الكامل محمي لحماية الملكية الفكرية]

يحتوي هذا القسم في النسخة الفعلية على التوجيهات الكاملة للبوت الذكي (أكثر من 30,000 حرف)، وتشمل:
1. شخصية البوت والترحيب التلقائي باسم العميل.
2. قواعد تحديد الفرع الأقرب للعميل وحساب مصاريف التوصيل تلقائياً حسب المنطقة.
3. قائمة الأسعار والعروض وتقسيمات القطع الثابتة والاختيارية (عادي / سبايسي).
4. قواعد تسجيل الأوردر، تعديل الأوردر المؤكد، وطلبات الإلغاء والشكاوى.

✨ في نسختك الخاصة، يمكنك تعديل وحفظ هذا البرومبت بالكامل من هنا في أي وقت.`;

export function sanitizeDemoPayload(data: unknown, url = ''): unknown {
  if (data === null || data === undefined) return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeDemoPayload(item, url));
  }

  if (typeof data !== 'object') {
    return data;
  }

  const obj = data as Record<string, unknown>;
  const out: Record<string, unknown> = { ...obj };

  // 1. Mask Customer / Contact / Staff personal fields
  if (typeof out.customer_name === 'string') {
    out.customer_name = maskDemoName(out.customer_name);
  }
  if (typeof out.commenter_name === 'string') {
    out.commenter_name = maskDemoName(out.commenter_name);
  }
  if (typeof out.customer_phone === 'string') {
    out.customer_phone = maskDemoPhone(out.customer_phone);
  }
  if (typeof out.phone === 'string') {
    out.phone = maskDemoPhone(out.phone);
  }
  // On contacts table (has platform or external_id or needs_human), mask full_name & external_id
  if ('external_id' in out || 'needs_human' in out || 'platform' in out) {
    if (typeof out.full_name === 'string') {
      out.full_name = maskDemoName(out.full_name);
    }
    if (typeof out.external_id === 'string') {
      out.external_id = `PSID_DEMO_${out.external_id.slice(-4)}`;
    }
  }

  // 2. Mask Delivery Address (keep only on orders, not branch addresses which have is_active & name)
  if (typeof out.delivery_address === 'string') {
    out.delivery_address = maskDemoAddress(out.delivery_address);
  }

  // 3. Scrub PII inside notes, complaints, chat messages, and comments
  if (typeof out.customer_notes === 'string') {
    out.customer_notes = scrubFreeTextPII(out.customer_notes);
  }
  if (typeof out.internal_notes === 'string') {
    out.internal_notes = scrubFreeTextPII(out.internal_notes);
  }
  if (typeof out.issue_description === 'string') {
    out.issue_description = scrubFreeTextPII(out.issue_description);
  }
  if (typeof out.resolution_notes === 'string') {
    out.resolution_notes = scrubFreeTextPII(out.resolution_notes);
  }
  if (typeof out.content === 'string') {
    out.content = scrubFreeTextPII(out.content);
  }
  if (typeof out.comment_text === 'string') {
    out.comment_text = scrubFreeTextPII(out.comment_text);
  }
  if (typeof out.reply_text === 'string') {
    out.reply_text = scrubFreeTextPII(out.reply_text);
  }

  // 4. Mask Meta / Channel secrets & AI System Prompt
  if (typeof out.access_token === 'string' && out.access_token) {
    out.access_token = 'EAAP••••••••••••[PROTECTED_IN_DEMO]';
  }
  if (typeof out.page_access_token === 'string' && out.page_access_token) {
    out.page_access_token = 'EAAP••••••••••••[PROTECTED_IN_DEMO]';
  }
  if (typeof out.app_secret === 'string' && out.app_secret) {
    out.app_secret = '••••••••••••••••[PROTECTED_IN_DEMO]';
  }
  if (typeof out.verify_token === 'string' && out.verify_token) {
    out.verify_token = '••••••[PROTECTED_IN_DEMO]';
  }
  if (typeof out.ai_system_prompt === 'string') {
    out.ai_system_prompt = DEMO_PROMPT_PREVIEW;
  }

  // 5. Recursively sanitize nested relations (e.g. order_items, contact, order)
  for (const key of Object.keys(out)) {
    const val = out[key];
    if (val && typeof val === 'object') {
      out[key] = sanitizeDemoPayload(val, url);
    }
  }

  return out;
}

export function triggerDemoBlockedNotification(customMessage?: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('khedewy:demo-blocked', {
      detail: {
        message:
          customMessage ||
          'وضع العرض التجريبي (للقراءة فقط): هذا الحساب مخصص لمعاينة النظام ولا يقوم بتعديل البيانات الفعلية للمطعم.',
      },
    })
  );
}

export function createDemoAwareFetch(
  getIsDemo: () => boolean
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const isDemo = getIsDemo();
    if (!isDemo) {
      return fetch(input, init);
    }

    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

    const method = (
      init?.method ||
      (typeof input === 'object' && 'method' in input ? input.method : 'GET') ||
      'GET'
    ).toUpperCase();

    const isAuthEndpoint = url.includes('/auth/v1/');
    const isReadOnlyRpc = url.includes('/rest/v1/rpc/get_public_settings');
    const isMutatingMethod =
      method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';

    // Block password/user updates on Auth and all writes to PostgREST / Storage in Demo Mode
    if (
      (isAuthEndpoint && (method === 'PUT' || method === 'PATCH')) ||
      (!isAuthEndpoint && !isReadOnlyRpc && isMutatingMethod)
    ) {
      triggerDemoBlockedNotification();
      return new Response(
        JSON.stringify({
          code: 'DEMO_READ_ONLY',
          message:
            'وضع العرض التجريبي (للقراءة فقط): لا يمكن حفظ أو تعديل البيانات الفعلية بهذا الحساب.',
          details: null,
          hint: null,
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const response = await fetch(input, init);

    // Only sanitize JSON responses from PostgREST (/rest/v1/)
    if (!url.includes('/rest/v1/')) {
      return response;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return response;
    }

    try {
      const cloned = response.clone();
      const rawJson = await cloned.json();
      const sanitized = sanitizeDemoPayload(rawJson, url);
      return new Response(JSON.stringify(sanitized), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch {
      return response;
    }
  };
}
