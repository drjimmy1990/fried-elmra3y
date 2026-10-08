# Meta App Setup & App Review Guide

How to create the Meta (Facebook) developer app, connect your restaurant page from **/dashboard/channels**, and get the app approved so **real customers'** comments and messages reach the bot.

> [!IMPORTANT]
> While the app is in **Development mode**, Facebook only delivers webhook events from people who have a **role on the app** (admin / developer / tester). Everything will "work for you" and do nothing for customers. Plan for **App Review + Business Verification** (§6) early, because approval can take days.

---

## 1. Before you start

- A Facebook account that is **admin of the page**. Ideally the page is owned by a **Meta Business Portfolio** (business.facebook.com).
- The dashboard running on a public **HTTPS** URL for real use (Vercel, a VPS, …). `http://localhost:3000` is fine for testing Facebook Login in Development mode.
- In `dashboard/.env.local` (optional):
  - `APP_BASE_URL=https://your-dashboard.example.com`, used to build the OAuth redirect URI. If it is empty, the request's own origin is used.
  - `META_GRAPH_VERSION=v23.0` (default).

## 2. Create the app

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**.
2. Use case: **Other** → type **Business**. Link your Business Portfolio if asked.
3. In the app dashboard, **add products**:
   - **Facebook Login for Business** (or **Facebook Login**)
   - **Messenger**
   - **Webhooks**
4. Open **App settings → Basic** and copy the **App ID** and **App Secret**. Fill in Privacy Policy URL, Terms URL, App icon and Category; App Review needs them.

## 3. Add the app in the dashboard

1. Open **/dashboard/channels → تطبيقات ميتا → إضافة تطبيق**.
2. Enter a name, the **App ID** and the **App Secret**. The dashboard checks the pair with Facebook before saving.
3. The dashboard generates a **Verify Token** for this app and shows the values you need to copy:

| Value | Where it goes in Meta |
|---|---|
| **OAuth Redirect URI**: `https://<dashboard>/api/channels/oauth/callback` | Facebook Login → **Settings → Valid OAuth Redirect URIs** |
| **Callback URL**: your n8n router URL (saved once in **رابط الويب هوك (n8n)** at the top of /channels, must be `https://`) | Webhooks → **Page** → Callback URL |
| **Verify Token** | Webhooks → **Page** → Verify token |

4. **Login for Business only:** create a **Configuration** (Facebook Login for Business → Configurations) with:
   - token type **System-user / User access token**
   - the permissions in §5
   - assets: Pages

   Copy its **config_id** into the app's **Login Config ID** field in the dashboard.

   > This field needs the column added by:
   > ```sql
   > ALTER TABLE public.meta_apps ADD COLUMN IF NOT EXISTS login_config_id TEXT;
   > ```
   > Run it once in the Supabase SQL Editor if you haven't yet.

## 4. Connect the page

1. **/dashboard/channels → ربط صفحة فيسبوك**, choose the app, then log in and **tick the page(s)** in the Facebook dialog.
2. The server then:
   1. exchanges the login for a **long-lived user token**, and from it gets a **non-expiring page token**;
   2. stores the token in `channel_secrets` (server-only, never sent to the browser);
   3. subscribes the page to the app webhooks: `feed`, `messages`, `messaging_postbacks`, `message_echoes`.
3. The page card shows 🟢 متصلة.
   - **اختبار الاتصال** checks the token again.
   - **فصل** unsubscribes the page and deletes its token.

**Manual fallback (ربط يدوي):** choose the app, then paste the Page ID and a **page** access token. The server checks it and shows when it expires.

> [!WARNING]
> Don't use a short-lived Graph API Explorer token. It expires in about 1 hour. Use the login button, or paste a long-lived page token.

**Pages on different apps:**
- Add each app in the dashboard and connect each page through its own app.
- All apps use the **same** Callback URL. n8n finds the page by `entry.id` and uses that page's token and that app's secret.

## 5. Permissions the dashboard requests

| Permission | Why |
|---|---|
| `pages_show_list` | List the pages you manage |
| `pages_read_engagement` | Read posts and page info |
| `pages_read_user_content` | Read comments on posts |
| `pages_manage_engagement` | Reply to, like and hide comments |
| `pages_manage_metadata` | Subscribe the page to webhooks |
| `pages_messaging` | Send Messenger replies (bot + Live Chat) |
| `business_management` | List pages owned by a Business Portfolio |

## 6. Going live: App Review and Business Verification

1. **Business Verification:** Business settings → Security Center → **Start verification** (company documents, domain or phone).
2. **App Review → Permissions and features:** request **Advanced Access** for every permission in §5.
   - For each one, upload a short screen recording that shows the feature in the dashboard (connecting the page, the comments inbox reply/hide, Live Chat sending a message) and explain the use case in plain words.
3. Messenger: request **Advanced Access** for `pages_messaging`. It is also needed for the private reply to comments.
4. After approval, switch the app to **Live** mode (top bar toggle).
5. Re-check **/dashboard/channels → اختبار الاتصال**.

## 7. Facebook limits the bot is designed around

| Limit | Effect |
|---|---|
| **24-hour window** | A page can message a customer only within 24h of the customer's last message. Live Chat warns you, and failed sends show "لم يتم الإرسال" with a retry |
| **Private reply to a comment** | **One** per comment, within **7 days** of the comment. Later messages need the customer to reply first |
| **Development mode** | Events arrive only from app role holders (see the warning at the top) |
| **Rate / spam signals** | The comments engine uses DM cooldown per user, random reply delays and reply variations (see `/comments → القواعد العامة`) |

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| "URL blocked" / redirect error in Facebook Login | The redirect URI in Meta must match `https://<dashboard>/api/channels/oauth/callback` exactly |
| Webhook verification fails | The n8n router must answer GET with `hub.challenge` when `hub.verify_token` matches the app's Verify Token |
| Page connected but nothing arrives | The app is still in Development mode, or the page isn't subscribed. Press **اختبار الاتصال**; reconnect if needed |
| `(#10) Requires pages_messaging permission` / `(#200)` | Permission not granted or not approved. Reconnect and tick all permissions, or finish App Review |
| Live Chat error about the 24-hour window | Expected Facebook behaviour. Wait for the customer to message again |
