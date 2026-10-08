import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Verify authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'غير مصرح لك بالوصول - يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    // 2. Parse and validate body payload
    const body = await request.json();
    const { contactId, content } = body;

    if (!contactId || typeof contactId !== 'string') {
      return NextResponse.json(
        { error: 'معرف جهة الاتصال (contactId) مطلوب' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { error: 'محتوى الرسالة (content) لا يمكن أن يكون فارغاً' },
        { status: 400 }
      );
    }

    const trimmedContent = content.trim();

    // 3. Fetch contact to confirm existence and inspect platform details
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { error: 'جهة الاتصال غير موجودة' },
        { status: 404 }
      );
    }

    // 4. Insert new message row in database with sender_type = 'agent'
    const { data: insertedMessage, error: insertError } = await supabase
      .from('messages')
      .insert({
        contact_id: contactId,
        sender_type: 'agent',
        content: trimmedContent,
        is_read: true,
      })
      .select('*')
      .single();

    if (insertError || !insertedMessage) {
      console.error('Failed to insert message into Supabase:', insertError);
      return NextResponse.json(
        { error: 'تعذر حفظ الرسالة في قاعدة البيانات' },
        { status: 500 }
      );
    }

    // 5. Update contact's last_interaction_at
    const nowIso = new Date().toISOString();
    await supabase
      .from('contacts')
      .update({ last_interaction_at: nowIso })
      .eq('id', contactId);

    // 6. If contact is on Messenger and has platform_user_id, send via Facebook Graph API
    let deliveryWarning: string | null = null;
    const isMessenger =
      contact.platform === 'messenger' ||
      contact.platform.toLowerCase() === 'facebook';

    if (isMessenger && contact.platform_user_id) {
      const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || null;

      if (pageAccessToken) {
        try {
          const fbResponse = await fetch(
            `https://graph.facebook.com/v21.0/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                recipient: { id: contact.platform_user_id },
                message: { text: trimmedContent },
              }),
            }
          );

          if (!fbResponse.ok) {
            const fbErrorData = await fbResponse.json().catch(() => null);
            console.error('Facebook Graph API error response:', fbResponse.status, fbErrorData);
            deliveryWarning = fbErrorData?.error?.message || 'تعذر تسليم الرسالة لماسنجر (قد تكون نافذة الـ 24 ساعة للعميل منتهية)';
          }
        } catch (fbError) {
          console.error('Failed to dispatch Facebook Graph API message:', fbError);
          deliveryWarning = 'تعذر الاتصال بخوادم Facebook Graph API';
        }
      } else {
        console.warn('Facebook Page Access Token not configured in env.');
      }
    }

    return NextResponse.json({
      success: true,
      message: insertedMessage,
      deliveryWarning,
    });
  } catch (error: any) {
    console.error('Unexpected error in chat send route:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ غير متوقع أثناء معالجة الطلب' },
      { status: 500 }
    );
  }
}
