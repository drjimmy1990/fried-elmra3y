import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { FacebookPost, FacebookPostsResponse } from '@/components/post-rules/types';

export const dynamic = 'force-dynamic';

const MOCK_FACEBOOK_POSTS: FacebookPost[] = [
  {
    id: '108291048291048_10159283746192841',
    message:
      'عظمة الطواجن المصرية الأصيلة في مطعم الخديوي! 🥘🔥 طاجن لحمة بالبصل المكرمل مع رز بالشعرية وسلطات ومخلل الخديوي الملكي. اطلب الآن واستمتع بخصم 20% على طلبات الدليفري! علق بكلمة "عرض" أو "السعر" وهنرد عليك بكافة التفاصيل فوراً في رسايل الصفحة 📩👑',
    created_time: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(), // 6 hours ago
    full_picture: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    permalink_url: 'https://www.facebook.com/khedewy.restaurant/posts/10159283746192841',
  },
  {
    id: '108291048291048_10159283746192842',
    message:
      'صينية الكرم الخديوية تكفي 5 أفراد وزيادة! 👑🍖 1 ك كباب وكفتة مشوية على الفحم + نص فرخة شيش + 4 طواجن أرز بالمكسرات وسلطات عيش ومشروبات. اطلب الآن وعيش اللحظة الملكية! علق بكلمة "كرم" أو "بكام" وهنبعتلك العرض كامل 🛵💨',
    created_time: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(), // 1 day ago
    full_picture: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&auto=format&fit=crop&q=80',
    permalink_url: 'https://www.facebook.com/khedewy.restaurant/posts/10159283746192842',
  },
  {
    id: '108291048291048_10159283746192843',
    message:
      'جديد منيو الخديوي: ساندوتشات كفتة وكبدة إسكندراني بالعيش البلدي السخن والجرجير والطحينة! 🥙 اختار وجبتك السريعة واستمتع بأحلى طعم بأعلى جودة. للمنيو كامل مع الأسعار علق بـ "منيو" أو اضغط إرسال رسالة 🚗',
    created_time: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(), // 3 days ago
    full_picture: 'https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800&auto=format&fit=crop&q=80',
    permalink_url: 'https://www.facebook.com/khedewy.restaurant/posts/10159283746192843',
  },
  {
    id: '108291048291048_10159283746192844',
    message:
      'عروض الويكند من مطعم الخديوي! 🔥 اطلب أي وجبتين مشويات واحصل على وجبة كفتة مجاناً مع لتر عصير طبيعي. العرض ساري حتى نفاد الكمية! علق بكلمة "عرض" لمعرفة كود الخصم الحصري 🎁',
    created_time: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(), // 5 days ago
    full_picture: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80',
    permalink_url: 'https://www.facebook.com/khedewy.restaurant/posts/10159283746192844',
  },
  {
    id: '108291048291048_10159283746192845',
    message:
      'شوربة الكوارع بالخل والثوم وطاجن العكاوي الملكي وصل! 🍲✨ دفي شتاك مع ألذ الطواجن الشرقية المطهية على نار هادئة بطريقة الأجداد. اطلب دلوقتي والتوصيل سريع وسخن لحد باب بيتك 🛵',
    created_time: new Date(Date.now() - 1000 * 60 * 60 * 168).toISOString(), // 7 days ago
    full_picture: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=800&auto=format&fit=crop&q=80',
    permalink_url: 'https://www.facebook.com/khedewy.restaurant/posts/10159283746192845',
  },
  {
    id: '108291048291048_10159283746192846',
    message:
      'ريش ضاني بتلو مشوية على الفحم بتتبيلة الخديوي السرية! 🥩 طعم مش هتدوق زيه في أي مكان تاني. جربها النهاردة مع العائلة والأصدقاء في فرعنا أو اطلب دليفري على الخط الساخن 👑',
    created_time: new Date(Date.now() - 1000 * 60 * 60 * 240).toISOString(), // 10 days ago
    full_picture: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop&q=80',
    permalink_url: 'https://www.facebook.com/khedewy.restaurant/posts/10159283746192846',
  },
];

export async function GET() {
  try {
    const supabase = await createClient();

    // Verify authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'غير مصرح لك بالوصول - يرجى تسجيل الدخول' },
        { status: 401 }
      );
    }

    // Check bot_settings table for credentials if present
    let dbPageId: string | null = null;
    let dbPageToken: string | null = null;

    try {
      const { data: botSettings } = await supabase
        .from('bot_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (botSettings) {
        // In case dynamic columns exist
        dbPageId = (botSettings as Record<string, any>)['facebook_page_id'] || null;
        dbPageToken = (botSettings as Record<string, any>)['facebook_page_access_token'] || null;
      }
    } catch (e) {
      // Fall through to env vars
    }

    const pageId = process.env.FACEBOOK_PAGE_ID || dbPageId;
    const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || dbPageToken;

    const isPlaceholder =
      !pageId ||
      !pageAccessToken ||
      pageId === 'your-facebook-page-id' ||
      pageAccessToken === 'your-page-access-token' ||
      pageId.trim() === '' ||
      pageAccessToken.trim() === '';

    if (isPlaceholder) {
      return NextResponse.json<FacebookPostsResponse>({
        success: true,
        posts: MOCK_FACEBOOK_POSTS,
        isMock: true,
      });
    }

    // Attempt to fetch from Facebook Graph API v21.0
    const graphUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(
      pageId
    )}/published_posts?fields=id,message,created_time,full_picture,permalink_url&limit=25&access_token=${encodeURIComponent(
      pageAccessToken
    )}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(graphUrl, {
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      console.warn('Facebook Graph API returned error, falling back to mock posts:', errorJson);
      return NextResponse.json<FacebookPostsResponse>({
        success: true,
        posts: MOCK_FACEBOOK_POSTS,
        isMock: true,
        error: errorJson?.error?.message || 'Facebook API error',
      });
    }

    const data = await res.json();
    const rawPosts: any[] = Array.isArray(data?.data) ? data.data : [];

    const posts: FacebookPost[] = rawPosts.map((post) => ({
      id: post.id,
      message: post.message || '',
      created_time: post.created_time,
      full_picture: post.full_picture,
      permalink_url: post.permalink_url,
    }));

    return NextResponse.json<FacebookPostsResponse>({
      success: true,
      posts: posts.length > 0 ? posts : MOCK_FACEBOOK_POSTS,
      isMock: posts.length === 0,
      pageId,
    });
  } catch (error: any) {
    console.warn('Failed to fetch Facebook posts, returning mock posts:', error?.message);
    return NextResponse.json<FacebookPostsResponse>({
      success: true,
      posts: MOCK_FACEBOOK_POSTS,
      isMock: true,
      error: error?.message,
    });
  }
}
