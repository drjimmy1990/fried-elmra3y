export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type UserRole = 'admin' | 'order_agent' | 'support_agent';
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';
export type RuleMatchType = 'any' | 'keywords';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: UserRole
          avatar_url: string | null
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          role?: UserRole
          avatar_url?: string | null
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: UserRole
          avatar_url?: string | null
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      bot_settings: {
        Row: {
          id: string
          bot_enabled: boolean
          auto_pause_on_complaint: boolean
          notify_telegram: boolean
          telegram_bot_token: string | null
          telegram_chat_id: string | null
          notify_dashboard: boolean
          business_hours_enabled: boolean
          open_time: string | null
          close_time: string | null
          off_hours_message: string | null
          ai_system_prompt: string | null
          menu_full_image_url: string | null
          menu_full_pdf_url: string | null
          currency: string
          delivery_fee: number
          updated_at: string
        }
        Insert: {
          id?: string
          bot_enabled?: boolean
          auto_pause_on_complaint?: boolean
          notify_telegram?: boolean
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          notify_dashboard?: boolean
          business_hours_enabled?: boolean
          open_time?: string | null
          close_time?: string | null
          off_hours_message?: string | null
          ai_system_prompt?: string | null
          menu_full_image_url?: string | null
          menu_full_pdf_url?: string | null
          currency?: string
          delivery_fee?: number
          updated_at?: string
        }
        Update: {
          id?: string
          bot_enabled?: boolean
          auto_pause_on_complaint?: boolean
          notify_telegram?: boolean
          telegram_bot_token?: string | null
          telegram_chat_id?: string | null
          notify_dashboard?: boolean
          business_hours_enabled?: boolean
          open_time?: string | null
          close_time?: string | null
          off_hours_message?: string | null
          ai_system_prompt?: string | null
          menu_full_image_url?: string | null
          menu_full_pdf_url?: string | null
          currency?: string
          delivery_fee?: number
          updated_at?: string
        }
      }
      global_comment_rules: {
        Row: {
          id: string
          is_enabled: boolean
          auto_like_comment: boolean
          comment_replies: string[]
          send_dm: boolean
          dm_message: string | null
          dm_image_url: string | null
          dm_buttons: Json
          updated_at: string
        }
        Insert: {
          id?: string
          is_enabled?: boolean
          auto_like_comment?: boolean
          comment_replies?: string[]
          send_dm?: boolean
          dm_message?: string | null
          dm_image_url?: string | null
          dm_buttons?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          is_enabled?: boolean
          auto_like_comment?: boolean
          comment_replies?: string[]
          send_dm?: boolean
          dm_message?: string | null
          dm_image_url?: string | null
          dm_buttons?: Json
          updated_at?: string
        }
      }
      post_rules: {
        Row: {
          id: string
          title: string
          facebook_post_id: string
          post_thumbnail_url: string | null
          post_url: string | null
          post_caption: string | null
          match_type: RuleMatchType
          trigger_keywords: string[]
          auto_like_comment: boolean
          comment_replies: string[]
          dm_message: string
          dm_image_url: string | null
          dm_buttons: Json
          is_active: boolean
          total_triggers: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          facebook_post_id: string
          post_thumbnail_url?: string | null
          post_url?: string | null
          post_caption?: string | null
          match_type?: RuleMatchType
          trigger_keywords?: string[]
          auto_like_comment?: boolean
          comment_replies: string[]
          dm_message: string
          dm_image_url?: string | null
          dm_buttons?: Json
          is_active?: boolean
          total_triggers?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          facebook_post_id?: string
          post_thumbnail_url?: string | null
          post_url?: string | null
          post_caption?: string | null
          match_type?: RuleMatchType
          trigger_keywords?: string[]
          auto_like_comment?: boolean
          comment_replies?: string[]
          dm_message?: string
          dm_image_url?: string | null
          dm_buttons?: Json
          is_active?: boolean
          total_triggers?: number
          created_at?: string
          updated_at?: string
        }
      }
      offers: {
        Row: {
          id: string
          title: string
          description: string | null
          price_before: number | null
          price_after: number
          banner_url: string
          start_date: string | null
          end_date: string | null
          is_active: boolean
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          price_before?: number | null
          price_after: number
          banner_url: string
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          price_before?: number | null
          price_after?: number
          banner_url?: string
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      menu_categories: {
        Row: {
          id: string
          name_ar: string
          name_en: string | null
          image_url: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name_ar: string
          name_en?: string | null
          image_url?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name_ar?: string
          name_en?: string | null
          image_url?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      menu_items: {
        Row: {
          id: string
          category_id: string
          name_ar: string
          name_en: string | null
          description: string | null
          price: number
          sale_price: number | null
          image_url: string | null
          is_available: boolean
          badges: string[]
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id: string
          name_ar: string
          name_en?: string | null
          description?: string | null
          price: number
          sale_price?: number | null
          image_url?: string | null
          is_available?: boolean
          badges?: string[]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          name_ar?: string
          name_en?: string | null
          description?: string | null
          price?: number
          sale_price?: number | null
          image_url?: string | null
          is_available?: boolean
          badges?: string[]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      contacts: {
        Row: {
          id: string
          platform: string
          platform_user_id: string
          name: string | null
          phone: string | null
          address: string | null
          ai_enabled: boolean
          total_orders: number
          last_interaction_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          platform?: string
          platform_user_id: string
          name?: string | null
          phone?: string | null
          address?: string | null
          ai_enabled?: boolean
          total_orders?: number
          last_interaction_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          platform?: string
          platform_user_id?: string
          name?: string | null
          phone?: string | null
          address?: string | null
          ai_enabled?: boolean
          total_orders?: number
          last_interaction_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          contact_id: string
          sender_type: 'user' | 'bot' | 'agent'
          content: string | null
          media_url: string | null
          media_type: string | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          contact_id: string
          sender_type: 'user' | 'bot' | 'agent'
          content?: string | null
          media_url?: string | null
          media_type?: string | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          contact_id?: string
          sender_type?: 'user' | 'bot' | 'agent'
          content?: string | null
          media_url?: string | null
          media_type?: string | null
          is_read?: boolean
          created_at?: string
        }
      }
      orders: {
        Row: {
          id: string
          order_number: number
          contact_id: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string
          subtotal: number
          delivery_fee: number
          total_amount: number
          status: OrderStatus
          payment_method: string
          internal_notes: string | null
          source: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          order_number?: number
          contact_id?: string | null
          customer_name: string
          customer_phone: string
          delivery_address: string
          subtotal?: number
          delivery_fee?: number
          total_amount?: number
          status?: OrderStatus
          payment_method?: string
          internal_notes?: string | null
          source?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          order_number?: number
          contact_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_address?: string
          subtotal?: number
          delivery_fee?: number
          total_amount?: number
          status?: OrderStatus
          payment_method?: string
          internal_notes?: string | null
          source?: string
          created_at?: string
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          menu_item_id: string | null
          item_name: string
          quantity: number
          unit_price: number
          total_price: number
          notes: string | null
        }
        Insert: {
          id?: string
          order_id: string
          menu_item_id?: string | null
          item_name: string
          quantity?: number
          unit_price: number
          total_price: number
          notes?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          menu_item_id?: string | null
          item_name?: string
          quantity?: number
          unit_price?: number
          total_price?: number
          notes?: string | null
        }
      }
      complaints: {
        Row: {
          id: string
          ticket_number: number
          contact_id: string | null
          customer_name: string
          customer_phone: string
          issue_description: string
          priority: ComplaintPriority
          status: ComplaintStatus
          assigned_to: string | null
          resolution_notes: string | null
          created_at: string
          updated_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          ticket_number?: number
          contact_id?: string | null
          customer_name: string
          customer_phone: string
          issue_description: string
          priority?: ComplaintPriority
          status?: ComplaintStatus
          assigned_to?: string | null
          resolution_notes?: string | null
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
        }
        Update: {
          id?: string
          ticket_number?: number
          contact_id?: string | null
          customer_name?: string
          customer_phone?: string
          issue_description?: string
          priority?: ComplaintPriority
          status?: ComplaintStatus
          assigned_to?: string | null
          resolution_notes?: string | null
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
        }
      }
    }
  }
}
