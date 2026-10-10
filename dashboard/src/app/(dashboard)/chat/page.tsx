import React from 'react';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ChatContainer } from '@/components/chat/ChatContainer';
import {
  ContactWithLatestMessage,
  ContactRow,
  MessageRow,
} from '@/components/chat/types';

export const metadata: Metadata = {
  title: 'المحادثات | لوحة التحكم',
  description: 'إدارة المحادثات الحية للعملاء، التبديل بين الرد الآلي بالذكاء الاصطناعي والرد البشري المباشر',
};

export const revalidate = 0; // Dynamic server component

interface ChatPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const resolvedParams = await searchParams;
  const contactId =
    typeof resolvedParams.contactId === 'string'
      ? resolvedParams.contactId
      : undefined;

  const supabase = await createClient();

  // 1. RBAC Guard: Strictly restricted to active admin per owner requirement
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    redirect('/dashboard/orders');
  }

  // 1. Fetch contacts ordered by last_interaction_at desc limit 100
  const { data: contactsData, error: contactsError } = await supabase
    .from('contacts')
    .select('*')
    .order('last_interaction_at', { ascending: false })
    .limit(100);

  if (contactsError) {
    console.error('Failed to fetch contacts for chat:', contactsError);
  }

  const rawContacts = contactsData || [];
  const contactIds = rawContacts.map((c) => c.id);

  // 2. Fetch recent messages to determine latest message and unread count per contact
  const latestMessagesMap: Record<string, MessageRow> = {};
  const unreadCountsMap: Record<string, number> = {};

  if (contactIds.length > 0) {
    // Bounded window: enough for previews + unread badges without loading full history.
    const { data: recentMessages, error: msgsError } = await supabase
      .from('messages')
      .select('*')
      .in('contact_id', contactIds)
      .order('created_at', { ascending: false })
      .limit(1500);

    if (msgsError) {
      console.error('Failed to fetch recent messages:', msgsError);
    } else if (recentMessages) {
      for (const msg of recentMessages) {
        // Since sorted by created_at desc, first seen message is the latest
        if (!latestMessagesMap[msg.contact_id]) {
          latestMessagesMap[msg.contact_id] = msg;
        }
        if (!msg.is_read && msg.sender_type === 'user') {
          unreadCountsMap[msg.contact_id] =
            (unreadCountsMap[msg.contact_id] || 0) + 1;
        }
      }
    }
  }

  const initialContacts: ContactWithLatestMessage[] = rawContacts.map((contact) => ({
    ...contact,
    latest_message: latestMessagesMap[contact.id] || null,
    unread_count: unreadCountsMap[contact.id] || 0,
  }));

  // 3. If contactId is specified, fetch that contact and its messages thread
  let initialActiveContact: ContactRow | null = null;
  let initialMessages: MessageRow[] = [];

  if (contactId) {
    initialActiveContact =
      initialContacts.find((c) => c.id === contactId) || null;

    if (!initialActiveContact) {
      const { data: singleContact } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .maybeSingle();

      if (singleContact) {
        initialActiveContact = singleContact;
        initialContacts.unshift({
          ...singleContact,
          latest_message: null,
          unread_count: 0,
        });
      }
    }
  } else if (initialContacts.length > 0) {
    initialActiveContact = initialContacts[0];
  }

  if (initialActiveContact) {
    const { data: threadMessages, error: threadError } = await supabase
      .from('messages')
      .select('*')
      .eq('contact_id', initialActiveContact.id)
      .order('created_at', { ascending: true });

    if (threadError) {
      console.error('Failed to fetch thread messages:', threadError);
    } else {
      initialMessages = threadMessages || [];
    }
  }

  // 4. Fetch channels with admin client because they lack client RLS policies
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminDb = createAdminClient();
  const { data: channelsData } = await adminDb
    .from('channels')
    .select('id, name, picture_url');
  const channels = channelsData || [];

  return (
    <div className="flex-1 min-h-0 flex flex-col p-2.5 sm:p-4 lg:p-6 w-full max-w-[1700px] mx-auto h-[calc(100vh-5rem)]">
      <ChatContainer
        initialContacts={initialContacts}
        initialActiveContact={initialActiveContact}
        initialMessages={initialMessages}
        channels={channels}
      />
    </div>
  );
}
