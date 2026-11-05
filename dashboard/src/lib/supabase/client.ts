import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import {
  createDemoAwareFetch,
  isDemoInBrowser,
  sanitizeDemoPayload,
} from '@/lib/demo-mode';

const DEMO_CHANNEL_PATCHED = Symbol.for('khedewy.demoChannelPatched');

export function createClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  const client = createBrowserClient<Database>(url, key, {
    global: {
      fetch: createDemoAwareFetch(() => isDemoInBrowser()),
    },
  }) as unknown as SupabaseClient<Database> & { [DEMO_CHANNEL_PATCHED]?: boolean };

  // Also sanitize live Realtime postgres_changes payloads when in Demo Mode
  if (typeof client.channel === 'function' && !client[DEMO_CHANNEL_PATCHED]) {
    const origChannel = client.channel.bind(client);
    client.channel = ((...args: Parameters<typeof origChannel>) => {
      const ch = origChannel(...args);
      if (ch && typeof ch.on === 'function') {
        const origOn = ch.on.bind(ch);
        ch.on = ((type: any, filter: any, callback: any) => {
          if (type === 'postgres_changes' && typeof callback === 'function') {
            return origOn(type, filter, (payload: any) => {
              if (!isDemoInBrowser()) {
                return callback(payload);
              }
              return callback({
                ...payload,
                new: payload?.new ? sanitizeDemoPayload(payload.new) : payload?.new,
                old: payload?.old ? sanitizeDemoPayload(payload.old) : payload?.old,
              });
            });
          }
          return origOn(type, filter, callback);
        }) as typeof ch.on;
      }
      return ch;
    }) as typeof client.channel;
    client[DEMO_CHANNEL_PATCHED] = true;
  }

  return client;
}
