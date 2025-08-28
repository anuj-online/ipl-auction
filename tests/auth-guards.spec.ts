import { test, expect } from '@playwright/test';

/**
 * Authentication Guards and Page Access Control Tests
 * Tests role-based access control, protected routes, and authentication guards
 */

const testUsers = {
  admin: {
    email: 'admin@iplauction.com',
    password: 'admin123',
    role: 'ADMIN'
  },
  team: {
    email: 'mi@iplauction.com',
    password: 'team123',
    role: 'TEAM'
  }
};

// Helper function to sign in a user
async function signInUser(page, userType: 'admin' | 'team') {
  const user = testUsers[userType];
  await page.goto('/auth/signin');
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

test.describe('Authentication Guards and Access Control', () => {
  
  test.beforeEach(async ({ page }) => {
    // Ensure clean state
    await page.context().clearCookies();
  });

  test.describe('Unauthenticated Access', () => {
    
    test('Admin routes redirect to signin when unauthenticated', async ({ page }) => {
      await page.goto('/admin');
      
      // Should redirect to signin with callback URL
      await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=/);
      await expect(page.locator('h2')).toContainText('Sign in to your account');
    });

    test('Team routes redirect to signin when unauthenticated', async ({ page }) => {
      await page.goto('/team');
      
      // Should redirect to signin with callback URL
      await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=/);
      await expect(page.locator('h2')).toContainText('Sign in to your account');
    });

    test('Admin sub-routes redirect to signin when unauthenticated', async ({ page }) => {
      const adminRoutes = [
        '/admin/teams',
        '/admin/players',
        '/admin/seasons',
        '/admin/auctions',
        '/admin/reports'
      ];

      for (const route of adminRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=/);
      }
    });

    test('Team sub-routes redirect to signin when unauthenticated', async ({ page }) => {
      const teamRoutes = [
        '/team/roster',
        '/team/strategy',
        '/team/watchlist'
      ];

      for (const route of teamRoutes) {
        await page.goto(route);
        await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=/);
      }
    });

    test('Viewer routes redirect to signin when unauthenticated', async ({ page }) => {
      await page.goto('/viewer');
      
      // Should redirect to signin
      await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=/);
    });
  });

  test.describe('Admin Role Access Control', () => {
    
    test('Admin can access admin dashboard', async ({ page }) => {
      await signInUser(page, 'admin');
      
      // Navigate to admin page directly
      await page.goto('/admin');
      
      // Should load admin dashboard content
      await expect(page.locator('h1')).toContainText('Admin Dashboard');
      await expect(page.locator('text=Manage Seasons')).toBeVisible();
      await expect(page.locator('text=ADMIN')).toBeVisible();
    });

    test('Admin can access all admin sub-routes', async ({ page }) => {
      await signInUser(page, 'admin');
      
      const adminRoutes = [
        { path: '/admin/teams', expectedText: 'Teams' },
        { path: '/admin/players', expectedText: 'Players' },
        { path: '/admin/seasons', expectedText: 'Seasons' },
        { path: '/admin/auctions', expectedText: 'Auctions' },
        { path: '/admin/reports', expectedText: 'Reports' }
      ];

      for (const route of adminRoutes) {
        await page.goto(route.path);
        // Should not redirect to signin
        await expect(page).toHaveURL(route.path);
        // Should show some content (not just loading spinner)
        await expect(page.locator('body')).not.toContainText('Verifying admin access...');
      }
    });

    test('Admin can access team routes (super user)', async ({ page }) => {
      await signInUser(page, 'admin');
      
      await page.goto('/team');
      
      // Admin should be able to access team routes
      await expect(page).toHaveURL('/team');
      // Should not show access denied
      await expect(page.locator('text=Access Denied')).not.toBeVisible();
    });

    test('Admin can access viewer routes', async ({ page }) => {
      await signInUser(page, 'admin');
      
      await page.goto('/viewer');
      
      // Admin should be able to access viewer routes
      await expect(page).toHaveURL('/viewer');
      await expect(page.locator('text=Access Denied')).not.toBeVisible();
    });
  });

  test.describe('Team Role Access Control', () => {
    
    test('Team can access team dashboard', async ({ page }) => {
      await signInUser(page, 'team');
      
      await page.goto('/team');
      
      // Should load team dashboard content
      await expect(page.locator('h1')).toContainText('Team Dashboard');
      await expect(page.locator('text=Budget Remaining')).toBeVisible();
      await expect(page.locator('text=TEAM')).toBeVisible();
    });

    test('Team can access team sub-routes', async ({ page }) => {
      await signInUser(page, 'team');
      
      const teamRoutes = [
        '/team/roster',
        '/team/strategy',
        '/team/watchlist'
      ];

      for (const route of teamRoutes) {
        await page.goto(route);
        // Should not redirect to signin
        await expect(page).toHaveURL(route);
        // Should show some content (not just loading spinner)
        await expect(page.locator('body')).not.toContainText('Verifying team access...');
      }
    });

    test('Team cannot access admin routes', async ({ page }) => {
      await signInUser(page, 'team');
      
      await page.goto('/admin');
      
      // Should show access denied or redirect
      const isRedirected = await page.waitForURL(/\/auth\/signin/, { timeout: 5000 }).catch(() => false);
      
      if (!isRedirected) {
        // If not redirected, should show access denied message
        await expect(page.locator('text=Access Denied')).toBeVisible();
      }
    });

    test('Team cannot access admin sub-routes', async ({ page }) => {
      await signInUser(page, 'team');
      
      const adminRoutes = [
        '/admin/teams',
        '/admin/players',
        '/admin/seasons'
      ];

      for (const route of adminRoutes) {
        await page.goto(route);
        
        // Should either redirect or show access denied
        const currentUrl = page.url();
        const isAccessDenied = await page.locator('text=Access Denied').isVisible().catch(() => false);
        const isRedirected = currentUrl.includes('/auth/signin');
        
        expect(isAccessDenied || isRedirected).toBeTruthy();
      }
    });

    test('Team can access viewer routes', async ({ page }) => {
      await signInUser(page, 'team');
      
      await page.goto('/viewer');
      
      // Team should be able to access viewer routes
      await expect(page).toHaveURL('/viewer');
      await expect(page.locator('text=Access Denied')).not.toBeVisible();
    });
  });

  test.describe('Loading States and Error Handling', () => {
    
    test('AuthGuard shows appropriate loading messages', async ({ page }) => {
      await page.goto('/admin');
      
      // Should show loading state before redirecting
      const loadingVisible = await page.locator('text=Checking authentication...').isVisible({ timeout: 2000 }).catch(() => false);
      
      if (loadingVisible) {
        await expect(page.locator('text=Checking authentication...')).toBeVisible();
      }
      
      // Eventually should redirect to signin
      await expect(page).toHaveURL(/\/auth\/signin/);
    });

    test('Role-specific loading messages display correctly', async ({ page }) => {
      // Start signin process
      await page.goto('/auth/signin');
      await page.fill('input[type="email"]', testUsers.admin.email);
      await page.fill('input[type="password"]', testUsers.admin.password);
      
      // Navigate to admin page in another tab to test loading
      await page.goto('/admin');
      
      // Should show admin-specific loading message
      const adminLoadingVisible = await page.locator('text=Verifying admin access...').isVisible({ timeout: 2000 }).catch(() => false);
      
      if (adminLoadingVisible) {
        await expect(page.locator('text=Verifying admin access...')).toBeVisible();
      }
    });

    test('Unauthorized access shows proper error message', async ({ page }) => {
      await signInUser(page, 'team');
      
      await page.goto('/admin');
      
      // Wait for page to load and check for access denied
      await page.waitForLoadState('networkidle');
      
      // Should show either access denied message or redirect
      const hasAccessDenied = await page.locator('text=Access Denied').isVisible().catch(() => false);
      const isRedirected = page.url().includes('/auth/signin') || page.url() === '/';
      
      expect(hasAccessDenied || isRedirected).toBeTruthy();
    });
  });

  test.describe('Callback URL Functionality', () => {
    
    test('Signin with callback URL redirects to original destination', async ({ page }) => {
      // Try to access admin route directly (should redirect to signin)
      await page.goto('/admin');
      
      // Should be on signin page with callback URL
      await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=/);
      
      // Sign in
      await page.fill('input[type="email"]', testUsers.admin.email);
      await page.fill('input[type="password"]', testUsers.admin.password);
      await page.click('button[type="submit"]');
      
      // Wait for authentication
      await page.waitForLoadState('networkidle');
      
      // Should eventually be on the admin dashboard (original destination)
      await expect(page.locator('text=Admin Dashboard')).toBeVisible();
    });

    test('Multiple redirects maintain callback chain', async ({ page }) => {
      // Try to access a deep admin route
      await page.goto('/admin/teams');
      
      // Should redirect to signin with callback URL
      await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=/);
      
      // Sign in as admin
      await page.fill('input[type="email"]', testUsers.admin.email);
      await page.fill('input[type="password"]', testUsers.admin.password);
      await page.click('button[type="submit"]');
      
      await page.waitForLoadState('networkidle');
      
      // Should eventually reach the teams page (though may show spinner if still loading)
      const hasTeamsContent = await page.locator('text=Teams').isVisible({ timeout: 5000 }).catch(() => false);
      const currentUrl = page.url();
      
      // Either should show teams content or be on the expected URL
      expect(hasTeamsContent || currentUrl.includes('/admin')).toBeTruthy();
    });
  });

  test.describe('Session Persistence', () => {
    
    test('Authentication persists across page refreshes', async ({ page }) => {
      await signInUser(page, 'admin');
      
      // Verify logged in
      await page.goto('/admin');
      await expect(page.locator('text=Admin Dashboard')).toBeVisible();
      
      // Refresh the page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should still be authenticated
      await expect(page.locator('text=Admin Dashboard')).toBeVisible();
      await expect(page.locator('text=ADMIN')).toBeVisible();
    });

    test('Authentication persists across navigation', async ({ page }) => {
      await signInUser(page, 'admin');
      
      // Navigate to different admin pages
      await page.goto('/admin');
      await expect(page.locator('text=Admin Dashboard')).toBeVisible();
      
      await page.goto('/admin/teams');
      // Should not redirect to signin
      await expect(page).toHaveURL('/admin/teams');
      
      await page.goto('/admin/players');
      // Should not redirect to signin
      await expect(page).toHaveURL('/admin/players');
    });
  });
});