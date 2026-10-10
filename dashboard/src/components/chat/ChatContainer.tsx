'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChatSidebar } from './ChatSidebar';
import { ChatThread } from './ChatThread';
import {
  ContactWithMeta,
  MessageRow,
  ContactRow,
  ChatFilter,
  ChannelSimple,
} from './types';

interface ChatContainerProps {
  initialContacts: ContactWithMeta[];
  initialActiveContact: ContactWithMeta | null;
  initialMessages: MessageRow[];
  channels: ChannelSimple[];
}

export function ChatContainer({
  initialContacts,
  initialActiveContact,
  initialMessages,
  channels,
}: ChatContainerProps) {
  const [contacts, setContacts] = useState<ContactWithMeta[]>(initialContacts);
  const [activeContact, setActiveContact] = useState<ContactWithMeta | null>(initialActiveContact);
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');

  const supabase = useMemo(() => createClient(), []);

  // Stable ref to activeContact to prevent tearing down realtime channel on contact switch
  const activeContactRef = useRef(activeContact);
  activeContactRef.current = activeContact;

  // Sync props if initialActiveContact changes externally (e.g. searchParams)
  useEffect(() => {
    if (initialActiveContact && initialActiveContact.id !== activeContact?.id) {
      setActiveContact(initialActiveContact);
      setMessages(initialMessages);
    }
  }, [initialActiveContact, initialMessages, activeContact?.id]);

  // Mark active contact messages as read on initial mount
  useEffect(() => {
    if (initialActiveContact) {
      supabase
        .from('messages')
        .update({ is_read: true })
        .eq('contact_id', initialActiveContact.id)
        .eq('is_read', false)
        .then(() => {
          setContacts((prev) =>
            prev.map((c) => (c.id === initialActiveContact.id ? { ...c, unread_count: 0 } : c))
          );
        });
    }
  }, [initialActiveContact, supabase]);

  // Select contact handler
  const handleSelectContact = useCallback(
    async (contact: ContactWithMeta) => {
      if (activeContact?.id === contact.id) {
        setIsMobileSidebarOpen(false);
        return;
      }

      setActiveContact(contact);
      setIsMobileSidebarOpen(false);
      setIsLoadingMessages(true);

      // Update URL query parameter without full page reload
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('contactId', contact.id);
        window.history.replaceState({}, '', url.toString());
      }

      try {
        // 1. Fetch thread messages
        const { data: threadMessages, error } = await supabase
          .from('messages')
          .select('*')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: true })
          .limit(200);

        if (!error && threadMessages) {
          setMessages(threadMessages);
        } else {
          setMessages([]);
        }

        // 2. Mark unread messages as read in database
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('contact_id', contact.id)
          .eq('is_read', false);

        // 3. Clear unread badge in local contacts state
        setContacts((prev) =>
          prev.map((c) => (c.id === contact.id ? { ...c, unread_count: 0 } : c))
        );
      } catch (err) {
        console.error('Error loading chat messages:', err);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [activeContact?.id, supabase]
  );

  // Toggle Bot AI for active contact
  const handleToggleAi = useCallback(
    async (contactId: string, enabled: boolean) => {
      const current = activeContactRef.current;
      const targetId = contactId || current?.id;
      if (!targetId) return;

      const previousStatus = current?.id === targetId ? current.ai_enabled : true;

      // 1. Optimistic state update
      setActiveContact((prev) => (prev?.id === targetId ? { ...prev, ai_enabled: enabled } : prev));
      setContacts((prev) =>
        prev.map((c) => (c.id === targetId ? { ...c, ai_enabled: enabled } : c))
      );

      try {
        const { error } = await supabase
          .from('contacts')
          .update({ ai_enabled: enabled })
          .eq('id', targetId);

        if (error) {
          console.error('Failed to toggle AI status in Supabase:', error);
          // Rollback on failure
          setActiveContact((prev) => (prev?.id === targetId ? { ...prev, ai_enabled: previousStatus } : prev));
          setContacts((prev) =>
            prev.map((c) => (c.id === targetId ? { ...c, ai_enabled: previousStatus } : c))
          );
          alert('تعذر تغيير حالة الذكاء الاصطناعي للبوت. يرجى التحقق من الاتصال.');
        }
      } catch (err) {
        console.error('Unexpected error toggling AI:', err);
        // Rollback
        setActiveContact((prev) => (prev?.id === targetId ? { ...prev, ai_enabled: previousStatus } : prev));
        setContacts((prev) =>
          prev.map((c) => (c.id === targetId ? { ...c, ai_enabled: previousStatus } : c))
        );
        alert('حدث خطأ غير متوقع أثناء تغيير إعداد البوت.');
      }
    },
    [supabase]
  );

  // Dismiss needs_human alert for a contact
  const handleDismissNeedsHuman = useCallback(
    async (contactId: string) => {
      const targetId = contactId || activeContactRef.current?.id;
      if (!targetId) return;

      // Optimistic update
      setActiveContact((prev) => (prev?.id === targetId ? { ...prev, needs_human: false, needs_human_at: null } : prev));
      setContacts((prev) =>
        prev.map((c) => (c.id === targetId ? { ...c, needs_human: false, needs_human_at: null } : c))
      );

      try {
        await supabase
          .from('contacts')
          .update({ needs_human: false, needs_human_at: null })
          .eq('id', targetId);
      } catch (err) {
        console.error('Failed to dismiss needs_human alert in Supabase:', err);
      }
    },
    [supabase]
  );

  // Handle agent message sending with reconciliation to prevent duplicates
  const handleSendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      const current = activeContactRef.current;
      if (!current) return false;
      setIsSending(true);

      const previousContacts = contacts;
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: MessageRow = {
        id: tempId,
        contact_id: current.id,
        sender_type: 'agent',
        content,
        media_url: null,
        media_type: null,
        is_read: true,
        created_at: new Date().toISOString(),
        platform_message_id: null,
        sent_by: null,
        send_error: null,
      };

      // 1. Optimistic message append
      setMessages((prev) => [...prev, optimisticMessage]);

      // 2. Optimistic sidebar update (last message & order)
      setContacts((prev) => {
        const updated = prev.map((c) => {
          if (c.id === current.id) {
            return {
              ...c,
              latest_message: optimisticMessage,
              last_interaction_at: optimisticMessage.created_at,
            };
          }
          return c;
        });

        return updated.sort(
          (a, b) =>
            new Date(b.last_interaction_at || 0).getTime() -
            new Date(a.last_interaction_at || 0).getTime()
        );
      });

      try {
        const response = await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId: current.id,
            content,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'فشل إرسال الرسالة');
        }

        const savedMessage = result.message as MessageRow;

        // Reconcile: If Realtime already inserted the saved message, remove temp placeholder
        setMessages((prev) => {
          if (prev.some((m) => m.id === savedMessage.id)) {
            return prev.filter((m) => m.id !== tempId);
          }
          return prev.map((m) => (m.id === tempId ? savedMessage : m));
        });

        if (result.deliveryWarning) {
          alert(`ملاحظة: تم حفظ الرد، ولكن ${result.deliveryWarning}`);
        }

        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'خطأ غير متوقع';
        console.error('Error sending message via API:', err);
        // Rollback optimistic message & contacts state
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setContacts(previousContacts);
        alert(`فشل إرسال الرسالة: ${message}`);
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [contacts]
  );

  // Persistent Supabase Realtime synchronization across all contacts
  useEffect(() => {
    const channel = supabase
      .channel('chat_realtime_sync')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'contacts',
        },
        (payload) => {
          const newContact = payload.new as ContactRow;
          setContacts((prev) => {
            if (prev.some((c) => c.id === newContact.id)) return prev;
            const contactWithMeta: ContactWithMeta = {
              ...newContact,
              latest_message: null,
              unread_count: 0,
            };
            return [contactWithMeta, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'contacts',
        },
        (payload) => {
          const updatedContact = payload.new as ContactRow;

          setActiveContact((current) => {
            if (current && current.id === updatedContact.id) {
              return { ...current, ...updatedContact };
            }
            return current;
          });

          setContacts((prev) => {
            const exists = prev.some((c) => c.id === updatedContact.id);
            if (!exists) return prev;

            const nextList = prev.map((c) =>
              c.id === updatedContact.id ? { ...c, ...updatedContact } : c
            );

            return nextList.sort(
              (a, b) =>
                new Date(b.last_interaction_at || 0).getTime() -
                new Date(a.last_interaction_at || 0).getTime()
            );
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as MessageRow;
          const currentActive = activeContactRef.current;

          // If message belongs to active chat, append or reconcile with temp optimistic message
          if (currentActive && currentActive.id === newMsg.contact_id) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;

              // Check if matching pending optimistic message exists
              const tempMatch = prev.find(
                (m) =>
                  m.id.startsWith('temp-') &&
                  m.sender_type === newMsg.sender_type &&
                  m.content === newMsg.content
              );

              if (tempMatch) {
                return prev.map((m) => (m.id === tempMatch.id ? newMsg : m));
              }

              return [...prev, newMsg];
            });
          }

          // Update contacts sidebar with latest message & unread status
          setContacts((prev) => {
            const nextList = prev.map((c) => {
              if (c.id === newMsg.contact_id) {
                const isCurrentlyActive = currentActive?.id === c.id;
                const shouldIncrementUnread =
                  !isCurrentlyActive && newMsg.sender_type === 'user';
                return {
                  ...c,
                  latest_message: newMsg,
                  last_interaction_at: newMsg.created_at,
                  unread_count: shouldIncrementUnread
                    ? (c.unread_count || 0) + 1
                    : c.unread_count || 0,
                };
              }
              return c;
            });

            return nextList.sort(
              (a, b) =>
                new Date(b.last_interaction_at || 0).getTime() -
                new Date(a.last_interaction_at || 0).getTime()
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <div className="flex flex-1 min-h-0 w-full rounded-2xl sm:rounded-3xl bg-white dark:bg-[#0E1523] border border-slate-200/90 dark:border-slate-700/80 shadow-xl dark:shadow-2xl overflow-hidden relative transition-colors">
      {/* Sidebar: Contacts List */}
      <ChatSidebar
        contacts={contacts}
        selectedContactId={activeContact?.id || null}
        onSelectContact={handleSelectContact}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filter={filter}
        onFilterChange={setFilter}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        channels={channels}
      />

      {/* Main: Active Thread */}
      <ChatThread
        contact={activeContact}
        messages={messages}
        isLoadingMessages={isLoadingMessages}
        isSending={isSending}
        onSendMessage={handleSendMessage}
        onToggleAi={handleToggleAi}
        onDismissNeedsHuman={handleDismissNeedsHuman}
        onBackToSidebar={() => setIsMobileSidebarOpen(true)}
        channels={channels}
      />
    </div>
  );
}
