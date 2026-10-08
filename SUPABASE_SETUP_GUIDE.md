# 📖 Supabase Deployment & Setup Guide (Restaurant Bot & Dashboard)

This guide provides a complete, repeatable walkthrough to deploy the database and control dashboard on **any new or existing Supabase project** in less than 5 minutes.

---

## 📑 Table of Contents
1. [Prerequisites](#1-prerequisites)
2. [Step 1: Create a Supabase Project](#step-1-create-a-supabase-project)
3. [Step 2: Execute Database Migrations (In Exact Order)](#step-2-execute-database-migrations-in-exact-order)
4. [Step 3: Retrieve Supabase API Keys](#step-3-retrieve-supabase-api-keys)
5. [Step 4: Configure the Dashboard (`.env.local`)](#step-4-configure-the-dashboard-envlocal)
6. [Step 5: Launch the Dashboard & Log In](#step-5-launch-the-dashboard--log-in)
7. [Step 6: Connect the Facebook Page & Set Up the Restaurant](#step-6-connect-the-facebook-page--set-up-the-restaurant-from-the-dashboard)
8. [Step 7: Connect n8n Automation Workflows](#step-7-connect-n8n-automation-workflows)
9. [Troubleshooting & Quick Fixes](#troubleshooting--quick-fixes)

---

## 1. Prerequisites
- A free account on [supabase.com](https://supabase.com).
- Node.js 18+ installed on your computer.
- Meta for Developers account with a Facebook Page (for bot deployment).
- n8n workspace (cloud or self-hosted).

---

## Step 1: Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com) and go to your **Dashboard**.
2. Click **New Project**.
3. Select your organization.
4. Set a **Project Name** (e.g., `khedewy-restaurant`).
5. Set a secure **Database Password** (store this safely — you will need it when connecting n8n).
6. Choose a **Region** close to your users (e.g., `Frankfurt` or `London`).
7. Click **Create new project** and wait 1–2 minutes for the database to provision.

---

## Step 2: Execute Database Migrations (In Exact Order)

In your Supabase project, click on the **SQL Editor** icon (`>_` in the left sidebar), click **New Query**, and copy-paste each of the 5 scripts from the `database/` folder in the **exact numerical sequence**:

### 1️⃣ Run `01_schema.sql`
- **File:** [`database/01_schema.sql`](./database/01_schema.sql)
- **What it does:** 
  - Enables `uuid-ossp` and `pgcrypto` extensions.
  - Creates 5 custom enums (`user_role`, `order_status`, `complaint_status`, `complaint_priority`, `rule_match_type`).
  - Creates the 12 core tables: `bot_settings`, `profiles`, `contacts`, `menu_categories`, `menu_items`, `offers`, `post_rules`, `global_comment_rules`, `orders`, `order_items`, `complaints`, `messages`.
  - Attaches `set_updated_at()` triggers, complaints resolution triggers, and auto-profile creation on user signup.
  - Adds 21 performance indexes.

### 2️⃣ Run `02_storage_and_realtime.sql`
- **File:** [`database/02_storage_and_realtime.sql`](./database/02_storage_and_realtime.sql)
- **What it does:** 
  - Configures Supabase Storage public buckets: `menu-assets` (dishes & master PDF menu) and `offer-banners` (promotional images).
  - Sets up public read access and admin-only upload/delete storage policies.
  - Enables Supabase Realtime CDC (`supabase_realtime` publication) on `orders`, `complaints`, `messages`, and `contacts`.
  - Sets `REPLICA IDENTITY FULL` on realtime tables for full UPDATE/DELETE payload broadcasting.

### 3️⃣ Run `03_rls_policies.sql`
- **File:** [`database/03_rls_policies.sql`](./database/03_rls_policies.sql)
- **What it does:** 
  - Creates recursion-safe security-definer helper functions: `public.get_user_role()` and `public.is_active_staff()`.
  - Enables Row-Level Security (RLS) across all 12 tables.
  - Enforces 3-tier Role-Based Access Control:
    - `admin`: Full access across all tables.
    - `order_agent`: Read/Write access to orders, order items, contacts, read-only menu/offers.
    - `support_agent`: Read/Write access to complaints, live chat messages, contacts.

### 4️⃣ Run `04_v2_upgrade.sql`
- **File:** [`database/04_v2_upgrade.sql`](./database/04_v2_upgrade.sql)
- **Safe to run on an existing database:** it keeps all existing data and can be re-run any number of times (idempotent).
- **What it does:**
  - **Channels:** `meta_apps` (Meta App ID / Secret / verify token, server-only), `channels` (connected pages) and `channel_secrets` (page tokens, server-only). Supports many pages across many Meta apps.
  - **Orders:** simplifies `order_status` to 3 values: `confirmed` (مؤكد), `issue` (عليه مشكلة) and `cancelled` (ملغي). Order items become free text.
  - **Complaints:** linked to orders (`complaints.order_id`). Opening a complaint on an order sets that order to `issue` automatically.
  - **Menu:** removes the dish/category catalogue. The menu is now images and/or a PDF (`bot_settings.menu_images`, `menu_pdf_url`), plus a free-text price list (`bot_settings.price_list`) you can inject into n8n.
  - **Comments:** `comment_settings` (anti-spam and sensitive words), `post_settings` (per-post bot on/off), `comment_rules` (post-level and global rules in one table) and `comment_events` (inbox log with dedupe).
  - Inserts fried-chicken defaults: the bot settings row, sensitive keywords and 3 global comment rules (menu/prices, offers, fallback reply).
  - Adds the matching RLS policies, triggers and Realtime for `comment_events`.

> [!NOTE]
> There is **no seed / demo data step** any more. `04_v2_upgrade.sql` already inserts every default row the system needs. Add the restaurant name, menu images, price list and offers from the dashboard.

### 5️⃣ Run `05_create_admin.sql`
- **File:** [`database/05_create_admin.sql`](./database/05_create_admin.sql)
- **What it does:** 
  - Directly creates the Master Admin account in Supabase Auth and sets their role to `admin` in `profiles`.
  - **Default Credentials:**
    - **Email:** `admin@khedewy.com`
    - **Password:** `khedewy123456`
    *(You can edit these values at the top of `05_create_admin.sql` before running it).*

---

## Step 3: Retrieve Supabase API Keys

1. In Supabase Dashboard, click the **Settings** (⚙️ gear icon at bottom-left).
2. Click **API** (or **Data API** under Configuration).
3. Copy the following 3 values:
   - **Project URL** (e.g. `https://abcdefghijklmnop.supabase.co`)
   - **`anon` `public` API Key** (starts with `eyJhbGciOi...`)
   - **`service_role` `secret` API Key** (click **Reveal** to see and copy it)

---

## Step 4: Configure the Dashboard (`.env.local`)

Inside the `dashboard/` directory, create a file named `.env.local`:

```env
# ==============================================================================
# Supabase Cloud Credentials (REQUIRED)
# ==============================================================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...your-service-role-key...

# Note: Facebook and Telegram variables DO NOT need to be in this file!
# You configure them directly from the Dashboard UI in Step 6.
```

---

## Step 5: Launch the Dashboard & Log In

1. Open your terminal and start the Next.js server:
   ```powershell
   cd dashboard
   npm install
   npm run dev
   ```
2. Navigate to **`http://localhost:3000/login`** in your browser.
3. Sign in with the admin credentials:
   - **البريد الإلكتروني:** `admin@khedewy.com`
   - **كلمة المرور:** `khedewy123456`
4. You will be redirected to the main operations overview.

---

## Step 6: Connect the Facebook Page & Set Up the Restaurant (from the Dashboard)

Nothing about Facebook or Telegram goes in `.env.local`. Everything is managed from the dashboard and stored server-side.

### 6.1 Connect the page: `/dashboard/channels` (القنوات)
1. **رابط الويب هوك (n8n):** paste your n8n router URL (`https://…`) and save. This one URL serves every page and every app.
2. **تطبيقات ميتا → إضافة تطبيق:** enter the Meta **App ID** and **App Secret** (and the Login for Business **config_id** if you use it). The dashboard checks them and shows the **OAuth Redirect URI**, **Callback URL** and **Verify Token** to copy into the Meta app.
3. **ربط صفحة فيسبوك:** choose the app, log in, and pick your page. The server stores a **non-expiring page token** and subscribes the page to the webhooks automatically.
4. Press **اختبار الاتصال** on the page card. You should see 🟢 متصلة.

👉 Full walkthrough (creating the Meta app, permissions, App Review, limits): [`docs/META_APP_SETUP.md`](./docs/META_APP_SETUP.md)

> [!IMPORTANT]
> If the Meta app form has no **Login Config ID** field saving, run this once in the SQL Editor:
> `ALTER TABLE public.meta_apps ADD COLUMN IF NOT EXISTS login_config_id TEXT;`

### 6.2 Restaurant & bot: `/dashboard/settings` (الإعدادات)
- Restaurant name (shown in the sidebar and on receipts), delivery fee and currency.
- Bot master switch and auto-pause on complaint.
- Bot messages: welcome, human handoff, off-hours.
- Business hours.
- AI system prompt (there is a fried-chicken template button).
- Telegram bot token + chat ID, with a test button.

### 6.3 Menu & prices: `/dashboard/menu` (المنيو)
- Upload the menu **images** (several, reorderable) and an optional **PDF**. The bot sends them when a customer asks for the menu.
- **قائمة الأسعار:** a text/Markdown price list. Use it in n8n with `{{ $json.price_list }}`.

### 6.4 Offers: `/dashboard/offers` (العروض)
- Quick add with only the title required (image, price and end date are optional).
- Turn offers on or off and reorder them. An offer is hidden automatically after its end date.

### 6.5 Comments: `/dashboard/comments` (التعليقات)
- Global rules, sensitive/complaint words, anti-spam settings and per-post rules.
- The inbox fills up once the n8n comments workflow is running.

---

## Step 7: Connect n8n Automation Workflows

> [!NOTE]
> The n8n workflows are being rebuilt for v2: one router plus the comments, Messenger AI and Telegram flows. The old files in `n8n-workflows/` use the removed v1 tables, so **don't import them** into production.

What every v2 workflow reads and writes is defined in [`docs/WORKFLOW_DATA_CONTRACT.md`](./docs/WORKFLOW_DATA_CONTRACT.md).

To prepare n8n now:
1. Under **Credentials**, create a **Postgres** credential (or a Supabase credential with the `service_role` key):
   - **Host:** `db.your-project-id.supabase.co` (Supabase → Settings → Database → Connection string)
   - **Database / User:** `postgres` / `postgres`
   - **Password:** your Supabase database password
   - **Port:** `5432` (or `6543` for the pooler)
   - **SSL:** `require`
2. Create the router webhook in n8n (GET + POST on the same path) and paste its production URL into **/dashboard/channels → رابط الويب هوك (n8n)** and into the Meta app's **Webhooks → Page → Callback URL**.

---

## Troubleshooting & Quick Fixes

### 1. `ERROR: 42501: permission denied for schema storage`
- **Cause:** Running legacy SQL that attempts `CREATE TABLE IF NOT EXISTS storage.buckets`.
- **Fix:** Supabase pre-manages the `storage` schema. Always use the updated [`database/02_storage_and_realtime.sql`](./database/02_storage_and_realtime.sql) which uses `INSERT INTO storage.buckets` directly.

### 2. Can't log in / "Invalid login credentials"
- **Fix:** Re-run [`database/05_create_admin.sql`](./database/05_create_admin.sql) in Supabase SQL Editor. It will reset the password for `admin@khedewy.com` to `khedewy123456` and confirm the user email immediately.

### 3. Realtime notifications not ringing or updating in the dashboard
- **Fix:** Verify that Section 3 of `02_storage_and_realtime.sql` was executed. You can confirm in Supabase Dashboard -> **Database** -> **Replication** -> Ensure `orders`, `complaints`, `messages`, and `contacts` are toggled ON under Source Tables.

### 4. Changing or adding a Facebook Page
- Go to **/dashboard/channels**. Press **فصل** on the old page and **ربط صفحة فيسبوك** for the new one, or simply connect additional pages.
- No restart or `.env` change is needed. Live Chat and the comments tools always use the page each customer or post belongs to.

### 5. Live Chat says the message couldn't be sent
- Facebook only allows replies within **24 hours** of the customer's last message. The failed message stays in the thread with a **إعادة المحاولة** button.
- Other errors (token expired, missing permission) are shown in Arabic. Press **اختبار الاتصال** in /channels.
