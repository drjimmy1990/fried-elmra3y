'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ChatSidebar } from './ChatSidebar';
import { ChatThread } from './ChatThread';
import {
  ChatContainerProps,
  ContactWithLatestMessage,
  ContactRow,
  MessageRow,
  ChatFilter,
} from './types';

export function ChatContainer({
  initialContacts,
  initialActiveContact,
  initialMessages,
}: ChatContainerProps) {
  // Contacts and active conversation states
  const [contacts, setContacts] = useState<ContactWithLatestMessage[]>(initialContacts);
  const [activeContact, setActiveContact] = useState<ContactRow | null>(
    initialActiveContact || (initialContacts.length > 0 ? initialContacts[0] : null)
  );
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');

  // Mobile drawer toggle
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Action pending states
  const [isTogglingAi, setIsTogglingAi] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Referentially stable Supabase client
  const supabase = useMemo(() => createClient(), []);

  // Sync initial props if they update on the server
  useEffect(() => {
    setContacts(initialContacts);
  }, [initialContacts]);

  useEffect(() => {
    if (initialActiveContact) {
      setActiveContact(initialActiveContact);
    }
  }, [initialActiveContact]);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Handle switching active contact
  const handleSelectContact = useCallback(
    async (contact: ContactWithLatestMessage) => {
      if (activeContact?.id === contact.id) {
        setIsMobileSidebarOpen(false);
        return;
      }

      setActiveContact(contact);
      setIsMobileSidebarOpen(false);

      // Fetch messages for newly selected contact
      setIsLoadingMessages(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Failed to fetch messages for contact:', error);
        } else {
          setMessages(data || []);
        }
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setIsLoadingMessages(false);
      }

      // Mark unread messages as read
      try {
        await supabase
          .from('messages')
          .update({ is_read: true })
          .eq('contact_id', contact.id)
          .eq('is_read', false);

        // Update local unread badge to 0
        setContacts((prev) =>
          prev.map((c) => (c.id === contact.id ? { ...c, unread_count: 0 } : c))
        );
      } catch (err) {
        console.error('Error marking messages as read:', err);
      }

      // Reflect in URL without full page reload
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('contactId', contact.id);
        window.history.replaceState(null, '', url.toString());
      }
    },
    [activeContact?.id, supabase]
  );

  // Handle toggling AI enabled on contact
  const handleToggleAi = useCallback(
    async (contactId: string, targetEnabled: boolean) => {
      setIsTogglingAi(true);

      // Optimistic state updates
      setActiveContact((prev) =>
        prev && prev.id === contactId ? { ...prev, ai_enabled: targetEnabled } : prev
      );
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, ai_enabled: targetEnabled } : c))
      );

      try {
        const { error } = await supabase
          .from('contacts')
          .update({ ai_enabled: targetEnabled })
          .eq('id', contactId);

        if (error) {
          console.error('Failed to update AI enabled flag:', error);
          // Revert optimistic updates
          setActiveContact((prev) =>
            prev && prev.id === contactId ? { ...prev, ai_enabled: !targetEnabled } : prev
          );
          setContacts((prev) =>
            prev.map((c) => (c.id === contactId ? { ...c, ai_enabled: !targetEnabled } : c))
          );
          alert('تعذر تحديث وضع الرد الآلي للبوت، يرجى المحاولة مرة أخرى.');
        }
      } catch (err) {
        console.error('Error toggling AI status:', err);
      } finally {
        setIsTogglingAi(false);
      }
    },
    [supabase]
  );

  // Handle agent message sending
  const handleSendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      if (!activeContact) return false;
      setIsSending(true);

      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: MessageRow = {
        id: tempId,
        contact_id: activeContact.id,
        sender_type: 'agent',
        content,
        media_url: null,
        media_type: null,
        is_read: true,
        created_at: new Date().toISOString(),
      };

      // 1. Optimistic message append
      setMessages((prev) => [...prev, optimisticMessage]);

      // 2. Optimistic sidebar update (last message & order)
      setContacts((prev) => {
        const updated = prev.map((c) => {
          if (c.id === activeContact.id) {
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
            new Date(b.last_interaction_at).getTime() -
            new Date(a.last_interaction_at).getTime()
        );
      });

      try {
        const response = await fetch('/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contactId: activeContact.id,
            content,
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'فشل إرسال الرسالة');
        }

        const savedMessage = result.message as MessageRow;
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? savedMessage : m))
        );

        return true;
      } catch (err: any) {
        console.error('Error sending message via API:', err);
        // Rollback optimistic message
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        alert(`فشل إرسال الرسالة: ${err.message || 'خطأ غير متوقع'}`);
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [activeContact]
  );

  // Supabase Realtime synchronization
  useEffect(() => {
    const channel = supabase
      .channel('chat_realtime_sync')
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
                new Date(b.last_interaction_at).getTime() -
                new Date(a.last_interaction_at).getTime()
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

          // If message belongs to active chat, append it
          setActiveContact((current) => {
            if (current && current.id === newMsg.contact_id) {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
            }
            return current;
          });

          // Update contacts sidebar with latest message & unread status
          setContacts((prev) => {
            const nextList = prev.map((c) => {
              if (c.id === newMsg.contact_id) {
                const isCurrentlyActive = activeContact?.id === c.id;
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
                new Date(b.last_interaction_at).getTime() -
                new Date(a.last_interaction_at).getTime()
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, activeContact?.id]);

  return (
    <div className="flex h-[calc(100vh-7.5rem)] min-h-[580px] rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden relative">
      {/* Sidebar for Desktop & Mobile Overlay */}
      <div
        className={`${
          isMobileSidebarOpen ? 'block' : 'hidden'
        } md:block md:relative z-30`}
      >
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
        />
      </div>

      {/* Main Chat Thread */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <ChatThread
          contact={activeContact}
          messages={messages}
          isLoadingMessages={isLoadingMessages}
          onToggleAi={handleToggleAi}
          isTogglingAi={isTogglingAi}
          onSendMessage={handleSendMessage}
          isSending={isSending}
          onBackToSidebar={() => setIsMobileSidebarOpen(true)}
        />
      </div>
    </div>
  );
}
