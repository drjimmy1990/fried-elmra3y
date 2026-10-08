import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isRouteAllowed,
  canModifyStaff,
  assertCanModifyStaff,
  normalizeDashboardRoute,
  type UserRole,
  VALID_DASHBOARD_ROUTES,
  homeRouteForRole,
} from '../lib/role-guard.ts';

describe('Role-Based Access Control (RBAC) & Route Guard Tests', () => {
  describe('Route Normalization', () => {
    it('normalizes various dashboard path representations', () => {
      assert.strictEqual(normalizeDashboardRoute('/dashboard'), '/');
      assert.strictEqual(normalizeDashboardRoute('/dashboard/'), '/');
      assert.strictEqual(normalizeDashboardRoute('/dashboard/orders'), '/orders');
      assert.strictEqual(normalizeDashboardRoute('/dashboard/orders?status=pending'), '/orders');
      assert.strictEqual(normalizeDashboardRoute('/orders'), '/orders');
      assert.strictEqual(normalizeDashboardRoute('/complaints/'), '/complaints');
    });
  });

  describe('3-Tier RBAC Route Permissions Table', () => {
    // Expected route permission matrix (v2):
    // Route        | admin | order_agent | support_agent
    // /            | YES   | NO          | NO
    // /orders      | YES   | YES         | NO
    // /complaints  | YES   | NO          | YES
    // /chat        | YES   | YES         | YES   (order card -> customer chat)
    // /comments    | YES   | NO          | YES   (comment inbox)
    // /menu        | YES   | NO          | NO
    // /offers      | YES   | NO          | NO
    // /post-rules  | YES   | NO          | NO
    // /channels    | YES   | NO          | NO
    // /team        | YES   | NO          | NO
    // /settings    | YES   | NO          | NO

    const routePermissionsMap: Record<
      string,
      { admin: boolean; order_agent: boolean; support_agent: boolean }
    > = {
      '/': { admin: true, order_agent: false, support_agent: false },
      '/orders': { admin: true, order_agent: true, support_agent: false },
      '/complaints': { admin: true, order_agent: false, support_agent: true },
      '/chat': { admin: true, order_agent: true, support_agent: true },
      '/comments': { admin: true, order_agent: false, support_agent: true },
      '/menu': { admin: true, order_agent: false, support_agent: false },
      '/offers': { admin: true, order_agent: false, support_agent: false },
      '/post-rules': { admin: true, order_agent: false, support_agent: false },
      '/channels': { admin: true, order_agent: false, support_agent: false },
      '/team': { admin: true, order_agent: false, support_agent: false },
      '/settings': { admin: true, order_agent: false, support_agent: false },
    };

    it('verifies admin role has full access to all dashboard routes', () => {
      for (const route of VALID_DASHBOARD_ROUTES) {
        // Direct route
        assert.strictEqual(
          isRouteAllowed('admin', route, true),
          true,
          `Admin should be granted access to ${route}`
        );
        // Prefix with /dashboard
        const fullPath = route === '/' ? '/dashboard' : `/dashboard${route}`;
        assert.strictEqual(
          isRouteAllowed('admin', fullPath, true),
          true,
          `Admin should be granted access to ${fullPath}`
        );
      }
    });

    it('verifies order_agent is allowed /orders and /chat only and denied all other routes', () => {
      // Allowed routes
      assert.strictEqual(isRouteAllowed('order_agent', '/orders', true), true);
      assert.strictEqual(isRouteAllowed('order_agent', '/dashboard/orders', true), true);
      assert.strictEqual(isRouteAllowed('order_agent', '/dashboard/orders?tab=active', true), true);
      assert.strictEqual(isRouteAllowed('order_agent', '/dashboard/chat?contactId=abc', true), true);

      // Explicitly denied routes
      const deniedRoutes = [
        '/',
        '/dashboard',
        '/menu',
        '/dashboard/menu',
        '/offers',
        '/dashboard/offers',
        '/post-rules',
        '/dashboard/post-rules',
        '/team',
        '/dashboard/team',
        '/settings',
        '/dashboard/settings',
        '/complaints',
        '/dashboard/complaints',
        '/comments',
        '/dashboard/channels',
        '/channels',
        '/chatty', // prefix lookalike must not match /chat
      ];

      for (const deniedRoute of deniedRoutes) {
        assert.strictEqual(
          isRouteAllowed('order_agent', deniedRoute, true),
          false,
          `order_agent MUST be denied access to ${deniedRoute}`
        );
      }
    });

    it('verifies support_agent is allowed /complaints, /chat and /comments only, and denied all others', () => {
      // Allowed routes
      assert.strictEqual(isRouteAllowed('support_agent', '/complaints', true), true);
      assert.strictEqual(isRouteAllowed('support_agent', '/dashboard/complaints', true), true);
      assert.strictEqual(isRouteAllowed('support_agent', '/chat', true), true);
      assert.strictEqual(isRouteAllowed('support_agent', '/dashboard/chat', true), true);
      assert.strictEqual(isRouteAllowed('support_agent', '/dashboard/comments', true), true);

      // Explicitly denied routes
      const deniedRoutes = [
        '/',
        '/dashboard',
        '/orders',
        '/dashboard/orders',
        '/menu',
        '/dashboard/menu',
        '/offers',
        '/dashboard/offers',
        '/post-rules',
        '/dashboard/post-rules',
        '/channels',
        '/dashboard/channels',
        '/team',
        '/dashboard/team',
        '/settings',
        '/dashboard/settings',
      ];

      for (const deniedRoute of deniedRoutes) {
        assert.strictEqual(
          isRouteAllowed('support_agent', deniedRoute, true),
          false,
          `support_agent MUST be denied access to ${deniedRoute}`
        );
      }
    });

    it('sends each role to a landing page it is allowed to open', () => {
      const roles: UserRole[] = ['admin', 'order_agent', 'support_agent'];
      for (const role of roles) {
        const home = homeRouteForRole(role);
        assert.strictEqual(isRouteAllowed(role, home, true), true, `${role} home ${home} must be allowed`);
      }
      assert.strictEqual(homeRouteForRole('order_agent'), '/dashboard/orders');
      assert.strictEqual(homeRouteForRole('support_agent'), '/dashboard/complaints');
    });

    it('validates entire route mapping table comprehensively across all 3 roles', () => {
      const roles: UserRole[] = ['admin', 'order_agent', 'support_agent'];
      for (const [route, expected] of Object.entries(routePermissionsMap)) {
        for (const role of roles) {
          const allowed = isRouteAllowed(role, route, true);
          assert.strictEqual(
            allowed,
            expected[role],
            `Role [${role}] on route [${route}] expected ${expected[role]}, got ${allowed}`
          );
        }
      }
    });
  });

  describe('Inactive Staff Account Blocking', () => {
    it('denies all routes regardless of role when is_active === false', () => {
      const roles: UserRole[] = ['admin', 'order_agent', 'support_agent'];
      const testRoutes = [
        '/',
        '/dashboard',
        '/orders',
        '/dashboard/orders',
        '/complaints',
        '/dashboard/complaints',
        '/chat',
        '/dashboard/chat',
        '/settings',
      ];

      for (const role of roles) {
        for (const route of testRoutes) {
          assert.strictEqual(
            isRouteAllowed(role, route, false),
            false,
            `Inactive account with role ${role} must be denied access to ${route}`
          );
        }
      }
    });
  });

  describe('Admin Self-Protection Guard (canModifyStaff)', () => {
    const currentAdminId = 'admin-user-uuid-111';
    const targetStaffId = 'staff-user-uuid-222';

    it('prevents an admin from deactivating their own account (returns false and throws)', () => {
      // Boolean return test
      const allowed = canModifyStaff(currentAdminId, currentAdminId, {
        newIsActive: false,
      });
      assert.strictEqual(allowed, false);

      // Throw verification
      assert.throws(
        () => {
          assertCanModifyStaff(currentAdminId, currentAdminId, {
            newIsActive: false,
          });
        },
        {
          name: 'Error',
          message: 'لا يمكنك تعطيل حسابك الشخصي أثناء تسجيل الدخول كمدير للنظام',
        }
      );
    });

    it('prevents an admin from demoting their own account (returns false and throws)', () => {
      // Demoting to order_agent
      const allowedOrderAgent = canModifyStaff(currentAdminId, currentAdminId, {
        newRole: 'order_agent',
      });
      assert.strictEqual(allowedOrderAgent, false);

      // Demoting to support_agent
      const allowedSupportAgent = canModifyStaff(currentAdminId, currentAdminId, {
        newRole: 'support_agent',
      });
      assert.strictEqual(allowedSupportAgent, false);

      // Throw verification
      assert.throws(
        () => {
          assertCanModifyStaff(currentAdminId, currentAdminId, {
            newRole: 'order_agent',
          });
        },
        {
          name: 'Error',
          message: 'لا يمكنك سحب صلاحيات الإدارة عن حسابك الشخصي الحالي',
        }
      );
    });

    it('allows an admin to deactivate or change roles of OTHER staff members', () => {
      // Deactivating another staff member
      const canDeactivate = canModifyStaff(currentAdminId, targetStaffId, {
        newIsActive: false,
      });
      assert.strictEqual(canDeactivate, true);

      // Demoting or changing role of another staff member
      const canChangeRole = canModifyStaff(currentAdminId, targetStaffId, {
        newRole: 'support_agent',
      });
      assert.strictEqual(canChangeRole, true);

      assert.doesNotThrow(() => {
        assertCanModifyStaff(currentAdminId, targetStaffId, {
          newRole: 'order_agent',
          newIsActive: false,
        });
      });
    });

    it('allows an admin to update self when keeping admin role and active status', () => {
      const allowedSelfAdmin = canModifyStaff(currentAdminId, currentAdminId, {
        newRole: 'admin',
        newIsActive: true,
      });
      assert.strictEqual(allowedSelfAdmin, true);

      assert.doesNotThrow(() => {
        assertCanModifyStaff(currentAdminId, currentAdminId, {
          newRole: 'admin',
          newIsActive: true,
        });
      });
    });
  });
});
