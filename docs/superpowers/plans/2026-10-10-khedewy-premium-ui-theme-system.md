# Al-Khedewy Dashboard: Premium UI/UX & Dual Theme (Light/Dark) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Al-Khedewy restaurant operations dashboard from an amateur high-contrast neon prototype into a world-class, executive-grade hospitality operations suite featuring a bespoke dual theme (Luxury Obsidian Dark & Porcelain Stone Light), premier Arabic typography (Cairo/IBM Plex Sans Arabic), polished component hierarchy, and balanced layouts across all screens.

**Architecture:** 
1. **Design Token & Theming Engine:** CSS Variables mapped to semantic theme tokens (`--bg-canvas`, `--bg-surface`, `--bg-elevated`, `--border-subtle`, `--text-primary`, `--brand-amber`, etc.) configured with a zero-FOUC ThemeProvider and ThemeToggle in the top navigation.
2. **Typography Engine:** Next.js Google Fonts integration (`Cairo` + `Plus Jakarta Sans`) for balanced Arabic kerning, optical weights, and legible numerals.
3. **Component Refinement:** Redesign of the entire UI surface—Navigation Shell, Overview KPI metrics, Orders Kanban & Table, Complaints CRM, Live Chat split-view, Menu & Offers—into an elegant, cohesive hospitality design system.

**Tech Stack:** Next.js 15.1.7 (App Router), React 19, Tailwind CSS v4, Lucide React, Supabase SSR.

---

## File Structure & Responsibilities

| File Path | Responsibility |
|---|---|
| `dashboard/src/components/providers/ThemeProvider.tsx` | Client-side theme provider supporting 'light', 'dark', and 'system' with localStorage persistence and zero-FOUC script. |
| `dashboard/src/components/ui/ThemeToggle.tsx` | Executive theme switcher button (Sun / Moon) with smooth transitions. |
| `dashboard/src/app/globals.css` | Comprehensive CSS variables for Light & Dark modes, typography rules, scrollbars, and card utilities. |
| `dashboard/src/app/layout.tsx` | Google Fonts injection (`Cairo`), theme provider setup, and anti-flicker inline theme initialization. |
| `dashboard/src/components/layout/Sidebar.tsx` | Redesigned navigation sidebar with section dividers, brand emblem, and luxury active state indicators. |
| `dashboard/src/components/layout/Topbar.tsx` | Rebalanced topbar with breadcrumbs, live bot status badge, audio alert toggle, theme switch, and user profile drawer. |
| `dashboard/src/components/layout/DashboardShell.tsx` | Main responsive shell wrapper ensuring proper max-widths, padding rhythm, and mobile drawers. |
| `dashboard/src/app/(dashboard)/page.tsx` | Reimagined Overview page with balanced KPI cards, live revenue widget, action launcher, and dual activity feeds. |
| `dashboard/src/components/orders/OrderKanban.tsx` | Redesigned order toolbar, column headers, and view toggler for Orders. |
| `dashboard/src/components/orders/OrderCard.tsx` | Premium order card with item summary, customer contact links, and prominent order status CTAs. |
| `dashboard/src/components/chat/ChatContainer.tsx` | Polished split-pane layout for Live Chat with modern conversational bubbles and streamlined composer. |
| `dashboard/src/components/chat/ChatSidebar.tsx` | Conversation thread list with unread badges, needs-human highlight, and customer search. |
| `dashboard/src/components/chat/ChatThread.tsx` | Conversational message thread with iMessage-grade bubbles, staff avatars, and quick canned responses. |
| `dashboard/src/components/offers/OfferCard.tsx` | Refined promotional offer card with elegant discount badges and aspect-video banners. |
| `dashboard/src/components/ui/Modal.tsx` | Reusable modal dialog supporting light/dark theme variables, backdrop blur, and accessible focus management. |

---

## Bite-Sized Implementation Tasks

### Task 1: Design Tokens, CSS Variables & Typography Setup
**Files:**
- Modify: `dashboard/src/app/globals.css`
- Modify: `dashboard/src/app/layout.tsx`
- Create: `dashboard/src/components/providers/ThemeProvider.tsx`
- Create: `dashboard/src/components/ui/ThemeToggle.tsx`

- [ ] **Step 1: Define semantic CSS variables in `globals.css`**
  - Add light mode variables under `:root`:
    - Canvas: `#F8FAFC`, Surface: `#FFFFFF`, Elevated: `#FFFFFF`, Subtle: `#F1F5F9`
    - Borders: `rgba(226, 232, 240, 0.8)`, Hover borders: `rgba(203, 213, 225, 1)`
    - Text: Primary `#0F172A`, Secondary `#475569`, Muted `#94A3B8`
    - Brand: Amber `#D97706`, Warm Gold `#F59E0B`, Soft Amber Fill `rgba(245, 158, 11, 0.08)`
  - Add dark mode variables under `.dark`:
    - Canvas: `#0B0F17`, Surface: `#111827`, Elevated: `#161F30`, Subtle: `#1A2234`
    - Borders: `rgba(255, 255, 255, 0.08)`, Hover borders: `rgba(255, 255, 255, 0.16)`
    - Text: Primary `#F8FAFC`, Secondary `#94A3B8`, Muted `#64748B`
    - Brand: Amber `#F59E0B`, Warm Gold `#FBBF24`, Soft Amber Fill `rgba(245, 158, 11, 0.12)`
- [ ] **Step 2: Configure Google Fonts in `layout.tsx`**
  - Import `Cairo` from `next/font/google` with weights `400, 500, 600, 700, 800, 900`.
  - Apply the font variable to `<html>` and `<body>` with RTL direction and antialiased rendering.
- [ ] **Step 3: Implement `ThemeProvider.tsx` & zero-FOUC script**
  - Create React Context with `theme` ('light' | 'dark' | 'system'), `setTheme`, and `resolvedTheme`.
  - Add inline head script in `layout.tsx` to read `localStorage.getItem('khedewy-theme')` or system preference before React hydration.
- [ ] **Step 4: Create `ThemeToggle.tsx`**
  - An executive pill button toggling between Light and Dark mode with Sun / Moon icons and smooth spin/fade micro-animation.
- [ ] **Step 5: Verify build & theme switching**
  - Run `npm run build` in `dashboard` to ensure clean compilation.

---

### Task 2: Executive Shell & Navigation Rebalance (Sidebar & Topbar)
**Files:**
- Modify: `dashboard/src/components/layout/Sidebar.tsx`
- Modify: `dashboard/src/components/layout/Topbar.tsx`
- Modify: `dashboard/src/components/layout/DashboardShell.tsx`

- [ ] **Step 1: Redesign `Sidebar.tsx`**
  - Use semantic tokens (`bg-[var(--bg-surface)]`, `border-[var(--border-subtle)]`).
  - Upgrade brand header: "بروستد الخديوي" emblem with refined gold badge and subtler glow.
  - Group links into 3 clear categories: "غرفة العمليات", "إدارة المطعم", "إعدادات النظام".
  - Refine active link state: instead of heavy harsh neon, use a subtle warm gradient (`bg-amber-500/10 text-amber-500 font-semibold border-r-3 border-amber-500`).
  - Polished counter badges: soft pill tags with balanced padding.
- [ ] **Step 2: Rebalance `Topbar.tsx`**
  - Breadcrumbs / Page Title display on the right (RTL start) showing current section and page.
  - Center/Left cluster:
    - Bot Status Pill: Soft pulsing green dot with clear text "البوت: نشط" (or muted red when paused).
    - Audio alert toggle: Compact sound bell icon with subtle state.
    - Theme Toggle: Clean Sun/Moon switch.
    - User Profile: Clean circular avatar/initials, full name, role badge (مدير النظام 👑 / مسؤول الطلبات / خدمة العملاء), and sleek sign-out button.
- [ ] **Step 3: Test responsive navigation & layout shell**
  - Ensure mobile drawer slides smoothly without horizontal scrollbars.

---

### Task 3: Overview Page Redesign (`/dashboard`)
**Files:**
- Modify: `dashboard/src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Hero Header Banner**
  - Soft ambient gradient: `from-slate-900 to-amber-950/30` in dark mode, `from-white to-amber-50/50` in light mode.
  - Royal greeting: "غرفة عمليات بروستد الخديوي 🍗👑" with date chip and quick-launch buttons.
- [ ] **Step 2: Re-engineered 5 KPI Metric Cards**
  - Consistent layout: icon in top corner with soft tinted background, bold Arabic title, large monospace numeral, and micro-status subtitle.
  - Color harmony:
    - Pending: Warm Amber (`amber-500`)
    - Confirmed: Emerald (`emerald-500`)
    - Complaints: Soft Rose (`rose-500`)
    - Human Handoff: Indigo / Violet (`indigo-500`)
    - Comments: Sky Blue (`sky-500`)
- [ ] **Step 3: Daily Revenue Card**
  - Prominent sales KPI with formatted EGP currency (`ج.م`) and direct link to orders.
- [ ] **Step 4: Operational Launcher Cards**
  - 4 quick-action cards for Orders, Menu, Offers, and Chat with hover elevation (`hover:-translate-y-0.5 hover:shadow-md`).
- [ ] **Step 5: Dual Activity Tables**
  - Recent orders and recent complaints with clean row dividers, timestamp chips, and clear status badges.

---

### Task 4: Orders Kanban & Table View Polish (`/orders`)
**Files:**
- Modify: `dashboard/src/components/orders/OrderKanban.tsx`
- Modify: `dashboard/src/components/orders/OrderCard.tsx`
- Modify: `dashboard/src/components/orders/OrderDetailsModal.tsx`
- Modify: `dashboard/src/components/orders/ThermalReceipt.tsx`

- [ ] **Step 1: Unified Orders Toolbar**
  - Combined search bar with quick filters (All, Today, Yesterday, Week), Branch selector, and Kanban/Table toggle.
  - Clean KPI ribbon showing total orders, pending orders, and confirmed revenue.
- [ ] **Step 2: Redesigned Kanban Columns**
  - "قيد الانتظار" (Pending / New): Amber accent dot, order count badge, and clean scrollable column container.
  - "مؤكد" (Confirmed / Preparing): Emerald accent dot, order count badge.
  - Polished empty state with custom icon and comforting message.
- [ ] **Step 3: Re-crafted Order Card**
  - Header: Order number in bold monospace (`#104`), relative time chip ("منذ 5 دقائق"), and branch badge.
  - Customer info: Customer name with direct call (`tel:`) and WhatsApp click-to-chat icons.
  - Delivery address with subtle map pin.
  - Order items summary: item counts and clear list.
  - Prominent price footer and one-click "تأكيد الطلب وإبلاغ العميل" button.
- [ ] **Step 4: Thermal Receipt Modal**
  - Clean 80mm preview with brand header "بروستد الخديوي" and printable layout.

---

### Task 5: Live Chat Takeover Redesign (`/chat`)
**Files:**
- Modify: `dashboard/src/components/chat/ChatContainer.tsx`
- Modify: `dashboard/src/components/chat/ChatSidebar.tsx`
- Modify: `dashboard/src/components/chat/ChatThread.tsx`

- [ ] **Step 1: Split-Pane Chat Layout**
  - Contacts sidebar on right, active conversation thread on left with responsive mobile drawer support.
- [ ] **Step 2: Chat Sidebar List**
  - Search filter + status tabs (All, Needs Human, Unread).
  - Contact items: Customer avatar/initials, platform badge (Messenger), last message snippet, relative timestamp, and glowing unread counter.
- [ ] **Step 3: Active Thread Header**
  - Customer name & phone number.
  - AI Master Switch: Clean amber/emerald toggle with status label ("الذكاء الاصطناعي نشط" / "المحادثة متوقفة للرد اليدوي").
  - Warning chip for Facebook 24-hour messaging window.
- [ ] **Step 4: Conversational Bubble Styling**
  - User messages: Soft slate bubble aligned to left.
  - AI Bot messages: Purple/amber tinted bubble with bot badge.
  - Staff Agent messages: Clean emerald/amber bubble with staff member name.
- [ ] **Step 5: Message Composer & Quick Replies**
  - Canned response chips for fast customer handling.
  - Clean auto-expanding textarea with Send button and keyboard shortcuts (`Enter` to send, `Shift+Enter` for newline).

---

### Task 6: Offers, Menu, Complaints & Modals Polish
**Files:**
- Modify: `dashboard/src/components/offers/OfferCard.tsx`
- Modify: `dashboard/src/components/offers/OffersContainer.tsx`
- Modify: `dashboard/src/components/menu/MenuManager.tsx`
- Modify: `dashboard/src/components/complaints/ComplaintQueue.tsx`
- Modify: `dashboard/src/components/ui/Modal.tsx`

- [ ] **Step 1: Offers Grid & Cards**
  - Aspect-video promotional banner with placeholder fallback.
  - Elegant percentage discount tag (`خصم 20%`) and currency formatting.
  - Date validity window badge (Active, Upcoming, Expired).
- [ ] **Step 2: Menu Catalog**
  - Clean image gallery grid with thumbnail preview and PDF link copy.
  - Markdown price list editor with split preview.
- [ ] **Step 3: Complaints CRM Queue**
  - Unified table view with status toggle (Open / Resolved).
  - Cross-linked order badge opening order details modal.
- [ ] **Step 4: Shared Modal Dialogs**
  - Clean backdrop blur, rounded-3xl borders, smooth enter/exit transitions, and accessible close button.

---

### Task 7: Full Verification, Testing & QA
**Files:**
- Run test suites and verify in browser

- [ ] **Step 1: Run Next.js Production Build**
  - Command: `npm run build`
  - Expected: 0 TypeScript errors, 0 lint warnings, all routes generated.
- [ ] **Step 2: Run Unit Tests**
  - Command: `npm run test`
  - Expected: 42/42 tests passing.
- [ ] **Step 3: Visual Inspection & Theme Switching**
  - Verify Light mode and Dark mode transitions on all pages:
    - `/login`
    - `/dashboard`
    - `/dashboard/orders`
    - `/dashboard/complaints`
    - `/dashboard/chat`
    - `/dashboard/menu`
    - `/dashboard/offers`
    - `/dashboard/branches`
    - `/dashboard/team`
    - `/dashboard/settings`
