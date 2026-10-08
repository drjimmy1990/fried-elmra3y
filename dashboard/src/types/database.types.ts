// AUTO-GENERATED from database/01-04 migrations (scratch gen-types.mjs). Do not edit by hand.
// Regenerate after any schema change, or use: supabase gen types typescript --project-id <id>
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
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
          currency: string
          delivery_fee: number
          updated_at: string
          restaurant_name: string
          menu_images: string[]
          menu_pdf_url: string | null
          price_list: string | null
          welcome_message: string | null
          human_handoff_message: string | null
          n8n_webhook_url: string | null
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
          currency?: string
          delivery_fee?: number
          updated_at?: string
          restaurant_name?: string
          menu_images?: string[]
          menu_pdf_url?: string | null
          price_list?: string | null
          welcome_message?: string | null
          human_handoff_message?: string | null
          n8n_webhook_url?: string | null
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
          currency?: string
          delivery_fee?: number
          updated_at?: string
          restaurant_name?: string
          menu_images?: string[]
          menu_pdf_url?: string | null
          price_list?: string | null
          welcome_message?: string | null
          human_handoff_message?: string | null
          n8n_webhook_url?: string | null
        }
        Relationships: []
      }
      channel_secrets: {
        Row: {
          channel_id: string
          access_token: string
          updated_at: string
        }
        Insert: {
          channel_id: string
          access_token: string
          updated_at?: string
        }
        Update: {
          channel_id?: string
          access_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_secrets_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: true
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          id: string
          meta_app_id: string | null
          platform: 'facebook' | 'instagram' | 'whatsapp'
          external_id: string
          name: string | null
          picture_url: string | null
          status: 'connected' | 'error' | 'disconnected'
          token_expires_at: string | null
          connected_at: string
          last_checked_at: string | null
          last_error: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          meta_app_id?: string | null
          platform?: 'facebook' | 'instagram' | 'whatsapp'
          external_id: string
          name?: string | null
          picture_url?: string | null
          status?: 'connected' | 'error' | 'disconnected'
          token_expires_at?: string | null
          connected_at?: string
          last_checked_at?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          meta_app_id?: string | null
          platform?: 'facebook' | 'instagram' | 'whatsapp'
          external_id?: string
          name?: string | null
          picture_url?: string | null
          status?: 'connected' | 'error' | 'disconnected'
          token_expires_at?: string | null
          connected_at?: string
          last_checked_at?: string | null
          last_error?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_meta_app_id_fkey"
            columns: ["meta_app_id"]
            isOneToOne: false
            referencedRelation: "meta_apps"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_events: {
        Row: {
          id: string
          channel_id: string | null
          comment_id: string
          post_id: string | null
          parent_comment_id: string | null
          commenter_id: string | null
          commenter_name: string | null
          comment_text: string | null
          comment_created_at: string | null
          decision: 'pending' | 'replied' | 'ignored' | 'complaint' | 'failed' | 'manual'
          ignore_reason: string | null
          matched_rule_id: string | null
          public_reply_text: string | null
          public_reply_id: string | null
          replied: boolean
          liked: boolean
          dm_sent: boolean
          hidden: boolean
          error_message: string | null
          contact_id: string | null
          complaint_id: string | null
          handled_by: string | null
          processed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          channel_id?: string | null
          comment_id: string
          post_id?: string | null
          parent_comment_id?: string | null
          commenter_id?: string | null
          commenter_name?: string | null
          comment_text?: string | null
          comment_created_at?: string | null
          decision?: 'pending' | 'replied' | 'ignored' | 'complaint' | 'failed' | 'manual'
          ignore_reason?: string | null
          matched_rule_id?: string | null
          public_reply_text?: string | null
          public_reply_id?: string | null
          replied?: boolean
          liked?: boolean
          dm_sent?: boolean
          hidden?: boolean
          error_message?: string | null
          contact_id?: string | null
          complaint_id?: string | null
          handled_by?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          channel_id?: string | null
          comment_id?: string
          post_id?: string | null
          parent_comment_id?: string | null
          commenter_id?: string | null
          commenter_name?: string | null
          comment_text?: string | null
          comment_created_at?: string | null
          decision?: 'pending' | 'replied' | 'ignored' | 'complaint' | 'failed' | 'manual'
          ignore_reason?: string | null
          matched_rule_id?: string | null
          public_reply_text?: string | null
          public_reply_id?: string | null
          replied?: boolean
          liked?: boolean
          dm_sent?: boolean
          hidden?: boolean
          error_message?: string | null
          contact_id?: string | null
          complaint_id?: string | null
          handled_by?: string | null
          processed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_events_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_events_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_events_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_events_matched_rule_id_fkey"
            columns: ["matched_rule_id"]
            isOneToOne: false
            referencedRelation: "comment_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_rules: {
        Row: {
          id: string
          channel_id: string | null
          scope: 'post' | 'global'
          facebook_post_id: string | null
          name: string
          trigger_type: Database["public"]["Enums"]["rule_match_type"]
          keywords: string[]
          priority: number
          reply_enabled: boolean
          reply_variations: string[]
          like_comment: boolean
          dm_enabled: boolean
          dm_message: string | null
          dm_image_url: string | null
          dm_buttons: Json
          dm_send_menu: boolean
          dm_send_offers: boolean
          hide_comment: boolean
          create_complaint: boolean
          notify_staff: boolean
          is_active: boolean
          total_triggers: number
          last_triggered_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          channel_id?: string | null
          scope: 'post' | 'global'
          facebook_post_id?: string | null
          name: string
          trigger_type?: Database["public"]["Enums"]["rule_match_type"]
          keywords?: string[]
          priority?: number
          reply_enabled?: boolean
          reply_variations?: string[]
          like_comment?: boolean
          dm_enabled?: boolean
          dm_message?: string | null
          dm_image_url?: string | null
          dm_buttons?: Json
          dm_send_menu?: boolean
          dm_send_offers?: boolean
          hide_comment?: boolean
          create_complaint?: boolean
          notify_staff?: boolean
          is_active?: boolean
          total_triggers?: number
          last_triggered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          channel_id?: string | null
          scope?: 'post' | 'global'
          facebook_post_id?: string | null
          name?: string
          trigger_type?: Database["public"]["Enums"]["rule_match_type"]
          keywords?: string[]
          priority?: number
          reply_enabled?: boolean
          reply_variations?: string[]
          like_comment?: boolean
          dm_enabled?: boolean
          dm_message?: string | null
          dm_image_url?: string | null
          dm_buttons?: Json
          dm_send_menu?: boolean
          dm_send_offers?: boolean
          hide_comment?: boolean
          create_complaint?: boolean
          notify_staff?: boolean
          is_active?: boolean
          total_triggers?: number
          last_triggered_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_rules_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_settings: {
        Row: {
          id: string
          ai_enabled: boolean
          ai_system_prompt: string | null
          sensitive_keywords: string[]
          complaint_public_reply: string | null
          complaint_dm_message: string | null
          complaint_hide_comment: boolean
          complaint_create_ticket: boolean
          complaint_notify_staff: boolean
          dm_cooldown_hours: number
          reply_delay_min_sec: number
          reply_delay_max_sec: number
          ignore_nested_replies: boolean
          ignore_mentions_only: boolean
          updated_at: string
        }
        Insert: {
          id?: string
          ai_enabled?: boolean
          ai_system_prompt?: string | null
          sensitive_keywords?: string[]
          complaint_public_reply?: string | null
          complaint_dm_message?: string | null
          complaint_hide_comment?: boolean
          complaint_create_ticket?: boolean
          complaint_notify_staff?: boolean
          dm_cooldown_hours?: number
          reply_delay_min_sec?: number
          reply_delay_max_sec?: number
          ignore_nested_replies?: boolean
          ignore_mentions_only?: boolean
          updated_at?: string
        }
        Update: {
          id?: string
          ai_enabled?: boolean
          ai_system_prompt?: string | null
          sensitive_keywords?: string[]
          complaint_public_reply?: string | null
          complaint_dm_message?: string | null
          complaint_hide_comment?: boolean
          complaint_create_ticket?: boolean
          complaint_notify_staff?: boolean
          dm_cooldown_hours?: number
          reply_delay_min_sec?: number
          reply_delay_max_sec?: number
          ignore_nested_replies?: boolean
          ignore_mentions_only?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      complaints: {
        Row: {
          id: string
          ticket_number: number
          contact_id: string | null
          customer_name: string
          customer_phone: string | null
          issue_description: string
          priority: Database["public"]["Enums"]["complaint_priority"]
          status: Database["public"]["Enums"]["complaint_status"]
          assigned_to: string | null
          resolution_notes: string | null
          created_at: string
          updated_at: string
          resolved_at: string | null
          order_id: string | null
          source: 'messenger' | 'comment' | 'dashboard' | 'phone'
          comment_event_id: string | null
        }
        Insert: {
          id?: string
          ticket_number?: number
          contact_id?: string | null
          customer_name: string
          customer_phone?: string | null
          issue_description: string
          priority?: Database["public"]["Enums"]["complaint_priority"]
          status?: Database["public"]["Enums"]["complaint_status"]
          assigned_to?: string | null
          resolution_notes?: string | null
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
          order_id?: string | null
          source?: 'messenger' | 'comment' | 'dashboard' | 'phone'
          comment_event_id?: string | null
        }
        Update: {
          id?: string
          ticket_number?: number
          contact_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          issue_description?: string
          priority?: Database["public"]["Enums"]["complaint_priority"]
          status?: Database["public"]["Enums"]["complaint_status"]
          assigned_to?: string | null
          resolution_notes?: string | null
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
          order_id?: string | null
          source?: 'messenger' | 'comment' | 'dashboard' | 'phone'
          comment_event_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaints_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_comment_event_id_fkey"
            columns: ["comment_event_id"]
            isOneToOne: false
            referencedRelation: "comment_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
          last_interaction_at: string | null
          created_at: string
          updated_at: string
          channel_id: string | null
          needs_human: boolean
          needs_human_at: string | null
          profile_pic_url: string | null
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
          last_interaction_at?: string | null
          created_at?: string
          updated_at?: string
          channel_id?: string | null
          needs_human?: boolean
          needs_human_at?: string | null
          profile_pic_url?: string | null
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
          last_interaction_at?: string | null
          created_at?: string
          updated_at?: string
          channel_id?: string | null
          needs_human?: boolean
          needs_human_at?: string | null
          profile_pic_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
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
          platform_message_id: string | null
          sent_by: string | null
          send_error: string | null
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
          platform_message_id?: string | null
          sent_by?: string | null
          send_error?: string | null
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
          platform_message_id?: string | null
          sent_by?: string | null
          send_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_apps: {
        Row: {
          id: string
          name: string
          app_id: string
          app_secret: string
          webhook_verify_token: string
          is_active: boolean
          created_at: string
          updated_at: string
          login_config_id: string | null
        }
        Insert: {
          id?: string
          name: string
          app_id: string
          app_secret: string
          webhook_verify_token?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          login_config_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          app_id?: string
          app_secret?: string
          webhook_verify_token?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          login_config_id?: string | null
        }
        Relationships: []
      }
      offers: {
        Row: {
          id: string
          title: string
          description: string | null
          price_before: number | null
          price_after: number | null
          banner_url: string | null
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
          price_after?: number | null
          banner_url?: string | null
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
          price_after?: number | null
          banner_url?: string | null
          start_date?: string | null
          end_date?: string | null
          is_active?: boolean
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          item_name: string
          quantity: number
          unit_price: number | null
          total_price: number | null
          notes: string | null
        }
        Insert: {
          id?: string
          order_id: string
          item_name: string
          quantity?: number
          unit_price?: number | null
          total_price?: number | null
          notes?: string | null
        }
        Update: {
          id?: string
          order_id?: string
          item_name?: string
          quantity?: number
          unit_price?: number | null
          total_price?: number | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
          status: Database["public"]["Enums"]["order_status"]
          payment_method: string
          internal_notes: string | null
          source: string
          created_at: string
          updated_at: string
          channel_id: string | null
          customer_notes: string | null
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
          status?: Database["public"]["Enums"]["order_status"]
          payment_method?: string
          internal_notes?: string | null
          source?: string
          created_at?: string
          updated_at?: string
          channel_id?: string | null
          customer_notes?: string | null
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
          status?: Database["public"]["Enums"]["order_status"]
          payment_method?: string
          internal_notes?: string | null
          source?: string
          created_at?: string
          updated_at?: string
          channel_id?: string | null
          customer_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_settings: {
        Row: {
          id: string
          channel_id: string | null
          facebook_post_id: string
          bot_enabled: boolean
          post_caption: string | null
          post_thumbnail_url: string | null
          post_url: string | null
          post_created_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          channel_id?: string | null
          facebook_post_id: string
          bot_enabled?: boolean
          post_caption?: string | null
          post_thumbnail_url?: string | null
          post_url?: string | null
          post_created_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          channel_id?: string | null
          facebook_post_id?: string
          bot_enabled?: boolean
          post_caption?: string | null
          post_thumbnail_url?: string | null
          post_url?: string | null
          post_created_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_settings_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          role: Database["public"]["Enums"]["user_role"]
          avatar_url: string | null
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          role?: Database["public"]["Enums"]["user_role"]
          avatar_url?: string | null
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: Database["public"]["Enums"]["user_role"]
          avatar_url?: string | null
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_active_staff: {
        Args: { user_id: string }
        Returns: boolean
      }
      get_public_settings: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
    }
    Enums: {
      complaint_priority: 'low' | 'medium' | 'high' | 'urgent'
      complaint_status: 'open' | 'in_progress' | 'resolved' | 'closed'
      order_status: 'confirmed' | 'issue' | 'cancelled'
      rule_match_type: 'any' | 'keywords'
      user_role: 'admin' | 'order_agent' | 'support_agent'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

// Convenience aliases used across the dashboard
export type UserRole = Enums<"user_role">
export type OrderStatus = Enums<"order_status">
export type ComplaintStatus = Enums<"complaint_status">
export type ComplaintPriority = Enums<"complaint_priority">
export type RuleMatchType = Enums<"rule_match_type">
export type CommentDecision = Tables<"comment_events">["decision"]
export type ChannelStatus = Tables<"channels">["status"]
export type ChannelPlatform = Tables<"channels">["platform"]
