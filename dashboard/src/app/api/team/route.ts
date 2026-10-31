import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient, User } from '@supabase/supabase-js';
import { Database, UserRole } from '@/types/database.types';
import {
  computeDatabaseRoleForPermissions,
  defaultPermissionsForRole,
  extractStaffAuth,
  resolveUserPermissions,
} from '@/lib/role-guard';

// Helper to initialize service role client when available
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Security Helper: Verifies the requester is an active staff member with 'team' permission
async function verifyAdminCaller() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'غير مصرح لك بالوصول - يرجى تسجيل الدخول', status: 401 };
  }

  const { data: callerProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, is_active, full_name')
    .eq('id', user.id)
    .single();

  const { permissions, isActive } = extractStaffAuth(user, callerProfile);

  if (profileError || !callerProfile || !isActive || !permissions.includes('team')) {
    return { error: 'عذراً، هذه العملية مخصصة لمديري فريق العمل النشطين فقط', status: 403 };
  }

  return { user, callerProfile, supabase };
}

// GET /api/team - List all staff profiles with emails & granular permissions
export async function GET() {
  try {
    const authCheck = await verifyAdminCaller();
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase } = authCheck;
    const adminClient = getAdminClient();

    // 1. Fetch all profiles
    const dbClient = adminClient || supabase;
    const { data: profiles, error: fetchError } = await dbClient
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // 2. Attempt to resolve emails & permissions from auth.users if service role is available
    const authUserMap = new Map<string, User>();
    if (adminClient) {
      try {
        const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
        if (authUsers?.users) {
          authUsers.users.forEach((u) => {
            authUserMap.set(u.id, u);
          });
        }
      } catch (e) {
        console.warn('Could not list auth users with admin client:', e);
      }
    }

    const staff = (profiles || []).map((p) => {
      const authUser = authUserMap.get(p.id);
      const { displayRole, permissions } = extractStaffAuth(authUser, p);
      return {
        ...p,
        role: displayRole,
        permissions,
        email: authUser?.email || null,
      };
    });

    return NextResponse.json({ staff });
  } catch (err: any) {
    console.error('GET /api/team error:', err);
    return NextResponse.json({ error: err?.message || 'خطأ داخلي في الخادم' }, { status: 500 });
  }
}

// POST /api/team - Create a new staff member account with custom permissions
export async function POST(request: NextRequest) {
  try {
    const authCheck = await verifyAdminCaller();
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { supabase } = authCheck;
    const adminClient = getAdminClient();

    const body = await request.json();
    const { full_name, email, phone, password, role, permissions: rawPermissions } = body;

    // Validation
    if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
      return NextResponse.json({ error: 'الاسم الكامل مطلوب' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'البريد الإلكتروني غير صالح' }, { status: 400 });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json({ error: 'كلمة المرور يجب ألا تقل عن 6 أحرف' }, { status: 400 });
    }

    const validRoles: UserRole[] = ['admin', 'order_agent', 'support_agent'];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: 'الدور الوظيفي المحدد غير صالح' }, { status: 400 });
    }

    const effectivePermissions = resolveUserPermissions(role, rawPermissions);
    const dbRole = computeDatabaseRoleForPermissions(role, effectivePermissions);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = full_name.trim();
    const cleanPhone = phone && typeof phone === 'string' ? phone.trim() : null;

    let createdUserId: string | null = null;

    if (adminClient) {
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: cleanEmail,
        password: password,
        email_confirm: true,
        user_metadata: {
          full_name: cleanName,
          phone: cleanPhone,
          role: dbRole,
          display_role: role,
          permissions: effectivePermissions,
        },
        app_metadata: {
          role: dbRole,
          display_role: role,
          permissions: effectivePermissions,
        },
      });

      if (authError || !authData.user) {
        return NextResponse.json(
          { error: `فشل إنشاء الحساب: ${authError?.message || 'خطأ غير معروف'}` },
          { status: 400 }
        );
      }

      createdUserId = authData.user.id;
    } else {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: cleanName,
            phone: cleanPhone,
            role: dbRole,
            display_role: role,
            permissions: effectivePermissions,
          },
        },
      });

      if (authError || !authData.user) {
        return NextResponse.json(
          { error: `فشل تسجيل المستخدم: ${authError?.message || 'خطأ في المصادقة'}` },
          { status: 400 }
        );
      }

      createdUserId = authData.user.id;
    }

    // Upsert profiles row with dbRole so Supabase RLS permits access to all granted modules
    const dbClient = adminClient || supabase;
    const { data: profile, error: profileError } = await dbClient
      .from('profiles')
      .upsert({
        id: createdUserId,
        full_name: cleanName,
        role: dbRole,
        phone: cleanPhone,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileError) {
      console.error('Failed to upsert profile record:', profileError);
      return NextResponse.json(
        { error: `تم إنشاء المستخدم ولكن تعذر تحديث الملف التعريفي: ${profileError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم إضافة الموظف وتخصيص صلاحياته بنجاح',
      staff: {
        ...profile,
        role,
        permissions: effectivePermissions,
        email: cleanEmail,
      },
    });
  } catch (err: any) {
    console.error('POST /api/team error:', err);
    return NextResponse.json({ error: err?.message || 'خطأ داخلي في الخادم' }, { status: 500 });
  }
}

// PATCH /api/team - Update staff role, granular permissions, or active status
export async function PATCH(request: NextRequest) {
  try {
    const authCheck = await verifyAdminCaller();
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { user, supabase } = authCheck;
    const adminClient = getAdminClient();

    const body = await request.json();
    const { id, role, permissions: rawPermissions, is_active } = body;

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'معرف الموظف (id) مطلوب' }, { status: 400 });
    }

    // Protection Guards: Current Admin cannot deactivate self or remove 'team' permission from self
    if (id === user.id) {
      if (is_active === false) {
        return NextResponse.json(
          { error: 'لا يمكنك تعطيل حسابك الشخصي أثناء تسجيل الدخول كمدير للنظام' },
          { status: 400 }
        );
      }
      if (role && role !== 'admin') {
        return NextResponse.json(
          { error: 'لا يمكنك سحب صلاحيات الإدارة عن حسابك الشخصي الحالي' },
          { status: 400 }
        );
      }
      if (Array.isArray(rawPermissions) && !rawPermissions.includes('team')) {
        return NextResponse.json(
          { error: 'لا يمكنك سحب صلاحية إدارة فريق العمل عن حسابك الشخصي الحالي' },
          { status: 400 }
        );
      }
    }

    const dbClient = adminClient || supabase;
    const { data: existingProfile } = await dbClient
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (!existingProfile) {
      return NextResponse.json({ error: 'الموظف غير موجود' }, { status: 404 });
    }

    let existingAuthUser: User | null = null;
    if (adminClient) {
      try {
        const { data: uData } = await adminClient.auth.admin.getUserById(id);
        existingAuthUser = uData?.user || null;
      } catch {
        // Ignore
      }
    }

    const currentAuth = extractStaffAuth(existingAuthUser, existingProfile);
    const validRoles: UserRole[] = ['admin', 'order_agent', 'support_agent'];

    const nextDisplayRole: UserRole =
      role !== undefined
        ? validRoles.includes(role)
          ? role
          : currentAuth.displayRole
        : currentAuth.displayRole;

    const nextPermissions =
      rawPermissions !== undefined
        ? resolveUserPermissions(nextDisplayRole, rawPermissions)
        : role !== undefined
        ? defaultPermissionsForRole(nextDisplayRole)
        : currentAuth.permissions;

    const nextDbRole = computeDatabaseRoleForPermissions(nextDisplayRole, nextPermissions);

    const updates: Partial<Database['public']['Tables']['profiles']['Update']> = {
      updated_at: new Date().toISOString(),
      role: nextDbRole,
    };

    if (is_active !== undefined) {
      if (typeof is_active !== 'boolean') {
        return NextResponse.json({ error: 'حالة النشاط غير صالحة' }, { status: 400 });
      }
      updates.is_active = is_active;
    }

    const { data: updatedProfile, error: updateError } = await dbClient
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Sync app_metadata & user_metadata with display_role and permissions
    if (adminClient) {
      try {
        await adminClient.auth.admin.updateUserById(id, {
          app_metadata: {
            ...(existingAuthUser?.app_metadata || {}),
            role: nextDbRole,
            display_role: nextDisplayRole,
            permissions: nextPermissions,
          },
          user_metadata: {
            ...(existingAuthUser?.user_metadata || {}),
            role: nextDbRole,
            display_role: nextDisplayRole,
            permissions: nextPermissions,
          },
        });
      } catch (err) {
        console.warn('Could not update user metadata in auth:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'تم تحديث بيانات وصلاحيات الموظف بنجاح',
      staff: {
        ...updatedProfile,
        role: nextDisplayRole,
        permissions: nextPermissions,
      },
    });
  } catch (err: any) {
    console.error('PATCH /api/team error:', err);
    return NextResponse.json({ error: err?.message || 'خطأ داخلي في الخادم' }, { status: 500 });
  }
}

// DELETE /api/team - Delete staff member
export async function DELETE(request: NextRequest) {
  try {
    const authCheck = await verifyAdminCaller();
    if ('error' in authCheck) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { user, supabase } = authCheck;
    const adminClient = getAdminClient();

    const { searchParams } = new URL(request.url);
    let targetId = searchParams.get('id');

    if (!targetId) {
      try {
        const body = await request.json();
        targetId = body.id;
      } catch {
        // Ignored if empty body
      }
    }

    if (!targetId) {
      return NextResponse.json({ error: 'معرف الموظف (id) مطلوب للحذف' }, { status: 400 });
    }

    if (targetId === user.id) {
      return NextResponse.json({ error: 'لا يمكنك حذف حسابك الشخصي الحالي' }, { status: 400 });
    }

    const dbClient = adminClient || supabase;
    const { data: targetProfile } = await dbClient
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', targetId)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: 'الموظف غير موجود أو تم حذفه مسبقاً' }, { status: 404 });
    }

    if (adminClient) {
      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(targetId);
      if (deleteAuthError) {
        console.warn('Failed to delete auth user, attempting profile direct delete:', deleteAuthError);
      }
    }

    const { error: deleteProfileError } = await dbClient
      .from('profiles')
      .delete()
      .eq('id', targetId);

    if (deleteProfileError) {
      return NextResponse.json({ error: deleteProfileError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `تم حذف الموظف (${targetProfile.full_name}) بنجاح من النظام`,
    });
  } catch (err: any) {
    console.error('DELETE /api/team error:', err);
    return NextResponse.json({ error: err?.message || 'خطأ داخلي في الخادم' }, { status: 500 });
  }
}
