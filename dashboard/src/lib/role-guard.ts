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
  '/menu',
  '/offers',
  '/post-rules',
  '/team',
  '/settings',
] as const;

export type DashboardRoute = (typeof VALID_DASHBOARD_ROUTES)[number];

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
 * - admin: Full access to all dashboard routes ('/', '/orders', '/complaints', '/chat', '/menu', '/offers', '/post-rules', '/team', '/settings').
 * - order_agent: Allowed '/orders' only. Denied all others ('/', '/menu', '/offers', '/post-rules', '/team', '/settings', '/complaints', '/chat').
 * - support_agent: Allowed '/complaints', '/chat' only. Denied all others ('/', '/orders', '/menu', '/offers', '/post-rules', '/team', '/settings').
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

  // Order agent is restricted exclusively to /orders
  if (role === 'order_agent') {
    return route === '/orders' || route.startsWith('/orders/');
  }

  // Support agent is restricted exclusively to /complaints and /chat
  if (role === 'support_agent') {
    return (
      route === '/complaints' ||
      route.startsWith('/complaints/') ||
      route === '/chat' ||
      route.startsWith('/chat/')
    );
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
