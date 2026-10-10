export type UserRole = 'admin' | 'order_agent' | 'support_agent';

export interface StaffUpdatePayload {
  newRole?: UserRole;
  newIsActive?: boolean;
}

export const VALID_DASHBOARD_ROUTES = [
  '/',
  '/orders',
  '/complaints',
  '/chat',
  '/comments',
  '/menu',
  '/offers',
  '/channels',
  '/team',
  '/settings',
] as const;

export type DashboardRoute = (typeof VALID_DASHBOARD_ROUTES)[number];

/** Where each role lands after login or when it opens a page it may not see. */
export function homeRouteForRole(role: UserRole): string {
  if (role === 'order_agent') return '/dashboard/orders';
  if (role === 'support_agent') return '/dashboard/complaints';
  return '/dashboard';
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
 * Checks whether a user with given role and active status is authorized to access a dashboard route.
 *
 * RBAC Rules:
 * - inactive (is_active === false): Denied all routes regardless of role.
 * - admin: Full access to all dashboard routes (VALID_DASHBOARD_ROUTES).
 * - order_agent: Allowed '/orders' and '/chat' (to open the customer chat from an order card).
 * - support_agent: Allowed '/complaints', '/chat' and '/comments' (comment inbox) only.
 */
export function isRouteAllowed(
  role: UserRole,
  pathname: string,
  isActive = true
): boolean {
  // Inactive users are strictly denied from all dashboard routes
  if (!isActive) {
    return false;
  }

  const route = normalizeDashboardRoute(pathname);

  // Admin has access to all dashboard routes
  if (role === 'admin') {
    return true;
  }

  // Order agent: orders only
  if (role === 'order_agent') {
    return ['/orders'].some((r) => route === r || route.startsWith(`${r}/`));
  }

  // Support agent: complaints and comments only (chat is restricted strictly to admin)
  if (role === 'support_agent') {
    return ['/complaints', '/comments'].some((r) => route === r || route.startsWith(`${r}/`));
  }

  return false;
}

/**
 * Verifies if an admin is permitted to modify a staff member's role or status.
 * Prevents admins from accidentally or maliciously deactivating or demoting their own account.
 * Throws an Error with explanation if unauthorized.
 */
export function assertCanModifyStaff(
  adminId: string,
  targetId: string,
  updates: StaffUpdatePayload
): void {
  if (!adminId || !targetId) {
    throw new Error('Admin ID and Target ID are required for staff modification');
  }

  // Self-protection guard
  if (adminId === targetId) {
    if (updates.newIsActive === false) {
      throw new Error('لا يمكنك تعطيل حسابك الشخصي أثناء تسجيل الدخول كمدير للنظام');
    }
    if (updates.newRole !== undefined && updates.newRole !== 'admin') {
      throw new Error('لا يمكنك سحب صلاحيات الإدارة عن حسابك الشخصي الحالي');
    }
  }
}

/**
 * Safe boolean checker for staff modification permissions.
 * Returns false (or throws if throwOnError is true) if admin attempts to demote or deactivate themselves.
 */
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
