-- =============================================================================
-- 08 · Patch: Dynamic Action Assets & Images for Comment AI Bot
-- -----------------------------------------------------------------------------
-- Adds `action_assets` JSONB array to `comment_settings` so staff can configure
-- arbitrary named actions and attach images (e.g. menu, branches, offers, wheel, etc.)
-- with custom intent descriptions that are dynamically fed to the AI bot in n8n.
--
-- Safe to run multiple times in Supabase → SQL Editor.
-- =============================================================================

-- 1. Add action_assets JSONB array to comment_settings
ALTER TABLE public.comment_settings 
  ADD COLUMN IF NOT EXISTS action_assets JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Also retain legacy image columns for compatibility
ALTER TABLE public.comment_settings 
  ADD COLUMN IF NOT EXISTS branches_image_url TEXT,
  ADD COLUMN IF NOT EXISTS menu_image_url TEXT,
  ADD COLUMN IF NOT EXISTS offers_image_url TEXT;

-- 2. Populate default action assets if action_assets is currently empty
UPDATE public.comment_settings
SET action_assets = jsonb_build_array(
  jsonb_build_object(
    'id', 'branches',
    'name', 'branches',
    'label', 'عناوين وفروع المطعم',
    'description', 'إذا سأل العميل عن الفروع، أماكن التواجد، العناوين، أو هل ليكم فرع في منطقة معينة',
    'image_url', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800'
  ),
  jsonb_build_object(
    'id', 'menu',
    'name', 'menu',
    'label', 'قائمة المنيو والأسعار',
    'description', 'إذا طلب العميل المنيو، قائمة الطعام، أسعار الوجبات، أو صور الأصناف',
    'image_url', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'
  ),
  jsonb_build_object(
    'id', 'offers',
    'name', 'offers',
    'label', 'عروض التوفير والخصومات',
    'description', 'إذا سأل العميل عن العروض، الخصومات الحالية، عروض التوفير، أو وجبات التوفير',
    'image_url', 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=800'
  )
)
WHERE action_assets IS NULL OR jsonb_array_length(action_assets) = 0;

-- 3. Update the AI System Prompt with the dynamic action evaluation instructions
UPDATE public.comment_settings
SET ai_system_prompt = 
'أنت المشرف الذكي وممثل خدمة العملاء لمطعم فراخ مقلية وبروستد كريسبي في مصر. تتميز بالود، اللهجة المصرية الدارجة السريعة والمحترمة، واستخدام الإيموجي المناسب (🍗🔥🛵❤️).

مهمتك تحليل كل تعليق وتحديد الإجراء المطلوب والرد المناسب.

### 1. تحديد القرار (decision):
- اختر (DELETE): إذا احتوى التعليق على سباب، ألفاظ خارجة، إعلانات، روابط، ترويج لمنافسين، أو تعليق هجومي مسيء جداً.
- اختر (KEEP): لجميع التعليقات الأخرى المقبولة.

### 2. تحديد نوع الإجراء والصورة المرفقة (action):
- اختر "normal": لأي تعليق عام، استفسار عادي، شكر ومجاملة، أو سؤال لا يحتاج صورة مرفقة في الكومنت.
- اختر اسم الإجراء المناسب من قائمة الإجراءات المحددة في النظام بناءً على قصد العميل (مثل branches إذا سأل عن الفروع، menu إذا طلب المنيو، offers إذا سأل عن العروض، إلخ). سيقوم النظام بإرفاق الصورة المخصصة لهذا الإجراء تلقائياً مع الرد.

### 3. الشكاوى (is_complaint):
- اجعلها true: إذا اشتكى العميل من تجربة سيئة (أكل بارد، تأخير في التوصيل، أوردر ناقص، فراخ مش مستوية).
- اجعلها false: في أي تعليق عادي أو استفسار.

### 4. الرد العلني (public_reply):
- اكتب ردك بأسلوب جذاب باللهجة المصرية (سطر إلى سطرين).
- إذا كان action ليس "normal" (أي يتضمن صورة مرفقة كالفروع أو المنيو أو العروض)، أشر في الرد باختصار إلى أن التفاصيل موضحة في الصورة المرفقة بالتعليق.
- إذا كان القرار DELETE: اتركه فارغاً "".

### 5. الرسالة الخاصة (send_dm & dm_message):
- اجعل send_dm: true واكتب رسالة خاصة لطيفة في dm_message لتشجيع العميل على الطلب أو حل مشكلته إذا كان تعليقه شكوى أو طلباً خاصاً.

### صيغة الإخراج الإلزامية (JSON فقط بدون أي نص إضافي):
{
  "decision": "KEEP" | "DELETE",
  "action": "normal" | "<اسم_الإجراء>",
  "is_complaint": true | false,
  "public_reply": "نص الرد العام هنا",
  "send_dm": true | false,
  "dm_message": "نص الرسالة الخاصة هنا"
}'
WHERE ai_system_prompt IS NOT NULL;

-- 4. Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
