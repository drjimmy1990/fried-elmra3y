# Al-Khedewy Restaurant Bot & Dashboard Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Al-Khedewy fried chicken restaurant operations system across Supabase database, Next.js 15 dashboard, and n8n automation workflows according to the owner's updated operational requirements.

**Architecture:** 
1. Database migrations streamline order statuses to `pending` and `confirmed`, complaint statuses to `open` and `resolved`, add branches and zone-based delivery pricing tables, link offers to orders, and remove legacy fields.
2. The Next.js dashboard adapts the Kanban to 2 columns with manual order confirmation dispatching n8n webhooks, converts complaints to default table view, introduces a full branch & delivery zone manager, streamlines offers and comment rules, and restricts Live Chat strictly to admins.
3. n8n workflows integrate branch & zone delivery fee calculation into the AI ordering agent, create an order confirmation webhook messenger notifier, and streamline the Facebook comments engine with lightweight AI intent routing.

**Tech Stack:** Next.js 15 (App Router, Server Components, TypeScript), Supabase (PostgreSQL, Realtime, RLS), Tailwind CSS v4, Lucide React, n8n Automation Workflows (v2), Meta Graph API v24.0.

---

### File Structure Map

```
database/
└── 12_owner_requirements_upgrade.sql             # Migration script for schema, enums, tables, RLS

dashboard/
├── src/
│   ├── types/
│   │   └── database.types.ts                     # Updated TypeScript definitions for database
│   ├── lib/
│   │   └── role-guard.ts                         # Restrict /chat to admin only
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── orders/
│   │   │   │   └── page.tsx                      # Orders page with branch and offer filters
│   │   │   ├── complaints/
│   │   │   │   └── page.tsx                      # Default table view, open/resolved only
│   │   │   ├── branches/
│   │   │   │   └── page.tsx                      # Branches & delivery zones admin page
│   │   │   ├── offers/
│   │   │   │   └── page.tsx                      # Offers page with start_date & auto-sorting
│   │   │   ├── chat/
│   │   │   │   └── page.tsx                      # Admin-only server guard
│   │   │   └── post-rules/
│   │   │       └── page.tsx                      # Simplified comment rules
│   │   └── api/
│   │       ├── orders/
│   │       │   └── confirm/
│   │       │       └── route.ts                  # Webhook dispatcher for order confirmation
│   │       ├── branches/
│   │       │   └── route.ts                      # Branches & zones CRUD API
│   │       └── chat/
│   │           └── send/
│   │               └── route.ts                  # Admin-only chat send API
│   └── components/
│       ├── layout/
│       │   └── Sidebar.tsx                       # Add branches link, hide chat for non-admin
│       ├── orders/
│       │   ├── types.ts                          # Updated OrderStatus ('pending' | 'confirmed')
│       │   ├── OrderKanban.tsx                   # 2 columns, branch/offer filters, confirm action
│       │   ├── OrderCard.tsx                     # Display branch, offer, confirm button
│       │   └── OrderDetailsModal.tsx             # Show branch & offer details
│       ├── complaints/
│       │   ├── types.ts                          # ComplaintStatus ('open' | 'resolved')
│       │   ├── ComplaintsTable.tsx               # Primary default table view without priority
│       │   └── ComplaintDetailsModal.tsx         # Simple open/resolved toggle
│       ├── branches/
│       │   ├── types.ts                          # Branch and DeliveryZone interfaces
│       │   ├── BranchesManager.tsx               # Branch directory and zones drawer/modal
│       │   ├── BranchModal.tsx                   # Create/Edit branch details
│       │   └── DeliveryZonesModal.tsx            # Manage zones & delivery fees per branch
│       ├── offers/
│       │   ├── types.ts                          # Updated offer type with start_date
│       │   ├── OfferCard.tsx                     # Start date display, no sort_order
│       │   └── OfferModal.tsx                    # DateTime picker for start & end date
│       └── post-rules/
│           ├── GlobalCommentRuleForm.tsx         # Cleaned fallback rules with variations
│           └── PostRuleModal.tsx                 # Cleaned post rules without image buttons
```

---

## Task 1: Database Schema & Migration (`database/12_owner_requirements_upgrade.sql`)

**Files:**
- Create: `database/12_owner_requirements_upgrade.sql`
- Modify: `dashboard/src/types/database.types.ts`

- [ ] **Step 1: Write the migration script**
Create `database/12_owner_requirements_upgrade.sql` with:
- Update `order_status` enum to only `'pending'` and `'confirmed'`. Migrate existing statuses (`confirmed` stays `confirmed`, all others become `pending`).
- Update `complaint_status` enum to only `'open'` and `'resolved'`. Migrate existing statuses (`resolved` and `closed` become `resolved`, others become `open`).
- Drop `priority` column from `complaints` table and drop `complaint_priority` enum.
- Create `branches` table: `id UUID`, `name TEXT NOT NULL`, `phone TEXT`, `address TEXT NOT NULL`, `google_maps_url TEXT`, `is_active BOOLEAN DEFAULT true`, `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`.
- Create `branch_delivery_zones` table: `id UUID`, `branch_id UUID REFERENCES branches(id) ON DELETE CASCADE`, `zone_name TEXT NOT NULL`, `delivery_fee NUMERIC NOT NULL DEFAULT 15`, `estimated_delivery_time TEXT`, `is_active BOOLEAN DEFAULT true`, `created_at TIMESTAMPTZ DEFAULT now()`, `updated_at TIMESTAMPTZ DEFAULT now()`.
- Alter `orders` table:
  - Add `branch_id UUID REFERENCES branches(id) ON DELETE SET NULL`.
  - Add `offer_id UUID REFERENCES offers(id) ON DELETE SET NULL`.
  - Make `payment_method` optional (`DEFAULT 'cash'`).
- Alter `offers` table:
  - Add `start_date TIMESTAMPTZ DEFAULT now()`.
  - Drop `sort_order` column.
- Enable RLS and create standard policies for `branches` and `branch_delivery_zones` allowing authenticated staff full access and anon public read for bot integration.

- [ ] **Step 2: Apply migration to Supabase**
Run migration script using Node.js script with postgres or Supabase management API, and verify 0 errors.

- [ ] **Step 3: Update `database.types.ts`**
Update `dashboard/src/types/database.types.ts` to reflect the new enums, new tables (`branches`, `branch_delivery_zones`), and altered columns on `orders`, `complaints`, and `offers`.

- [ ] **Step 4: Verify TypeScript compilation**
Run: `cd dashboard && npx tsc --noEmit -p .` to identify all downstream type errors that will be fixed in subsequent tasks.

---

## Task 2: Restructure Orders Module (`dashboard/src/components/orders/`)

**Files:**
- Modify: `dashboard/src/components/orders/types.ts`
- Modify: `dashboard/src/components/orders/OrderKanban.tsx`
- Modify: `dashboard/src/components/orders/OrderCard.tsx`
- Modify: `dashboard/src/components/orders/OrderDetailsModal.tsx`
- Create: `dashboard/src/app/api/orders/confirm/route.ts`
- Modify: `dashboard/src/app/(dashboard)/orders/page.tsx`

- [ ] **Step 1: Update orders types in `types.ts`**
- Set `OrderStatus = 'pending' | 'confirmed'`.
- Remove `KanbanColumnDef` references to `issue` and `cancelled`.
- Update `OrderRow` and `OrderWithItems` to include optional `branch?: { id: string; name: string } | null` and `offer?: { id: string; title: string } | null`.
- Remove `payment_method` required fields.

- [ ] **Step 2: Implement Order Confirmation Webhook API (`/api/orders/confirm`)**
Create `dashboard/src/app/api/orders/confirm/route.ts`:
- Accepts `POST` with `{ orderId }`.
- Verifies caller is authenticated staff (`requireStaff(['admin', 'order_agent'])`).
- Fetches order details along with contact details (`platform_user_id` / PSID, `channel_id`, `token`).
- Updates order status to `'confirmed'`.
- Dispatches webhook to n8n order confirmation endpoint:
  ```json
  {
    "order_id": order.id,
    "order_number": order.order_number,
    "customer_name": order.customer_name,
    "customer_phone": order.customer_phone,
    "delivery_address": order.delivery_address,
    "total_amount": order.total_amount,
    "psid": contact.platform_user_id,
    "page_id": channel.external_id,
    "token": channel_secret.access_token
  }
  ```
- Returns `{ success: true, order }`.

- [ ] **Step 3: Update `OrderKanban.tsx`**
- Columns reduced to 2:
  1. `pending`: "قيد الانتظار" (Amber border/badge)
  2. `confirmed`: "مؤكد" (Emerald border/badge)
- Add Branch Filter dropdown: All Branches / List of active branches fetched from Supabase.
- Add Offer Filter dropdown: All Orders / Orders with active offers.
- Handle "تأكيد الطلب" action: calls `/api/orders/confirm` optimistically, updating state immediately.

- [ ] **Step 4: Update `OrderCard.tsx` and `OrderDetailsModal.tsx`**
- Remove payment method badge and display.
- Add branch badge (e.g. `فرع الدقي 📍`).
- Add offer badge if `offer_id` is present (e.g. `عرض: وجبة التوفير ⭐`).
- For cards in `pending` column, display a prominent quick-action button: `تأكيد الطلب ✅`.
- Update `OrderDetailsModal.tsx` to display branch name and offer name cleanly.

- [ ] **Step 5: Update `orders/page.tsx`**
- Query active `branches` and active `offers` to pass to the client filter bar.
- Verify page renders without errors.

---

## Task 3: Restructure Complaints Module (`dashboard/src/components/complaints/`)

**Files:**
- Modify: `dashboard/src/components/complaints/types.ts`
- Modify: `dashboard/src/components/complaints/ComplaintsTable.tsx`
- Modify: `dashboard/src/components/complaints/ComplaintDetailsModal.tsx`
- Modify: `dashboard/src/app/(dashboard)/complaints/page.tsx`

- [ ] **Step 1: Update complaints types**
- `ComplaintStatus = 'open' | 'resolved'`.
- Remove `complaint_priority` from types.

- [ ] **Step 2: Update `ComplaintsTable.tsx` as default view**
- Make Table View the default view.
- Remove Priority column from table header and table rows.
- Status tabs:
  - "الكل" (All)
  - "مفتوحة" (Open - Rose badge)
  - "تم الحل" (Resolved - Emerald badge)
- Add quick action button in table row: "تم الحل ✅" for open complaints, and "إعادة فتح 🔄" for resolved complaints.

- [ ] **Step 3: Update `ComplaintDetailsModal.tsx`**
- Remove Priority selector, badges, and dropdowns.
- Simple status control: single toggle or button switching between `open` and `resolved`.
- Show linked order number and customer phone.

- [ ] **Step 4: Verify `complaints/page.tsx`**
- Ensure page mounts directly with `viewMode = 'table'`.

---

## Task 4: Implement Branches & Delivery Zones Management (`dashboard/src/components/branches/`)

**Files:**
- Create: `dashboard/src/components/branches/types.ts`
- Create: `dashboard/src/components/branches/BranchesManager.tsx`
- Create: `dashboard/src/components/branches/BranchModal.tsx`
- Create: `dashboard/src/components/branches/DeliveryZonesModal.tsx`
- Create: `dashboard/src/app/(dashboard)/branches/page.tsx`
- Create: `dashboard/src/app/api/branches/route.ts`
- Modify: `dashboard/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Define types in `branches/types.ts`**
- `Branch`: id, name, phone, address, google_maps_url, is_active, created_at, zones_count?.
- `DeliveryZone`: id, branch_id, zone_name, delivery_fee, estimated_delivery_time, is_active, created_at.

- [ ] **Step 2: Create `BranchModal.tsx`**
- Form dialog for creating/editing branch:
  - Branch Name (Arabic required, e.g. "فرع الدقي")
  - Phone number (e.g. "01000000000")
  - Full Address (e.g. "شارع التحرير، الدقي، الجيزة")
  - Google Maps URL (e.g. "https://maps.google.com/...")
  - Active Switch (`is_active`).

- [ ] **Step 3: Create `DeliveryZonesModal.tsx`**
- Modal allowing admin to manage delivery zones for a specific branch:
  - List of zones with zone name, delivery fee (EGP), estimated delivery time, and active toggle.
  - Inline or modal form to add new delivery zone:
    - Zone Name (`zone_name`, e.g. "المهندسين")
    - Delivery Fee (`delivery_fee`, e.g. 20)
    - Estimated Time (`estimated_delivery_time`, e.g. "30-45 دقيقة")
  - Edit and Delete zone actions.
  - Updates saved to `branch_delivery_zones`.

- [ ] **Step 4: Create `BranchesManager.tsx`**
- Top KPI summary: Total Branches, Active Branches, Total Delivery Zones.
- Action button: "إضافة فرع جديد" opening `BranchModal`.
- Grid of Branch Cards:
  - Branch title, phone, address, Google Maps link button.
  - Badge with count of delivery zones (e.g. "5 مناطق توصيل").
  - Button "إدارة مناطق وأسعار التوصيل" opening `DeliveryZonesModal`.
  - Edit and Delete branch buttons.
  - Instant `is_active` toggle switch.

- [ ] **Step 5: Create `branches/page.tsx` & add to Sidebar**
- Server component restricted to `admin`.
- Fetches all branches and their zones count.
- In `Sidebar.tsx`: Add navigation link for `الفروع ومناطق التوصيل 🏢` (`/dashboard/branches`).

---

## Task 5: Restructure Offers Module (`dashboard/src/components/offers/`)

**Files:**
- Modify: `dashboard/src/components/offers/types.ts`
- Modify: `dashboard/src/components/offers/OfferModal.tsx`
- Modify: `dashboard/src/components/offers/OfferCard.tsx`
- Modify: `dashboard/src/components/offers/OffersContainer.tsx`
- Modify: `dashboard/src/app/(dashboard)/offers/page.tsx`

- [ ] **Step 1: Update offer types**
- Include `start_date: string | null` (prominently used), remove `sort_order`.

- [ ] **Step 2: Update `OfferModal.tsx`**
- Remove Sort Order input field.
- Add DateTime picker for `start_date` ("تاريخ ووقت بدء العرض").
- DateTime picker for `end_date` ("تاريخ ووقت انتهاء العرض").

- [ ] **Step 3: Update `OfferCard.tsx` and `OffersContainer.tsx`**
- Remove sort order badges or drag handles.
- Display start date and end date clearly (e.g. "يبدأ: 10 أكتوبر 2026 - ينتهي: 20 أكتوبر 2026").
- Order offers by `is_active desc, created_at desc` in queries.

---

## Task 6: Clean Up Post Rules & Comments (`dashboard/src/components/post-rules/`)

**Files:**
- Modify: `dashboard/src/components/post-rules/GlobalCommentRuleForm.tsx`
- Modify: `dashboard/src/components/post-rules/PostRuleModal.tsx`
- Modify: `dashboard/src/components/post-rules/PostRulesContainer.tsx`

- [ ] **Step 1: Clean `GlobalCommentRuleForm.tsx`**
- Remove "قسم الحماية من الاسبام" (anti-spam options).
- Remove "قسم كلمات الشكاوى والكلمات الحساسة".
- Remove "قواعد مخصصة لكلمات معينة".
- Keep: Master enabled switch, Multiple randomized public comment replies ("تم الرد في الخاص 🌹", etc.), and Quick Action Buttons builder (Menu, Offers, Contact Staff).

- [ ] **Step 2: Clean `PostRuleModal.tsx`**
- Remove buttons for uploading/attaching menu images or offers images inside comment rules.
- Retain text DM reply and standard quick action buttons (Menu link, Offers link, Human Agent).

---

## Task 7: Enforce Strict Admin-Only Live Chat Privacy (`/dashboard/chat`)

**Files:**
- Modify: `dashboard/src/lib/role-guard.ts`
- Modify: `dashboard/src/components/layout/Sidebar.tsx`
- Modify: `dashboard/src/app/(dashboard)/chat/page.tsx`
- Modify: `dashboard/src/app/api/chat/send/route.ts`

- [ ] **Step 1: Update `role-guard.ts`**
- Change route permissions so `/dashboard/chat` is allowed ONLY for `admin`.
- Remove `/dashboard/chat` from `support_agent` and `order_agent`.

- [ ] **Step 2: Update `Sidebar.tsx`**
- Hide the "المحادثات" (`/dashboard/chat`) navigation item completely when `profile?.role !== 'admin'`.

- [ ] **Step 3: Guard `chat/page.tsx` and `api/chat/send/route.ts`**
- In `chat/page.tsx`: If user role is not `admin`, redirect to `/dashboard/orders`.
- In `/api/chat/send/route.ts`: Change guard to `requireStaff(['admin'])`.

---

## Task 8: n8n Automation Workflows Integration Plan

**Files:**
- Spec 1: `04_order_confirmation_webhook.json` (New workflow)
- Spec 2: Updated Messenger AI Ordering Workflow
- Spec 3: Updated Facebook Comments Engine Workflow

- [ ] **Step 1: Order Confirmation Dispatcher Workflow Spec**
- **Trigger:** Webhook node `POST /webhook/order-confirmed`.
- **Payload:** `{ order_id, order_number, customer_name, delivery_address, total_amount, psid, page_id, token }`.
- **Action 1 (HTTP Request):** Send Facebook message to `psid`:
  ```json
  {
    "recipient": { "id": "{{ $json.psid }}" },
    "message": {
      "text": "أهلاً يا {{ $json.customer_name }} 🍗 تم تأكيد أوردرك رقم #{{ $json.order_number }} بنجاح! جاري تحضيره في الفرع وتسليمه للطيار فوراً 🛵🔥"
    },
    "messaging_type": "RESPONSE"
  }
  ```
- **Action 2 (Supabase):** Insert bot reply into `messages` table with `sender_type = 'bot'`, `is_read = true`.

- [ ] **Step 2: Messenger AI Ordering Workflow Updates**
- **Query Branches & Zones:**
  - Add Supabase query nodes to load all active `branches` and `branch_delivery_zones`.
- **AI Agent System Message:**
  - Inject branch names, addresses, and delivery zones with fees:
    > "فروع المطعم المتاحة ومناطق التوصيل لكل فرع: [قائمة الفروع والمناطق والأسعار]... حدد الفرع المناسب وسعر توصيل منطقة العميل بدقة... وضع `branch_id` في `order_details`."
  - Inject active offers:
    > "العروض الحالية المتاحة: [قائمة العروض]... إذا طلب العميل أحد العروض، ضع `offer_id` في `order_details`."
- **Create Order Node:**
  - Save `status = 'pending'`.
  - Save `branch_id = $json.order_details?.branch_id`.
  - Save `offer_id = $json.order_details?.offer_id`.
  - Save `delivery_fee` computed by AI for the zone.
- **Log Complaint Node:**
  - Remove `priority` field.
  - Save `status = 'open'`.

- [ ] **Step 3: Comments Engine AI Intent Flow Spec**
- When a comment webhook arrives:
  1. Lightweight AI model (`qwen3.8-flash`) classifies customer intent:
     - `menu` ➔ Private DM with menu link & greeting.
     - `prices` ➔ Private DM with price list snippet.
     - `location` ➔ Private DM with branches and Google Maps links.
     - `general` ➔ Friendly welcome DM with quick buttons (منيو، عروض، كلم موظف).
  2. Public Reply: Rotates between friendly variations ("تم الرد في الخاص يا فندم 🌹").

---

## Task 9: System Verification & End-to-End Testing

- [ ] **Step 1: Run TypeScript check on dashboard**
Run: `cd dashboard && npx tsc --noEmit -p .` and verify 0 errors.

- [ ] **Step 2: Run test suite**
Run: `cd dashboard && npm run test` to verify role guards and rules matchers.

- [ ] **Step 3: Test build**
Run: `cd dashboard && npm run build` to verify clean production build.
