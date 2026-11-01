export type UserRole = 'admin' | 'order_agent' | 'support_agent';

export type StaffPermission =
  | 'overview'
  | 'orders'
  | 'scheduled_orders'
  | 'complaints'
  | 'offers'
  | 'comments'
  | 'chat'
  | 'menu'
  | 'branches'
  | 'channels'
  | 'team'
  | 'settings';

export interface PermissionMeta {
  key: StaffPermission;
  label: string;
  description: string;
  route: string;
}

export const PERMISSION_DEFINITIONS: PermissionMeta[] = [
  {
    key: 'orders',
    label: 'الطلبات 🛒',
    description: 'استقبال وتأكيد الأوردرات وطباعة الفواتير',
    route: '/orders',
  },
  {
    key: 'scheduled_orders',
    label: 'الطلبات المجدولة 📅',
    description: 'حفظ ومتابعة الأوردرات المجدولة والتنبيه قبل موعد تحضيرها للمطبخ',
    route: '/scheduled-orders',
  },
  {
    key: 'complaints',
    label: 'الشكاوى 🚨',
    description: 'متابعة وحل شكاوى وبلاغات العملاء',
    route: '/complaints',
  },
  {
    key: 'offers',
    label: 'العروض الترويجية 🔥',
    description: 'إضافة وتعديل وتفعيل/إيقاف العروض وصورها',
    route: '/offers',
  },
  {
    key: 'comments',
    label: 'التعليقات 💬',
    description: 'إدارة تعليقات فيسبوك والردود التلقائية على المنشورات',
    route: '/comments',
  },
  {
    key: 'chat',
    label: 'المحادثات الحية 📨',
    description: 'فتح محادثات الماسنجر والرد المباشر على العملاء',
    route: '/chat',
  },
  {
    key: 'menu',
    label: 'المنيو والأسعار 📖',
    description: 'تعديل صور المنيو وقائمة الأسعار',
    route: '/menu',
  },
  {
    key: 'branches',
    label: 'الفروع والتوصيل 🏢',
    description: 'إدارة الفروع ومناطق وأسعار التوصيل',
    route: '/branches',
  },
  {
    key: 'overview',
    label: 'الرئيسية والإحصائيات 📊',
    description: 'عرض لوحة الإحصائيات والملخص اليومي للمطعم',
    route: '/',
  },
  {
    key: 'channels',
    label: 'القنوات والربط 📡',
    description: 'ربط صفحات فيسبوك وإعدادات القنوات',
    route: '/channels',
  },
  {
    key: 'team',
    label: 'فريق العمل والصلاحيات 👥',
    description: 'إضافة الموظفين وتعديل صلاحياتهم',
    route: '/team',
  },
  {
    key: 'settings',
    label: 'الإعدادات العامة ⚙️',
    description: 'إعدادات البوت والبرومبت الرئيسي للذكاء الاصطناعي',
    route: '/settings',
  },
];

export const ALL_STAFF_PERMISSIONS: StaffPermission[] = PERMISSION_DEFINITIONS.map((p) => p.key);

export interface StaffUpdatePayload {
  newRole?: UserRole;
  newIsActive?: boolean;
  newPermissions?: StaffPermission[];
}

export const VALID_DASHBOARD_ROUTES = [
  '/',
  '/orders',
  '/scheduled-orders',
  '/complaints',
  '/chat',
  '/comments',
  '/branches',
  '/menu',
  '/offers',
  '/channels',
  '/team',
  '/settings',
] as const;

export type DashboardRoute = (typeof VALID_DASHBOARD_ROUTES)[number];

const ROUTE_TO_PERMISSION: Record<string, StaffPermission> = {
  '/': 'overview',
  '/orders': 'orders',
  '/scheduled-orders': 'scheduled_orders',
  '/complaints': 'complaints',
  '/chat': 'chat',
  '/comments': 'comments',
  '/branches': 'branches',
  '/menu': 'menu',
  '/offers': 'offers',
  '/channels': 'channels',
  '/team': 'team',
  '/settings': 'settings',
};

const PERMISSION_TO_DASHBOARD_PATH: Record<StaffPermission, string> = {
  overview: '/dashboard',
  orders: '/dashboard/orders',
  scheduled_orders: '/dashboard/scheduled-orders',
  complaints: '/dashboard/complaints',
  offers: '/dashboard/offers',
  comments: '/dashboard/comments',
  chat: '/dashboard/chat',
  menu: '/dashboard/menu',
  branches: '/dashboard/branches',
  channels: '/dashboard/channels',
  team: '/dashboard/team',
  settings: '/dashboard/settings',
};

/** Default permissions assigned when a role is chosen without custom overrides. */
export function defaultPermissionsForRole(role: UserRole): StaffPermission[] {
  if (role === 'admin') return [...ALL_STAFF_PERMISSIONS];
  if (role === 'order_agent') return ['orders', 'scheduled_orders'];
  if (role === 'support_agent') return ['complaints', 'comments'];
  return ['orders', 'scheduled_orders'];
}

/** Validates and normalizes an arbitrary permissions value from metadata. */
export function resolveUserPermissions(
  role: UserRole,
  rawPermissions?: unknown
): StaffPermission[] {
  if (Array.isArray(rawPermissions)) {
    const valid = rawPermissions.filter(
      (p): p is StaffPermission =>
        typeof p === 'string' && (ALL_STAFF_PERMISSIONS as string[]).includes(p)
    );
    if (valid.length > 0) {
      if (role === 'admin' && !valid.includes('scheduled_orders')) {
        valid.push('scheduled_orders');
      }
      return Array.from(new Set(valid));
    }
  }
  return defaultPermissionsForRole(role);
}

/** Extracts displayRole and effective permissions from a Supabase Auth user + profile row. */
export function extractStaffAuth(
  user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null | undefined,
  profile?: { role?: UserRole | null; is_active?: boolean | null } | null
): { displayRole: UserRole; permissions: StaffPermission[]; isActive: boolean } {
  const metaRole =
    (user?.app_metadata?.display_role as UserRole | undefined) ||
    (user?.user_metadata?.display_role as UserRole | undefined);
  const validRoles: UserRole[] = ['admin', 'order_agent', 'support_agent'];
  const displayRole: UserRole =
    metaRole && validRoles.includes(metaRole)
      ? metaRole
      : profile?.role && validRoles.includes(profile.role)
      ? profile.role
      : 'order_agent';

  const rawPerms =
    user?.app_metadata?.permissions ?? user?.user_metadata?.permissions;

  const permissions = resolveUserPermissions(displayRole, rawPerms);
  const isActive = profile?.is_active ?? true;

  return { displayRole, permissions, isActive };
}

/**
 * Determines which Postgres `profiles.role` to store so Supabase RLS allows the user
 * to operate on all tables matching their granted permissions.
 */
export function computeDatabaseRoleForPermissions(
  displayRole: UserRole,
  permissions: StaffPermission[]
): UserRole {
  if (displayRole === 'admin') return 'admin';
  const adminRlsPermissions: StaffPermission[] = [
    'offers',
    'menu',
    'branches',
    'channels',
    'team',
    'settings',
    'overview',
    'chat',
  ];
  const needsAdminRls =
    permissions.some((p) => adminRlsPermissions.includes(p)) ||
    (permissions.includes('orders') && permissions.includes('complaints'));

  if (needsAdminRls) return 'admin';
  if (permissions.includes('complaints') && !permissions.includes('orders')) return 'support_agent';
  return 'order_agent';
}

/** Where each user lands after login or when redirected from an unauthorized route. */
export function homeRouteForRole(
  role: UserRole,
  permissions?: StaffPermission[]
): string {
  const perms = permissions && permissions.length > 0 ? permissions : defaultPermissionsForRole(role);
  // Priority order for landing page
  const priorityOrder: StaffPermission[] = [
    'overview',
    'orders',
    'scheduled_orders',
    'complaints',
    'offers',
    'comments',
    'chat',
    'menu',
    'branches',
    'channels',
    'team',
    'settings',
  ];
  for (const key of priorityOrder) {
    if (perms.includes(key)) {
      return PERMISSION_TO_DASHBOARD_PATH[key];
    }
  }
  return '/dashboard/orders';
}

/**
 * Normalizes any route string (e.g. '/dashboard/orders?tab=active' -> '/orders', '/dashboard' -> '/')
 */
export function normalizeDashboardRoute(pathname: string): string {
  if (!pathname) return '/';
  const clean = pathname.split('?')[0].replace(/\/+$/, '') || '/';
  if (clean === '/dashboard') return '/';
  if (clean.startsWith('/dashboard/')) {
    return clean.slice('/dashboard'.length);
  }
  return clean;
}

/**
 * Checks whether a user with given role, active status, and permissions is authorized to access a dashboard route.
 */
export function isRouteAllowed(
  role: UserRole,
  pathname: string,
  isActive = true,
  customPermissions?: StaffPermission[]
): boolean {
  if (!isActive) {
    return false;
  }

  const route = normalizeDashboardRoute(pathname);
  const perms =
    customPermissions && customPermissions.length > 0
      ? customPermissions
      : defaultPermissionsForRole(role);

  for (const [prefix, permKey] of Object.entries(ROUTE_TO_PERMISSION)) {
    if (prefix === '/') {
      if (route === '/') return perms.includes('overview');
    } else if (route === prefix || route.startsWith(`${prefix}/`)) {
      return perms.includes(permKey);
    }
  }

  return perms.includes('overview');
}

/**
 * Verifies if an admin is permitted to modify a staff member's role or status.
 */
export function assertCanModifyStaff(
  adminId: string,
  targetId: string,
  updates: StaffUpdatePayload
): void {
  if (!adminId || !targetId) {
    throw new Error('Admin ID and Target ID are required for staff modification');
  }

  if (adminId === targetId) {
    if (updates.newIsActive === false) {
      throw new Error('لا يمكنك تعطيل حسابك الشخصي أثناء تسجيل الدخول كمدير للنظام');
    }
    if (updates.newRole !== undefined && updates.newRole !== 'admin') {
      throw new Error('لا يمكنك سحب صلاحيات الإدارة عن حسابك الشخصي الحالي');
    }
    if (updates.newPermissions !== undefined && !updates.newPermissions.includes('team')) {
      throw new Error('لا يمكنك سحب صلاحية إدارة فريق العمل عن حسابك الشخصي الحالي');
    }
  }
}

export function canModifyStaff(
  adminId: string,
  targetId: string,
  updates: StaffUpdatePayload,
  throwOnError = false
): boolean {
  try {
    assertCanModifyStaff(adminId, targetId, updates);
    return true;
  } catch (error) {
    if (throwOnError) {
      throw error;
    }
    return false;
  }
}
