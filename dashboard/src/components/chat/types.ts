import { Database } from '@/types/database.types';

export type ContactRow = Database['public']['Tables']['contacts']['Row'];
export type MessageRow = Database['public']['Tables']['messages']['Row'];

export interface ContactWithLatestMessage extends ContactRow {
  latest_message?: MessageRow | null;
  unread_count?: number;
}

export type ContactWithMeta = ContactWithLatestMessage;

export type ChatFilter = 'all' | 'needs_human' | 'ai_paused';

export interface QuickReply {
  id: string;
  text: string;
  label?: string;
}

export interface ChannelSimple {
  id: string;
  name: string | null;
  picture_url: string | null;
}

export interface ChatContainerProps {
  initialContacts: ContactWithLatestMessage[];
  initialActiveContact: ContactRow | null;
  initialMessages: MessageRow[];
  channels: ChannelSimple[];
}

export interface ChatSidebarProps {
  contacts: ContactWithLatestMessage[];
  selectedContactId: string | null;
  onSelectContact: (contact: ContactWithLatestMessage) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filter: ChatFilter;
  onFilterChange: (filter: ChatFilter) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  channels: ChannelSimple[];
}

export interface ChatThreadProps {
  contact: ContactRow | null;
  messages: MessageRow[];
  isLoadingMessages?: boolean;
  onToggleAi: (contactId: string, targetEnabled: boolean) => Promise<void>;
  isTogglingAi?: boolean;
  onSendMessage: (content: string) => Promise<boolean>;
  isSending?: boolean;
  onBackToSidebar?: () => void;
  channels: ChannelSimple[];
}
