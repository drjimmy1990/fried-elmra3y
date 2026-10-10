'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Headphones,
  Phone,
  MessageCircle,
  Clock,
  Sparkles,
  PauseCircle,
  PlayCircle,
  ExternalLink,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  MapPin,
  ShoppingBag,
} from 'lucide-react';
import { formatDateTime, getWhatsAppLink } from '@/lib/utils';
import { ChatThreadProps, QuickReply, MessageRow } from './types';

const CANNED_REPLIES: QuickReply[] = [
  {
    id: '1',
    text: 'أهلاً بحضرتك يا فندم، نعتذر عن أي إزعاج ويسعدنا جداً خدمتك.',
    label: 'ترحيب واعتذار',
  },
  {
    id: '2',
    text: 'تم تجهيز طلب حضرتك بالكامل وهو مع الطيار الآن في الطريق إليك.',
    label: 'تأكيد التوصيل',
  },
  {
    id: '3',
    text: 'لحظات من فضلك وأراجع الأمر لحضرتك مع إدارة المطبخ والفرع فوراً.',
    label: 'مراجعة المطبخ',
  },
  {
    id: '4',
    text: 'شرفتنا يا فندم 🍗 تحب نساعدك في حاجة تانية؟',
    label: 'إنهاء المحادثة',
  },
  {
    id: '5',
    text: 'تم تسجيل ملاحظات حضرتك وسيقوم مدير الفرع بالتواصل معك هاتفياً.',
    label: 'تصعيد للإدارة',
  },
];

export function ChatThread({
  contact,
  messages,
  isLoadingMessages = false,
  onToggleAi,
  isTogglingAi = false,
  onSendMessage,
  isSending = false,
  onDismissNeedsHuman,
  onBackToSidebar,
  channels = [],
}: ChatThreadProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom whenever messages change or loading completes
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages.length, isLoadingMessages]);

  // Focus textarea when contact changes
  useEffect(() => {
    if (contact && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [contact?.id]);

  // Handle message sending
  const handleSend = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    setInputText('');
    const success = await onSendMessage(trimmed);
    if (!success) {
      // Restore input text on failure so user doesn't lose their message
      setInputText(trimmed);
    } else {
      setTimeout(() => scrollToBottom('smooth'), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleApplyCanned = (text: string) => {
    setInputText((prev) => (prev ? `${prev} ${text}` : text));
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // If no contact is selected
  if (!contact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 space-y-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-amber-500 shadow-md dark:shadow-xl">
          <MessageCircle className="w-10 h-10" />
        </div>
        <div className="text-center max-w-sm">
          <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">اختر محادثة للبدء</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
            انقر على أي عميل من القائمة الجانبية لعرض سجل المحادثة الكامل والتحكم في الرد الآلي للبوت أو إرسال رد بشري مباشر.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#0E1523] min-w-0 overflow-hidden transition-colors">
      {/* 1. Thread Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/70 backdrop-blur-xs shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button for mobile */}
          {onBackToSidebar && (
            <button
              onClick={onBackToSidebar}
              className="p-2 -mr-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 md:hidden cursor-pointer"
              aria-label="العودة للقائمة"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          )}

          {/* Customer Avatar */}
          <div className="relative shrink-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shadow-xs ${
                contact.ai_enabled
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-500/30 dark:text-emerald-300'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:border-amber-500/30 dark:text-amber-300'
              }`}
            >
              {contact.name ? contact.name.slice(0, 2) : 'ع'}
            </div>
            <div className="absolute -bottom-1 -left-1 ring-2 ring-white dark:ring-[#0B0F17] rounded-full">
              <span
                className={`inline-block w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-950 ${
                  contact.ai_enabled ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
                title={contact.ai_enabled ? 'البوت يعمل' : 'البوت متوقف'}
              />
            </div>
          </div>

          {/* Customer Details */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-black text-base text-slate-900 dark:text-white truncate">
                {contact.name || 'عميل بدون اسم'}
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/50 font-medium">
                {contact.platform === 'messenger' ? 'فيسبوك ماسنجر' : contact.platform}
              </span>
              {channels && channels.length > 1 && contact.channel_id && (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-medium">
                  {channels.find(c => c.id === contact.channel_id)?.name || 'صفحة غير معروفة'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1 flex-wrap">
              {contact.phone && (
                <div className="flex items-center gap-1.5" dir="ltr">
                  <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{contact.phone}</span>
                  <a
                    href={`tel:${contact.phone}`}
                    className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                    title="اتصال هاتفي"
                  >
                    <Phone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  </a>
                  <a
                    href={getWhatsAppLink(contact.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/80 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-400 transition border border-emerald-200 dark:border-emerald-800/40 cursor-pointer"
                    title="محادثة واتساب"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {contact.total_orders > 0 && (
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>{contact.total_orders} طلب</span>
                </span>
              )}

              {contact.address && (
                <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 truncate max-w-xs" title={contact.address}>
                  <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="truncate">{contact.address}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Prominent AI Takeover Toggle Switch */}
        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
          <div className="text-left sm:text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">الرد الآلي للبوت</span>
              {contact.ai_enabled ? (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              )}
            </div>
            <div className="text-[11px] font-semibold mt-0.5">
              {contact.ai_enabled ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>البوت يجيب آلياً 🤖</span>
                </span>
              ) : (
                <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <PauseCircle className="w-3 h-3" />
                  <span>تحكم بشري يدوي 👤</span>
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={contact.ai_enabled}
            disabled={isTogglingAi}
            onClick={() => onToggleAi(contact.id, !contact.ai_enabled)}
            className={`relative inline-flex h-8 w-16 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden shadow-inner disabled:opacity-50 ${
              contact.ai_enabled
                ? 'bg-emerald-600 hover:bg-emerald-500'
                : 'bg-amber-600 hover:bg-amber-500'
            }`}
            title={
              contact.ai_enabled
                ? 'انقر لإيقاف البوت وتولي المحادثة كدعم فني بشري'
                : 'انقر لإعادة تشغيل الرد الآلي للذكاء الاصطناعي'
            }
          >
            <span className="sr-only">تبديل وضع الرد الآلي</span>
            {isTogglingAi ? (
              <span className="absolute inset-0 flex items-center justify-center text-white">
                <Loader2 className="w-4 h-4 animate-spin" />
              </span>
            ) : (
              <span
                className={`pointer-events-none flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-900 shadow-md transform transition duration-200 ease-in-out ${
                  contact.ai_enabled ? 'translate-x-0' : '-translate-x-8'
                }`}
              >
                {contact.ai_enabled ? (
                  <Bot className="w-4 h-4 text-emerald-700" />
                ) : (
                  <User className="w-4 h-4 text-amber-700" />
                )}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* needs_human banner */}
      {contact.needs_human && (
        <div className="bg-rose-500/10 dark:bg-rose-950/60 border-b border-rose-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 animate-bounce" />
            <span className="font-black">تنبيه عاجل: العميل طلب التحدث مع موظف خدمة العملاء 🙋</span>
          </div>
          <button
            onClick={() => {
              if (onDismissNeedsHuman) {
                onDismissNeedsHuman(contact.id);
              }
            }}
            className="text-[11px] font-bold px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-800 dark:text-rose-200 border border-rose-500/40 transition shrink-0 cursor-pointer shadow-xs"
          >
            تم التعامل — إلغاء التنبيه ✓
          </button>
        </div>
      )}

      {/* Compact Status Indicator when AI is active */}
      {contact.ai_enabled && !contact.needs_human && (
        <div className="bg-emerald-500/5 dark:bg-emerald-950/30 border-b border-emerald-500/15 px-4 py-1.5 flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 shrink-0">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>الذكاء الاصطناعي يتولى الرد آلياً. إذا أردت الرد بنفسك يمكنك إيقاف البوت لتفادي تداخل الردود.</span>
          </div>
          <button
            onClick={() => onToggleAi(contact.id, false)}
            disabled={isTogglingAi}
            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 border border-amber-500/30 transition shrink-0 cursor-pointer"
          >
            إيقاف البوت الآن ⏸️
          </button>
        </div>
      )}

      {/* 3. Messages Stream Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-800 bg-slate-50/40 dark:bg-slate-950/40">
        {isLoadingMessages ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <p className="text-xs font-medium">جاري تحميل سجل الرسائل...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 space-y-2 text-slate-400 dark:text-slate-500">
            <MessageCircle className="w-8 h-8 opacity-40 text-slate-400" />
            <p className="text-xs font-medium">لا توجد رسائل سابقة في هذه المحادثة بعد.</p>
          </div>
        ) : (
          messages.map((message) => {
            const isUser = message.sender_type === 'user';
            const isBot = message.sender_type === 'bot';
            const isAgent = message.sender_type === 'agent';

            return (
              <div
                key={message.id}
                className={`flex w-full ${isUser ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`flex items-start gap-2.5 max-w-[85%] sm:max-w-[75%] ${
                    isUser ? 'flex-row' : 'flex-row-reverse'
                  }`}
                >
                  {/* Avatar Icon */}
                  <div className="shrink-0 mt-1">
                    {isUser && (
                      <div
                        className="w-8 h-8 rounded-xl bg-slate-200/80 dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 shadow-xs"
                        title="رسالة العميل"
                      >
                        <User className="w-4 h-4" />
                      </div>
                    )}
                    {isBot && (
                      <div
                        className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-950 border border-purple-200 dark:border-purple-800/60 flex items-center justify-center text-purple-700 dark:text-purple-300 shadow-xs"
                        title="رد الذكاء الاصطناعي الآلي"
                      >
                        <Bot className="w-4 h-4" />
                      </div>
                    )}
                    {isAgent && (
                      <div
                        className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-amber-700 dark:text-amber-300 shadow-xs"
                        title="رد موظف الدعم البشري"
                      >
                        <Headphones className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div
                    className={`flex flex-col rounded-2xl p-3.5 shadow-xs transition-colors ${
                      isUser
                        ? 'bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-tr-xs'
                        : isBot
                        ? 'bg-violet-50/90 dark:bg-purple-950/40 border border-violet-200/70 dark:border-purple-800/50 text-violet-950 dark:text-purple-100 rounded-tl-xs'
                        : 'bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/50 text-amber-950 dark:text-amber-100 rounded-tl-xs'
                    }`}
                  >
                    {/* Sender Tag Header */}
                    <div className="flex items-center justify-between gap-3 text-[11px] mb-1 font-bold">
                      {isUser && (
                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <span>{contact.name || 'العميل'}</span>
                        </span>
                      )}
                      {isBot && (
                        <span className="text-purple-700 dark:text-purple-300 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                          <span>الذكاء الاصطناعي 🤖</span>
                        </span>
                      )}
                      {isAgent && (
                        <span className="text-amber-700 dark:text-amber-300 flex items-center gap-1">
                          <Headphones className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          <span>موظف الدعم 👤</span>
                        </span>
                      )}

                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono" dir="ltr">
                        {formatDateTime(message.created_at)}
                      </span>
                    </div>

                    {/* Media preview if present */}
                    {message.media_url && (
                      <div className="mt-1 mb-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/60 bg-black/40">
                        <a
                          href={message.media_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group relative block"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={message.media_url}
                            alt="مرفق محادثة"
                            loading="lazy"
                            className="max-h-60 w-auto rounded-lg object-cover hover:opacity-90 transition"
                          />
                          <div className="absolute bottom-2 right-2 px-2 py-1 rounded-md bg-black/70 text-white text-[10px] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <ExternalLink className="w-3 h-3" />
                            <span>عرض بحجم كامل</span>
                          </div>
                        </a>
                      </div>
                    )}

                    {/* Text Content */}
                    {message.content && (
                      <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap break-words select-text">
                        {message.content}
                      </p>
                    )}
                    
                    {/* Send Error */}
                    {isAgent && message.send_error && (
                      <div className="mt-2 pt-2 border-t border-rose-500/30">
                        <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-[11px] font-bold mb-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>لم يتم الإرسال ⚠️</span>
                        </div>
                        <p className="text-[10px] text-rose-700 dark:text-rose-300/80 mb-2">{message.send_error}</p>
                        <button
                          onClick={() => onSendMessage(message.content || '')}
                          disabled={isSending}
                          className="bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 rounded px-2.5 py-1 text-[10px] font-bold transition cursor-pointer"
                        >
                          إعادة المحاولة
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 4. Agent Canned Response Chips */}
      <div className="px-4 py-2.5 border-t border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/70 overflow-x-auto scrollbar-none flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          ردود سريعة:
        </span>
        {CANNED_REPLIES.map((canned) => (
          <button
            key={canned.id}
            type="button"
            onClick={() => handleApplyCanned(canned.text)}
            className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800 text-xs font-medium whitespace-nowrap transition shadow-xs cursor-pointer active:scale-95"
            title={canned.text}
          >
            {canned.label || canned.text}
          </button>
        ))}
      </div>

      {/* 5. Agent Input Box */}
      <div className="p-3 sm:p-4 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0B0F17] shrink-0">
        {contact.platform === 'messenger' && (() => {
          const lastUserMessage = [...messages].reverse().find(m => m.sender_type === 'user');
          const isPast24h = lastUserMessage 
            ? new Date().getTime() - new Date(lastUserMessage.created_at).getTime() > 24 * 60 * 60 * 1000
            : true;
          
          if (isPast24h) {
            return (
              <div className="mb-2 bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[11px] px-3 py-1.5 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>سياسة فيسبوك تسمح بالرد خلال 24 ساعة فقط من آخر رسالة للعميل — قد لا يتم تسليم الرسالة إذا انتهت النافذة.</span>
              </div>
            );
          }
          return null;
        })()}
        
        <div className="relative flex items-end gap-2 bg-slate-50 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-2.5 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20 transition shadow-xs">
          <textarea
            ref={textareaRef}
            rows={2}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="اكتب رد موظف الدعم هنا... (اضغط Enter للإرسال، Shift+Enter لسطر جديد)"
            disabled={isSending}
            className="flex-1 bg-transparent border-0 resize-none text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-0 leading-relaxed max-h-32 min-h-[44px] py-1 px-2"
          />

          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim() || isSending}
            className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer active:scale-95"
            title="إرسال الرسالة للعميل"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <div className="flex items-center gap-1.5">
                <span>إرسال</span>
                <Send className="w-3.5 h-3.5 rotate-180" />
              </div>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-2 px-1">
          <span>
            {contact.platform === 'messenger'
              ? 'يتم إرسال الرد مباشرة إلى فيسبوك ماسنجر الخاص بالعميل عبر Facebook Graph API'
              : 'يتم تسجيل الرد في النظام والمزامنة فورياً عبر Supabase Realtime'}
          </span>
          <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">Enter ↵ للإرسال</span>
        </div>
      </div>
    </div>
  );
}
