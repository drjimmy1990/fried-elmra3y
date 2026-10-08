'use client';

import React, { useMemo } from 'react';
import {
  Search,
  X,
  Bot,
  User,
  MessageCircle,
  Smartphone,
  Globe,
  Clock,
  Sparkles,
  PauseCircle,
  CheckCircle2,
} from 'lucide-react';
import { formatTimeElapsed } from '@/lib/utils';
import { ChatSidebarProps, ContactWithLatestMessage, ChatFilter } from './types';

export function ChatSidebar({
  contacts,
  selectedContactId,
  onSelectContact,
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
  isMobileOpen = false,
  onCloseMobile,
  channels,
}: ChatSidebarProps) {
  // Filter contacts based on search query and AI status filter
  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = contacts.filter((contact) => {
      // 1. Text search matching name, phone, or last message content
      if (q) {
        const nameMatch = (contact.name || '').toLowerCase().includes(q);
        const phoneMatch = (contact.phone || '').includes(q);
        const messageMatch = (contact.latest_message?.content || '').toLowerCase().includes(q);
        if (!nameMatch && !phoneMatch && !messageMatch) {
          return false;
        }
      }

      // 2. Tab filter
      if (filter === 'needs_human') {
        return contact.needs_human === true;
      }
      if (filter === 'ai_paused') {
        return contact.ai_enabled === false;
      }

      return true;
    });

    // Sort needs_human first
    return filtered.sort((a, b) => {
      if (a.needs_human && !b.needs_human) return -1;
      if (!a.needs_human && b.needs_human) return 1;
      if (a.needs_human && b.needs_human) {
        const aTime = a.needs_human_at ? new Date(a.needs_human_at).getTime() : 0;
        const bTime = b.needs_human_at ? new Date(b.needs_human_at).getTime() : 0;
        return bTime - aTime; // newest needs_human first
      }
      return 0; // preserve original last_interaction_at order
    });
  }, [contacts, searchQuery, filter]);

  // Count active / paused for quick badges
  const counts = useMemo(() => {
    let needsHumanCount = 0;
    let aiPaused = 0;
    for (const c of contacts) {
      if (c.needs_human) {
        needsHumanCount++;
      }
      if (!c.ai_enabled) {
        aiPaused++;
      }
    }
    return {
      all: contacts.length,
      needsHumanCount,
      aiPaused,
    };
  }, [contacts]);

  // Helper for platform badge
  const renderPlatformBadge = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('messenger') || p.includes('facebook') || p.includes('fb')) {
      return (
        <span
          title="فيسبوك ماسنجر"
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-600 text-white text-[9px] shadow-xs"
        >
          <MessageCircle className="w-2.5 h-2.5" />
        </span>
      );
    }
    if (p.includes('whatsapp') || p.includes('wa')) {
      return (
        <span
          title="واتساب"
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] shadow-xs"
        >
          <Smartphone className="w-2.5 h-2.5" />
        </span>
      );
    }
    return (
      <span
        title="موقع الويب"
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-600 text-white text-[9px] shadow-xs"
      >
        <Globe className="w-2.5 h-2.5" />
      </span>
    );
  };

  // Helper for initials
  const getInitials = (name: string | null) => {
    if (!name) return 'ع';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2);
    return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`;
  };

  return (
    <aside
      className={`flex flex-col h-full bg-slate-950 border-r border-slate-800/80 transition-all duration-200 select-none ${
        isMobileOpen
          ? 'fixed inset-0 z-40 w-full sm:w-96'
          : 'w-full md:w-80 lg:w-96 shrink-0'
      }`}
    >
      {/* Sidebar Header & Search */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-950/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-white text-base leading-tight">المحادثات المباشرة</h2>
              <p className="text-[11px] text-slate-400">
                {contacts.length} محادثة مسجلة
              </p>
            </div>
          </div>

          {/* Close button on mobile overlay */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 md:hidden"
              aria-label="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="بحث بالاسم، الهاتف، أو محتوى الرسالة..."
            className="w-full rounded-xl bg-slate-900 border border-slate-800 pr-9 pl-8 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 pt-1">
          <button
            onClick={() => onFilterChange('all')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition text-center ${
              filter === 'all'
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800/80 hover:text-slate-200'
            }`}
          >
            الكل ({counts.all})
          </button>

          <button
            onClick={() => onFilterChange('needs_human')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1 ${
              filter === 'needs_human'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800/80 hover:text-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>يحتاج موظف ({counts.needsHumanCount})</span>
          </button>

          <button
            onClick={() => onFilterChange('ai_paused')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition flex items-center justify-center gap-1 ${
              filter === 'ai_paused'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800/80 hover:text-slate-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>بشري ({counts.aiPaused})</span>
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50 scrollbar-thin scrollbar-thumb-slate-800">
        {filteredContacts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <MessageCircle className="w-8 h-8 mx-auto opacity-30 text-slate-400" />
            <p className="text-xs">لا توجد محادثات مطابقة للبحث</p>
          </div>
        ) : (
          filteredContacts.map((contact) => {
            const isSelected = contact.id === selectedContactId;
            const lastSnippet =
              contact.latest_message?.content ||
              (contact.latest_message?.media_url ? '📷 صورة مرفقة' : 'لا توجد رسائل سابقة');
            const unreadCount = contact.unread_count || 0;
            const timeElapsed = formatTimeElapsed(
              contact.latest_message?.created_at || contact.last_interaction_at
            );

            return (
              <button
                key={contact.id}
                type="button"
                onClick={() => {
                  onSelectContact(contact);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`w-full text-right p-3.5 flex items-start gap-3 transition-colors relative group ${
                  isSelected
                    ? 'bg-slate-800/90 border-r-4 border-amber-500 text-white'
                    : 'hover:bg-slate-900/80 text-slate-300'
                }`}
              >
                {/* Avatar with Platform Badge */}
                <div className="relative shrink-0 mt-0.5">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-inner ${
                      contact.ai_enabled
                        ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                        : 'bg-amber-950/60 border border-amber-500/30 text-amber-300'
                    }`}
                  >
                    {getInitials(contact.name)}
                  </div>
                  <div className="absolute -bottom-1 -left-1 ring-2 ring-slate-950 rounded-full">
                    {renderPlatformBadge(contact.platform)}
                  </div>
                </div>

                {/* Info & Snippet */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-bold text-sm text-slate-100 truncate flex items-center gap-1.5">
                      {contact.name || contact.phone || 'عميل بدون اسم'}
                      {contact.needs_human && (
                        <span className="inline-flex items-center justify-center bg-amber-500/20 text-amber-400 text-[10px] px-1.5 py-0.5 rounded font-bold border border-amber-500/30" title="يحتاج موظف">
                          🙋
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] text-slate-500 shrink-0 font-medium">
                      {timeElapsed}
                    </span>
                  </div>
                  
                  {channels.length > 1 && contact.channel_id && (
                    <div className="text-[10px] text-slate-500 mb-0.5 truncate">
                      الصفحة: {channels.find(c => c.id === contact.channel_id)?.name || 'غير معروف'}
                    </div>
                  )}

                  {/* Message Snippet */}
                  <p
                    className={`text-xs truncate ${
                      unreadCount > 0 ? 'text-white font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {contact.latest_message?.sender_type === 'bot' && (
                      <span className="text-purple-400 font-normal">🤖 البوت: </span>
                    )}
                    {contact.latest_message?.sender_type === 'agent' && (
                      <span className="text-amber-400 font-normal">👤 موظف الدعم: </span>
                    )}
                    {lastSnippet}
                  </p>

                  {/* Footer status row */}
                  <div className="flex items-center justify-between mt-2 pt-0.5">
                    {/* AI Status Badge */}
                    <div className="flex items-center gap-1 text-[11px]">
                      {contact.ai_enabled ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          البوت مفعل
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                          <PauseCircle className="w-3 h-3 text-amber-400" />
                          البوت متوقف (بشري)
                        </span>
                      )}
                    </div>

                    {/* Unread Counter Badge */}
                    {unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] shadow-xs">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
