# Intelligent Messenger Bot & Operations Control Dashboard: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade restaurant/business operations ecosystem featuring an automated Facebook Messenger & Comments Bot in n8n, powered by Supabase PostgreSQL, and managed by a Next.js 15 Control Dashboard with 3-tier Role-Based Access Control (Admin, Order Agent, Support Agent).

**Architecture:** A Supabase-centric architecture where PostgreSQL, Supabase Auth, Storage (CDN), and Realtime (WebSockets) form the single source of truth. The Next.js 15 App Router dashboard interacts directly with Supabase via Server Actions and SSR, while n8n handles Facebook Graph API webhooks, AI conversational ordering via Gemini, and Telegram group dispatching.

**Tech Stack:** Next.js 15 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Supabase (@supabase/ssr, @supabase/supabase-js), PostgreSQL, n8n (LangChain, Gemini 2.0 Flash, Facebook Graph API, Telegram API).

---

## File Structure & Directory Map

```
messenger-khedewy/
├── database/
│   ├── 01_schema.sql                  # Core tables, enums, triggers & functions
│   ├── 02_storage_and_realtime.sql    # Supabase storage buckets & realtime configuration
│   ├── 03_rls_policies.sql            # Row Level Security policies per role (admin, order_agent, support_agent)
│   └── 04_seed.sql                    # Initial seed data (default bot_settings, global_comment_rules, categories)
├── n8n-workflows/
│   ├── 01_facebook_comments_engine.json    # Post-specific & global comment auto-replies + private DMs
│   ├── 02_messenger_ai_ordering.json       # Conversational AI ordering, menu/offers cards, complaints
│   └── 03_telegram_alerts_dispatcher.json  # Push notifications to Telegram operations group
├── dashboard/                              # Next.js 15 App
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   └── login/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx              # Sidebar, topbar, role gates & audio alert provider
│   │   │   │   ├── page.tsx                # Analytics & Operations KPI Overview
│   │   │   │   ├── orders/page.tsx         # Live Kanban & Table orders management
│   │   │   │   ├── complaints/page.tsx     # CRM tickets, priority, agent assignment
│   │   │   │   ├── chat/page.tsx           # Live chat takeover & AI toggle
│   │   │   │   ├── menu/page.tsx           # Category & dish management + CDN photo upload
│   │   │   │   ├── offers/page.tsx         # Promotional banner management & scheduling
│   │   │   │   ├── post-rules/page.tsx     # Visual Facebook post picker + global comment rules
│   │   │   │   ├── settings/page.tsx       # Bot config, Telegram tokens, AI prompt, hours
│   │   │   │   └── team/page.tsx           # User roles & permissions (RBAC)
│   │   │   └── api/
│   │   │       └── facebook/
│   │   │           └── posts/route.ts      # Live Facebook Page posts sync via Graph API
│   │   ├── components/
│   │   │   ├── ui/                         # Base buttons, dialogs, inputs, badges
│   │   │   ├── orders/                     # OrderCard, KanbanColumn, ThermalReceipt
│   │   │   ├── complaints/                 # TicketCard, ResolutionModal
│   │   │   ├── post-rules/                 # VisualPostPickerModal, RuleEditor
│   │   │   ├── menu/                       # CategoryModal, MenuItemCard, ImageDropzone
│   │   │   └── providers/                  # RealtimeAudioProvider, SupabaseProvider
│   │   ├── lib/
│   │   │   ├── supabase/
│   │   │   │   ├── client.ts               # Browser client (@supabase/ssr)
│   │   │   │   ├── server.ts               # Server client for Server Actions & Route Handlers
│   │   │   │   └── middleware.ts           # Route protection & role enforcement
│   │   │   ├── facebook.ts                 # Facebook Graph API helper client
│   │   │   └── utils.ts                    # Formatters (currency, dates, Arabic text helpers)
│   │   └── types/
│   │       ├── database.types.ts           # Generated Supabase schema types
│   │       └── index.ts                    # Application view models & DTOs
└── docs/
    └── superpowers/
        ├── specs/2026-10-08-khedewy-bot-dashboard-design.md
        └── plans/2026-10-08-khedewy-bot-dashboard-plan.md
```

---

## Phase 1: Database Architecture & Supabase Setup

### Task 1: Complete SQL Schema & Enums (`database/01_schema.sql`)

**Files:**
- Create: `database/01_schema.sql`

- [ ] **Step 1: Write SQL Schema script**
Define custom ENUMs (`user_role`, `order_status`, `complaint_status`, `complaint_priority`, `rule_match_type`), and write `CREATE TABLE` definitions for:
- `profiles` (linked to `auth.users`)
- `bot_settings`
- `global_comment_rules`
- `post_rules` (including `post_thumbnail_url`, `post_url`, `post_caption`)
- `offers`
- `menu_categories` and `menu_items`
- `contacts` and `messages`
- `orders` and `order_items`
- `complaints`
Include updated timestamp triggers and auto-profile creation trigger on user signup.

- [ ] **Step 2: Commit Schema SQL**
```bash
git add database/01_schema.sql
git commit -m "feat(database): create core PostgreSQL schema and table definitions"
```

---

### Task 2: Storage Buckets, Realtime & Seed Data (`database/02_storage_and_realtime.sql` & `database/04_seed.sql`)

**Files:**
- Create: `database/02_storage_and_realtime.sql`
- Create: `database/04_seed.sql`

- [ ] **Step 1: Write Storage & Realtime script**
Configure Supabase Storage buckets `menu-assets` and `offer-banners` with public read access. Enable `supabase_realtime` publication for `orders`, `complaints`, and `messages`.

- [ ] **Step 2: Write Seed script**
Insert default record for `bot_settings` (currency EGP, business hours disabled, AI prompt, auto-pause enabled), default `global_comment_rules` with 3 randomized Arabic comment replies and default DM payload, and sample food categories.

- [ ] **Step 3: Commit Storage, Realtime & Seed scripts**
```bash
git add database/02_storage_and_realtime.sql database/04_seed.sql
git commit -m "feat(database): add storage buckets, realtime replication and default seed data"
```

---

### Task 3: Row-Level Security (RLS) Policies (`database/03_rls_policies.sql`)

**Files:**
- Create: `database/03_rls_policies.sql`

- [ ] **Step 1: Write RLS Policies**
Enable RLS on all tables.
- Helper function `get_user_role(auth.uid())` returning `user_role`.
- Policy for `admin`: full access on all tables.
- Policy for `order_agent`: read/write on `orders` & `order_items`, read-only on `menu_categories`, `menu_items`, `offers`.
- Policy for `support_agent`: read/write on `complaints`, `contacts`, `messages`.
- Policy for `service_role`: bypass for n8n automation.

- [ ] **Step 2: Commit RLS script**
```bash
git add database/03_rls_policies.sql
git commit -m "feat(database): add row-level security policies for 3-tier RBAC"
```

---

## Phase 2: n8n Automation Workflows (The Bot Engine)

### Task 4: Workflow 1 – Facebook Page Comments Auto-Reply Engine

**Files:**
- Create: `n8n-workflows/01_facebook_comments_engine.json`

- [ ] **Step 1: Build the Workflow JSON specification**
Structure the workflow nodes:
1. `Webhook`: receives `feed` webhook (`item == "comment"`).
2. `Filter`: drop if comment sender ID == Page ID.
3. `Supabase Node (Query post_rules)`: match `facebook_post_id == $json.post_id AND is_active == true`.
4. `Switch Node`:
   - *Case 1 (Post rule exists)*: Check `match_type`. If `'keywords'`, verify `trigger_keywords`. Select random reply from `comment_replies`. Call Graph API `POST /{comment_id}/comments` and `POST /{comment_id}/likes`. Send private DM via `POST /me/messages` with `recipient: {"comment_id": comment_id}`, `dm_message`, `dm_image_url`, and buttons. Increment `total_triggers`.
   - *Case 2 (No specific rule)*: Query `global_comment_rules`. If enabled, pick random reply from `global_comment_rules.comment_replies`, post public comment, auto-like, and send fallback DM with interactive buttons ("قائمة المنيو", "العروض", "تحدث مع موظف").

- [ ] **Step 2: Commit Comments Workflow**
```bash
git add n8n-workflows/01_facebook_comments_engine.json
git commit -m "feat(n8n): implement facebook comments auto-reply and private DM workflow"
```

---

### Task 5: Workflow 2 – Messenger Webhook & Conversational AI Ordering

**Files:**
- Create: `n8n-workflows/02_messenger_ai_ordering.json`

- [ ] **Step 1: Build the Messenger AI & Ordering Workflow JSON**
Structure the workflow nodes:
1. `Webhook`: Facebook Messenger `messages` event.
2. `Supabase Node`: Upsert `contacts` with `platform_user_id`. Retrieve `ai_enabled` flag.
3. `If Node (Human Handoff Active?)`: If `ai_enabled == false`, insert user message to `messages` table and stop (hand off to live agent).
4. `Payload Switch`:
   - If payload is `"VIEW_MENU"`: Fetch `menu_categories` and send Messenger carousel cards or send `bot_settings.menu_full_image_url`.
   - If payload is `"VIEW_OFFERS"`: Fetch active `offers` and send rich cards with discounts and "اطلب الآن" button.
   - If payload is `"HUMAN_AGENT"` or complaint: Insert into `complaints`. If `bot_settings.auto_pause_on_complaint == true`, set `contacts.ai_enabled = false`, notify user that an agent will join, and trigger Telegram alert.
5. `LangChain AI Agent (Gemini 2.0 Flash)`:
   - Tool `SearchMenu`: queries `menu_items` for prices, descriptions, and availability.
   - Tool `CreateOrder`: takes `items` array, `customer_name`, `phone`, `delivery_address`. Inserts record into `orders` (status: `pending`) and `order_items`. Sends confirmation summary back to customer.

- [ ] **Step 2: Commit Messenger AI Workflow**
```bash
git add n8n-workflows/02_messenger_ai_ordering.json
git commit -m "feat(n8n): implement conversational AI ordering and messenger workflow"
```

---

### Task 6: Workflow 3 – Telegram Operations Alerts Dispatcher

**Files:**
- Create: `n8n-workflows/03_telegram_alerts_dispatcher.json`

- [ ] **Step 1: Build the Telegram Dispatcher Workflow**
Structure the workflow nodes:
1. `Webhook / Database Trigger`: Called when a new row is added to `orders` or `complaints`.
2. `Supabase Node`: Fetch `bot_settings.notify_telegram`, `telegram_bot_token`, and `telegram_chat_id`.
3. `Code Node`: Format message with HTML markup:
   - Orders: Order #, Customer Name, Phone (clickable `tel:`), Delivery Address, Itemized list, Total Amount.
   - Complaints: Ticket #, Customer Phone, Priority badge, Issue text.
4. `HTTP Request Node`: Telegram Bot API `sendMessage`.

- [ ] **Step 2: Commit Telegram Workflow**
```bash
git add n8n-workflows/03_telegram_alerts_dispatcher.json
git commit -m "feat(n8n): implement telegram operations alerts workflow"
```

---

## Phase 3: Control Dashboard Foundation (Next.js 15)

### Task 7: Next.js 15 Initialization & Supabase Client Setup

**Files:**
- Create: `dashboard/package.json`
- Create: `dashboard/tsconfig.json`
- Create: `dashboard/next.config.ts`
- Create: `dashboard/src/lib/supabase/client.ts`
- Create: `dashboard/src/lib/supabase/server.ts`
- Create: `dashboard/src/lib/supabase/middleware.ts`
- Create: `dashboard/src/middleware.ts`
- Create: `dashboard/src/types/database.types.ts`

- [ ] **Step 1: Initialize Next.js 15 project structure**
Install dependencies: `next@15.5.6`, `react@19.1.0`, `react-dom@19.1.0`, `@supabase/ssr`, `@supabase/supabase-js`, `tailwindcss@4`, `lucide-react`, `date-fns`.

- [ ] **Step 2: Configure Supabase SSR Helpers & Types**
Implement `createBrowserClient` in `client.ts` and `createServerClient` in `server.ts`. Generate or provide complete TypeScript types for all database tables in `database.types.ts`.

- [ ] **Step 3: Implement Auth Middleware & Role Guard**
Write `middleware.ts` to refresh session tokens, protect `/dashboard/*` routes, and enforce role redirection:
- If `order_agent` tries accessing `/dashboard/settings` or `/dashboard/menu`, redirect to `/dashboard/orders`.
- If `support_agent` tries accessing `/dashboard/orders`, redirect to `/dashboard/complaints`.

- [ ] **Step 4: Commit Foundation Code**
```bash
git add dashboard/
git commit -m "feat(dashboard): initialize next.js 15 app with supabase ssr auth and role middleware"
```

---

### Task 8: Authentication Page & Main Dashboard Layout

**Files:**
- Create: `dashboard/src/app/(auth)/login/page.tsx`
- Create: `dashboard/src/app/(dashboard)/layout.tsx`
- Create: `dashboard/src/components/layout/Sidebar.tsx`
- Create: `dashboard/src/components/layout/Topbar.tsx`
- Create: `dashboard/src/components/providers/RealtimeAudioProvider.tsx`
- Create: `dashboard/public/sounds/order-alert.mp3`

- [ ] **Step 1: Build Clean Arabic/English Login Page**
Implement `/login` page with Supabase Auth email/password login, remember me, error alerts, and clean dark/light UI.

- [ ] **Step 2: Implement Role-Aware Sidebar & Topbar**
Create responsive sidebar navigation with icons:
- Admin: Overview, Orders, Complaints, Live Chat, Menu, Offers, Post Rules, Team, Settings.
- Order Agent: Orders only.
- Support Agent: Complaints, Live Chat.
Add unread badge counters on Orders and Complaints tabs.

- [ ] **Step 3: Implement Realtime Audio Provider**
Build `RealtimeAudioProvider.tsx` using `supabase.channel('public:orders')` and `supabase.channel('public:complaints')`. On `INSERT` event:
- Play alert sound (`order-alert.mp3`).
- Show toast notification with direct link to view the new order or ticket.

- [ ] **Step 4: Commit Layout and Auth components**
```bash
git add dashboard/src/app/\(auth\)/ dashboard/src/app/\(dashboard\)/layout.tsx dashboard/src/components/
git commit -m "feat(dashboard): add login view, role-aware sidebar layout and realtime audio alerts"
```

---

## Phase 4: Core Operational Dashboard Modules

### Task 9: Real-time Orders Management (`/dashboard/orders`)

**Files:**
- Create: `dashboard/src/app/(dashboard)/orders/page.tsx`
- Create: `dashboard/src/components/orders/OrderKanban.tsx`
- Create: `dashboard/src/components/orders/OrderCard.tsx`
- Create: `dashboard/src/components/orders/OrderDetailsModal.tsx`
- Create: `dashboard/src/components/orders/ThermalReceipt.tsx`

- [ ] **Step 1: Build Orders Board (Kanban & Table Views)**
Columns: `New (Pending)`, `Preparing`, `Out for Delivery`, `Delivered`, `Cancelled`.
- Drag or click to change status.
- Filter by date range (Today, Yesterday, Custom), search by customer phone or order number.

- [ ] **Step 2: Build Order Details & Thermal Receipt Printer**
Modal displaying full customer address, phone with one-click call, itemized dishes with notes, subtotal, delivery fee, and total. Add print button rendering clean 80mm thermal kitchen receipt format.

- [ ] **Step 3: Commit Orders Module**
```bash
git add dashboard/src/app/\(dashboard\)/orders/ dashboard/src/components/orders/
git commit -m "feat(dashboard): implement real-time orders kanban, status workflow and thermal receipt"
```

---

### Task 10: Complaints & CRM Tickets Module (`/dashboard/complaints`)

**Files:**
- Create: `dashboard/src/app/(dashboard)/complaints/page.tsx`
- Create: `dashboard/src/components/complaints/ComplaintCard.tsx`
- Create: `dashboard/src/components/complaints/ComplaintDetailsModal.tsx`

- [ ] **Step 1: Build Complaints Queue**
List complaints grouped by status: `Open`, `In Progress`, `Resolved`.
Display priority tags: `Low` (gray), `Medium` (blue), `High` (orange), `Urgent` (red pulse).

- [ ] **Step 2: Build Resolution Workflow**
Modal to assign complaint to agent, write internal resolution notes, mark as resolved, and click "Takeover Chat" which links directly to `/dashboard/chat?contactId=...` and disables AI for that contact.

- [ ] **Step 3: Commit Complaints Module**
```bash
git add dashboard/src/app/\(dashboard\)/complaints/ dashboard/src/components/complaints/
git commit -m "feat(dashboard): implement complaints CRM queue, priority tagging and resolution notes"
```

---

### Task 11: Live Chat & Human Takeover Module (`/dashboard/chat`)

**Files:**
- Create: `dashboard/src/app/(dashboard)/chat/page.tsx`
- Create: `dashboard/src/components/chat/ChatThread.tsx`
- Create: `dashboard/src/components/chat/ChatSidebar.tsx`

- [ ] **Step 1: Build Chat Interface with AI Toggle Switch**
- Left pane: Contacts list ordered by `last_interaction_at`, with unread badge and status (`AI Active` / `Paused`).
- Right pane: Active message thread with customer messages, bot replies, and agent replies.
- Prominent header switch: **"Bot AI Enabled"** (toggles `contacts.ai_enabled` in real-time).
- Agent input box: Send manual message through Facebook Graph API.

- [ ] **Step 2: Commit Live Chat Module**
```bash
git add dashboard/src/app/\(dashboard\)/chat/ dashboard/src/components/chat/
git commit -m "feat(dashboard): implement live chat view with real-time AI pause/resume toggle"
```

---

### Task 12: Visual Facebook Post Picker & Comment Rules (`/dashboard/post-rules`)

**Files:**
- Create: `dashboard/src/app/api/facebook/posts/route.ts`
- Create: `dashboard/src/app/(dashboard)/post-rules/page.tsx`
- Create: `dashboard/src/components/post-rules/VisualPostPickerModal.tsx`
- Create: `dashboard/src/components/post-rules/PostRuleForm.tsx`
- Create: `dashboard/src/components/post-rules/GlobalCommentRuleForm.tsx`

- [ ] **Step 1: Implement Live Facebook Page Posts API Route**
`GET /api/facebook/posts`: Calls Facebook Graph API `GET /{page_id}/published_posts?fields=id,message,created_time,full_picture,permalink_url&limit=25` using the page access token. Returns JSON array of live posts.

- [ ] **Step 2: Build Visual Post Picker Modal**
Visual grid dialog showing:
- Post image thumbnail
- Caption text preview
- Date published
- Tag indicating if a rule already exists
- Clicking "Select Post" auto-fills `facebook_post_id`, `post_thumbnail_url`, `post_url`, and `post_caption`.

- [ ] **Step 3: Build Post Rule Form & Global Comments Tab**
- Tab 1: Post-specific rules (trigger keywords, randomized public reply variations list, private DM message, buttons builder, active toggle).
- Tab 2: Global comment fallback settings (enable/disable, comment reply variations, global DM body with menu/offers/agent buttons).

- [ ] **Step 4: Commit Post Rules Module**
```bash
git add dashboard/src/app/api/facebook/ dashboard/src/app/\(dashboard\)/post-rules/ dashboard/src/components/post-rules/
git commit -m "feat(dashboard): implement visual facebook post picker and post/global comment rules"
```

---

### Task 13: Menu & Digital Catalog Management (`/dashboard/menu`)

**Files:**
- Create: `dashboard/src/app/(dashboard)/menu/page.tsx`
- Create: `dashboard/src/components/menu/CategoryManager.tsx`
- Create: `dashboard/src/components/menu/MenuItemGrid.tsx`
- Create: `dashboard/src/components/menu/MenuItemModal.tsx`
- Create: `dashboard/src/components/menu/FullMenuUploader.tsx`

- [ ] **Step 1: Build Categories & Items Manager**
- Categories sidebar with sort index and item count.
- Items grid with photo, name, description, price, sale price, and quick `is_available` switch.

- [ ] **Step 2: Direct Image CDN Upload via Supabase Storage**
Integrate drag-and-drop file upload to `menu-assets` bucket. Generates public CDN URL automatically.

- [ ] **Step 3: Master Menu Full Image/PDF Uploader**
Upload card for full menu image / PDF with preview and copy link button.

- [ ] **Step 4: Commit Menu Module**
```bash
git add dashboard/src/app/\(dashboard\)/menu/ dashboard/src/components/menu/
git commit -m "feat(dashboard): implement menu categories, dishes management with CDN image uploads"
```

---

### Task 14: Offers & Promotions Management (`/dashboard/offers`)

**Files:**
- Create: `dashboard/src/app/(dashboard)/offers/page.tsx`
- Create: `dashboard/src/components/offers/OfferCard.tsx`
- Create: `dashboard/src/components/offers/OfferModal.tsx`

- [ ] **Step 1: Build Offers View & CRUD Modal**
- Offers grid displaying banner, title, discount badge (`% off`), price before/after, and validity dates.
- Modal with title, description, price before, price after, start/end date picker, active toggle, and banner upload to `offer-banners` storage bucket.

- [ ] **Step 2: Commit Offers Module**
```bash
git add dashboard/src/app/\(dashboard\)/offers/ dashboard/src/components/offers/
git commit -m "feat(dashboard): implement offers and promotions management with banner uploads"
```

---

### Task 15: Bot Settings & Staff RBAC (`/dashboard/settings` & `/dashboard/team`)

**Files:**
- Create: `dashboard/src/app/(dashboard)/settings/page.tsx`
- Create: `dashboard/src/app/(dashboard)/team/page.tsx`
- Create: `dashboard/src/components/team/InviteUserModal.tsx`

- [ ] **Step 1: Build System Settings Form**
Single-page settings management:
- Master Bot Toggle (`bot_enabled`)
- Auto-pause AI on complaint toggle (`auto_pause_on_complaint`)
- Telegram notifications toggle, bot token, and chat ID
- Working hours switch, open/close time pickers, and off-hours message
- AI Personality & System Prompt textarea

- [ ] **Step 2: Build Team & RBAC Management**
List all profiles with name, role badge, last active, and status. Modal to invite new user and assign role: `admin`, `order_agent`, or `support_agent`. Action to deactivate or delete account.

- [ ] **Step 3: Commit Settings and Team Modules**
```bash
git add dashboard/src/app/\(dashboard\)/settings/ dashboard/src/app/\(dashboard\)/team/ dashboard/src/components/team/
git commit -m "feat(dashboard): implement bot settings management and team RBAC administration"
```

---

## Phase 5: Verification & Quality Assurance

### Task 16: Verification, Automated Tests & Walkthrough

**Files:**
- Create: `dashboard/src/__tests__/rules-matcher.test.ts`
- Create: `dashboard/src/__tests__/role-guard.test.ts`
- Create: `docs/superpowers/walkthroughs/2026-10-08-khedewy-bot-dashboard-walkthrough.md`

- [ ] **Step 1: Write Unit Test for Keyword & Post Rule Matching**
Verify that `match_type == 'keywords'` properly catches substrings and Arabic variations (e.g. "بكام", "سعر"), and that randomized reply selection returns different variations.

- [ ] **Step 2: Write Unit Test for Role Middleware Access Control**
Verify that `order_agent` is denied access to `/dashboard/settings` and `/dashboard/menu`, while `admin` has full access.

- [ ] **Step 3: Run Tests & Build Verification**
Run: `npm run lint` and `npm run build` inside `dashboard/`. Verify zero TypeScript errors.

- [ ] **Step 4: Create Walkthrough Documentation**
Write complete deployment & setup walkthrough explaining how to import the 3 n8n workflows, run the SQL migrations in Supabase, and configure environment variables.

- [ ] **Step 5: Commit Verification Tests & Walkthrough**
```bash
git add dashboard/src/__tests__/ docs/superpowers/walkthroughs/
git commit -m "test(verification): add rules matching and RBAC unit tests with deployment walkthrough"
```
