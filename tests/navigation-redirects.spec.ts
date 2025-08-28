import { test, expect } from '@playwright/test';

/**
 * Navigation and Route Redirect Tests
 * Tests navigation links, route redirects, and overall routing behavior
 */

const testUsers = {
  admin: {
    email: 'admin@iplauction.com',
    password: 'admin123'
  },
  team: {
    email: 'mi@iplauction.com',
    password: 'team123'
  }
};

async function signInUser(page, userType: 'admin' | 'team') {
  const user = testUsers[userType];
  await page.goto('/auth/signin');
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

test.describe('Navigation and Route Redirects', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test.describe('Homepage Navigation', () => {
    
    test('Homepage navigation links work correctly', async ({ page }) => {
      await page.goto('/');
      
      // Test main sign in button
      await page.click('a[href="/auth/signin"]');
      await expect(page).toHaveURL('/auth/signin');
      await expect(page.locator('h2')).toContainText('Sign in to your account');
      
      // Go back to homepage
      await page.click('text=← Back to homepage');
      await expect(page).toHaveURL('/');
    });

    test('Mobile navigation sign in button works', async ({ page }) => {
      // Simulate mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      
      // Click mobile sign in button
      await page.locator('.md\\:hidden a[href="/auth/signin"]').click();
      await expect(page).toHaveURL('/auth/signin');
    });

    test('Homepage CTA buttons navigate correctly', async ({ page }) => {
      await page.goto('/');
      
      // Test demo button (should go to /demo)
      const demoButton = page.locator('a[href="/demo"]').first();
      if (await demoButton.isVisible()) {
        await demoButton.click();
        await expect(page).toHaveURL('/demo');
      }
    });

    test('Footer navigation links work', async ({ page }) => {
      await page.goto('/');
      
      // Test footer links
      const footerLinks = [
        { href: '/features', text: 'Features' },
        { href: '/demo', text: 'Demo' },
        { href: '/docs', text: 'Documentation' }
      ];

      for (const link of footerLinks) {
        const linkElement = page.locator(`a[href="${link.href}"]`).last();
        if (await linkElement.isVisible()) {
          await linkElement.click();
          await expect(page).toHaveURL(link.href);
          await page.goBack();
        }
      }
    });
  });

  test.describe('Authentication Flow Redirects', () => {
    
    test('Old login route redirects to signin', async ({ page }) => {
      await page.goto('/auth/login');
      
      // Should either redirect or show 404, not show login content
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/auth/login');
    });

    test('Direct admin access redirects to signin', async ({ page }) => {
      await page.goto('/admin');
      
      // Should redirect to signin with callback URL
      await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=%2Fadmin/);
    });

    test('Direct team access redirects to signin', async ({ page }) => {
      await page.goto('/team');
      
      // Should redirect to signin with callback URL
      await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=%2Fteam/);
    });

    test('Post-login redirects work correctly for admin', async ({ page }) => {
      // Try to access admin directly
      await page.goto('/admin');
      
      // Should be redirected to signin
      await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=/);
      
      // Sign in as admin
      await page.fill('input[type="email"]', testUsers.admin.email);
      await page.fill('input[type="password"]', testUsers.admin.password);
      await page.click('button[type="submit"]');
      
      await page.waitForLoadState('networkidle');
      
      // Should redirect back to admin (or show admin content in signin page)
      await expect(page.locator('text=Admin Dashboard')).toBeVisible();
    });

    test('Post-login redirects work correctly for team', async ({ page }) => {
      // Try to access team directly
      await page.goto('/team');
      
      // Should be redirected to signin
      await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=/);
      
      // Sign in as team
      await page.fill('input[type="email"]', testUsers.team.email);
      await page.fill('input[type="password"]', testUsers.team.password);
      await page.click('button[type="submit"]');
      
      await page.waitForLoadState('networkidle');
      
      // Should redirect back to team (or show team content in signin page)
      await expect(page.locator('text=Team Dashboard')).toBeVisible();
    });
  });

  test.describe('Authenticated User Navigation', () => {
    
    test('Admin dashboard navigation links work', async ({ page }) => {
      await signInUser(page, 'admin');
      
      // Should show admin dashboard in signin page
      await expect(page.locator('text=Admin Dashboard')).toBeVisible();
      
      // Test admin action links
      const adminLinks = [
        { href: '/admin/seasons', text: 'Manage Seasons' },
        { href: '/admin/teams', text: 'Manage Teams' },
        { href: '/admin/players', text: 'Manage Players' },
        { href: '/admin/auctions', text: 'Start Auction' }
      ];

      for (const link of adminLinks) {
        const linkElement = page.locator(`a[href="${link.href}"]`);
        if (await linkElement.isVisible()) {
          await linkElement.click();
          await expect(page).toHaveURL(link.href);
          await page.goBack();
          await page.waitForLoadState('networkidle');
        }
      }
    });

    test('Team dashboard navigation links work', async ({ page }) => {
      await signInUser(page, 'team');
      
      // Should show team dashboard in signin page
      await expect(page.locator('text=Team Dashboard')).toBeVisible();
      
      // Test team action links
      const teamLink = page.locator('a[href="/team"]');
      if (await teamLink.isVisible()) {
        await teamLink.click();
        await expect(page).toHaveURL('/team');
      }
    });

    test('Sign out redirects to signin', async ({ page }) => {
      await signInUser(page, 'admin');
      
      // Click sign out
      await page.click('button[title="Sign Out"]');
      
      // Should return to signin form
      await expect(page.locator('h2')).toContainText('Sign in to your account');
      await expect(page.locator('input[type="email"]')).toBeVisible();
    });
  });

  test.describe('Role-Based Navigation Restrictions', () => {
    
    test('Team user cannot navigate to admin routes via URL', async ({ page }) => {
      await signInUser(page, 'team');
      
      // Try to navigate to admin route directly
      await page.goto('/admin');
      
      // Should either show access denied or redirect
      const isAccessDenied = await page.locator('text=Access Denied').isVisible({ timeout: 5000 }).catch(() => false);
      const isRedirected = !page.url().includes('/admin') || page.url().includes('/auth/signin');
      
      expect(isAccessDenied || isRedirected).toBeTruthy();
    });

    test('Unauthorized access shows appropriate fallback', async ({ page }) => {
      await signInUser(page, 'team');
      
      // Try to access admin route
      await page.goto('/admin');
      
      // Wait for response
      await page.waitForLoadState('networkidle');
      
      // Should show either access denied page or redirect
      const hasUnauthorizedContent = 
        await page.locator('text=Access Denied').isVisible().catch(() => false) ||
        await page.locator('text=You don\'t have permission').isVisible().catch(() => false) ||
        page.url().includes('/auth/signin') ||
        page.url() === '/';
      
      expect(hasUnauthorizedContent).toBeTruthy();
    });
  });

  test.describe('Breadcrumb and Navigation State', () => {
    
    test('Navigation maintains proper state across routes', async ({ page }) => {
      await signInUser(page, 'admin');
      
      // Navigate through admin routes
      await page.goto('/admin');
      await expect(page.locator('text=Admin Dashboard')).toBeVisible();
      
      // Go to teams page
      await page.goto('/admin/teams');
      await expect(page).toHaveURL('/admin/teams');
      
      // Go to players page
      await page.goto('/admin/players');
      await expect(page).toHaveURL('/admin/players');
      
      // Should maintain authentication throughout
      await expect(page.locator('text=ADMIN')).toBeVisible();
    });

    test('Browser back/forward buttons work correctly', async ({ page }) => {
      await signInUser(page, 'admin');
      
      // Navigate to different pages
      await page.goto('/admin');
      await page.goto('/admin/teams');
      await page.goto('/admin/players');
      
      // Use browser back button
      await page.goBack();
      await expect(page).toHaveURL('/admin/teams');
      
      // Use browser forward button
      await page.goForward();
      await expect(page).toHaveURL('/admin/players');
      
      // Use browser back button again
      await page.goBack();
      await page.goBack();
      await expect(page.locator('text=Admin Dashboard')).toBeVisible();
    });
  });

  test.describe('Deep Link and Bookmark Support', () => {
    
    test('Deep links work with authentication', async ({ page }) => {
      // Try to access a deep admin route directly
      await page.goto('/admin/teams');
      
      // Should redirect to signin with callback URL
      await expect(page).toHaveURL(/\/auth\/signin\?callbackUrl=%2Fadmin%2Fteams/);
      
      // Sign in
      await page.fill('input[type="email"]', testUsers.admin.email);
      await page.fill('input[type="password"]', testUsers.admin.password);
      await page.click('button[type="submit"]');
      
      await page.waitForLoadState('networkidle');
      
      // Should eventually reach the teams page
      const isOnTeamsPage = page.url().includes('/admin/teams') || 
                           await page.locator('text=Teams').isVisible().catch(() => false);
      expect(isOnTeamsPage).toBeTruthy();
    });

    test('Bookmarked routes work after authentication', async ({ page }) => {
      // First establish authentication
      await signInUser(page, 'admin');
      
      // Navigate to a specific route
      await page.goto('/admin/players');
      
      // Simulate closing and reopening browser (new context)
      const newContext = await page.context().browser()!.newContext();
      const newPage = await newContext.newPage();
      
      // Try to access the bookmarked route
      await newPage.goto('/admin/players');
      
      // Should redirect to signin (since new context has no cookies)
      await expect(newPage).toHaveURL(/\/auth\/signin/);
      
      await newContext.close();
    });
  });

  test.describe('Error Handling and Fallbacks', () => {
    
    test('Invalid routes show appropriate 404 handling', async ({ page }) => {
      await page.goto('/nonexistent-route');
      
      // Should show 404 page or redirect to homepage
      const is404 = 
        await page.locator('text=404').isVisible({ timeout: 5000 }).catch(() => false) ||
        await page.locator('text=Page not found').isVisible({ timeout: 5000 }).catch(() => false) ||
        page.url() === 'http://localhost:3001/';
      
      expect(is404).toBeTruthy();
    });

    test('Network error handling during navigation', async ({ page }) => {
      await signInUser(page, 'admin');
      
      // Simulate offline condition
      await page.context().setOffline(true);
      
      // Try to navigate to a new route
      await page.goto('/admin/teams');
      
      // Should handle gracefully (either show error or cache)
      const hasError = 
        await page.locator('text=offline').isVisible({ timeout: 5000 }).catch(() => false) ||
        await page.locator('text=network').isVisible({ timeout: 5000 }).catch(() => false) ||
        page.url().includes('/admin/teams');
      
      expect(hasError).toBeTruthy();
      
      // Restore online
      await page.context().setOffline(false);
    });
  });
});