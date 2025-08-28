import { test, expect } from '@playwright/test';

/**
 * IPL Auction Authentication Flow Tests
 * Comprehensive testing of signin functionality with role-based access control
 */

// Test data for different user roles
const testUsers = {
  admin: {
    email: 'admin@iplauction.com',
    password: 'admin123',
    role: 'ADMIN',
    expectedDashboard: '/admin',
    dashboardTitle: 'Admin Dashboard'
  },
  team: {
    email: 'mi@iplauction.com',
    password: 'team123',
    role: 'TEAM',
    expectedDashboard: '/team',
    dashboardTitle: 'Mumbai Indians'
  },
  team2: {
    email: 'csk@iplauction.com',
    password: 'team123',
    role: 'TEAM',
    expectedDashboard: '/team',
    dashboardTitle: 'Chennai Super Kings'
  }
};

test.describe('Authentication Flow Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Ensure we start from a clean state
    await page.context().clearCookies();
    await page.goto('/');
  });

  test('Homepage loads without authentication requirements', async ({ page }) => {
    await page.goto('/');
    
    // Should see landing page content without being redirected
    await expect(page).toHaveTitle(/IPL Auction Pro/);
    await expect(page.locator('h1')).toContainText('The Future of');
    await expect(page.locator('span.bg-clip-text').filter({ hasText: 'Cricket Auctions' })).toBeVisible();
    
    // Should see sign in links
    await expect(page.locator('a[href="/auth/signin"]')).toBeVisible();
  });

  test('Sign in page loads correctly', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Check page structure
    await expect(page).toHaveTitle(/IPL Auction Pro/);
    await expect(page.locator('h2')).toContainText('Sign in to your account');
    
    // Check form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign in');
    
    // Check demo accounts section
    await expect(page.locator('text=Demo Accounts')).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Admin' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Team (MI)' })).toBeVisible();
    await expect(page.locator('button').filter({ hasText: 'Team (CSK)' })).toBeVisible();
  });

  test('Invalid credentials show error message', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
    
    // Should still be on signin page
    await expect(page).toHaveURL('/auth/signin');
  });

  test('Admin login flow and role-based UI display', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Fill in admin credentials
    await page.fill('input[type="email"]', testUsers.admin.email);
    await page.fill('input[type="password"]', testUsers.admin.password);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for authentication to complete
    await page.waitForLoadState('networkidle');
    
    // Should show admin UI in signin page
    await expect(page.locator('text=Welcome,')).toBeVisible();
    await expect(page.locator('span.bg-orange-500').filter({ hasText: 'ADMIN' })).toBeVisible();
    
    // Should see admin dashboard content
    await expect(page.locator('h1')).toContainText('Admin Dashboard');
    await expect(page.locator('text=Manage Seasons')).toBeVisible();
    await expect(page.locator('text=Manage Teams')).toBeVisible();
    await expect(page.locator('text=Manage Players')).toBeVisible();
    await expect(page.locator('text=Start Auction')).toBeVisible();
    
    // Should see system status
    await expect(page.locator('text=System Status')).toBeVisible();
    await expect(page.locator('text=Active Sessions')).toBeVisible();
  });

  test('Team login flow and role-based UI display', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Fill in team credentials
    await page.fill('input[type="email"]', testUsers.team.email);
    await page.fill('input[type="password"]', testUsers.team.password);
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for authentication to complete
    await page.waitForLoadState('networkidle');
    
    // Should show team UI in signin page
    await expect(page.locator('text=Welcome,')).toBeVisible();
    await expect(page.locator('text=TEAM')).toBeVisible();
    
    // Should see team dashboard content
    await expect(page.locator('h1')).toContainText('Mumbai Indians');
    await expect(page.locator('text=Budget Remaining')).toBeVisible();
    await expect(page.locator('text=Squad Size')).toBeVisible();
    await expect(page.locator('text=Auction Status')).toBeVisible();
    
    // Should see team-specific actions
    await expect(page.locator('text=Enter Auction Room')).toBeVisible();
    await expect(page.locator('text=Player Watchlist')).toBeVisible();
  });

  test('Demo account selection works correctly', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Click on admin demo account
    await page.click('button:has-text("Admin")');
    
    // Should fill in the form fields
    await expect(page.locator('input[type="email"]')).toHaveValue(testUsers.admin.email);
    await expect(page.locator('input[type="password"]')).toHaveValue(testUsers.admin.password);
    
    // Now click on team demo account
    await page.click('button:has-text("Team (MI)")');
    
    // Should update the form fields
    await expect(page.locator('input[type="email"]')).toHaveValue(testUsers.team.email);
    await expect(page.locator('input[type="password"]')).toHaveValue(testUsers.team.password);
  });

  test('Sign out functionality works correctly', async ({ page }) => {
    // First sign in as admin
    await page.goto('/auth/signin');
    await page.fill('input[type="email"]', testUsers.admin.email);
    await page.fill('input[type="password"]', testUsers.admin.password);
    await page.click('button[type="submit"]');
    
    // Wait for authentication and dashboard to load
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Admin Dashboard')).toBeVisible();
    
    // Click sign out button
    await page.click('button[title="Sign Out"]');
    
    // Should return to signin form
    await expect(page.locator('h2')).toContainText('Sign in to your account');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('Navigation from homepage to signin works', async ({ page }) => {
    await page.goto('/');
    
    // Click sign in link from homepage
    await page.click('a[href="/auth/signin"]');
    
    // Should navigate to signin page
    await expect(page).toHaveURL('/auth/signin');
    await expect(page.locator('h2')).toContainText('Sign in to your account');
  });

  test('Back to homepage link works from signin page', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Click back to homepage link
    await page.click('text=← Back to homepage');
    
    // Should navigate back to homepage
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('The Future of');
  });

  test('Authentication persists across page reloads', async ({ page }) => {
    // Sign in as admin
    await page.goto('/auth/signin');
    await page.fill('input[type="email"]', testUsers.admin.email);
    await page.fill('input[type="password"]', testUsers.admin.password);
    await page.click('button[type="submit"]');
    
    // Wait for authentication
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=Admin Dashboard')).toBeVisible();
    
    // Reload the signin page
    await page.goto('/auth/signin');
    
    // Should still show authenticated admin UI, not signin form
    await expect(page.locator('text=Welcome,')).toBeVisible();
    await expect(page.locator('text=ADMIN')).toBeVisible();
    await expect(page.locator('text=Admin Dashboard')).toBeVisible();
  });

  test('Different team logins show correct team names', async ({ page }) => {
    // Test MI team
    await page.goto('/auth/signin');
    await page.fill('input[type="email"]', testUsers.team.email);
    await page.fill('input[type="password"]', testUsers.team.password);
    await page.click('button[type="submit"]');
    
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Mumbai Indians');
    
    // Sign out
    await page.click('button[title="Sign Out"]');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    
    // Test CSK team
    await page.fill('input[type="email"]', testUsers.team2.email);
    await page.fill('input[type="password"]', testUsers.team2.password);
    await page.click('button[type="submit"]');
    
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Chennai Super Kings');
  });

  test('Password visibility toggle works', async ({ page }) => {
    await page.goto('/auth/signin');
    
    const passwordInput = page.locator('input[type="password"]');
    const toggleButton = page.locator('button[type="button"]').filter({ has: page.locator('svg') });
    
    // Initially password should be hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click toggle to show password
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Click toggle again to hide password
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('Form validation prevents empty submission', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Form should not submit (browser validation)
    // Check that we're still on signin page
    await expect(page).toHaveURL('/auth/signin');
    await expect(page.locator('h2')).toContainText('Sign in to your account');
  });

  test('Loading states display correctly', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Fill in valid credentials
    await page.fill('input[type="email"]', testUsers.admin.email);
    await page.fill('input[type="password"]', testUsers.admin.password);
    
    // Click submit and immediately check for loading state
    await page.click('button[type="submit"]');
    
    // Should show "Signing in..." state
    await expect(page.locator('text=Signing in...')).toBeVisible();
    
    // Wait for authentication to complete
    await page.waitForLoadState('networkidle');
    
    // Should eventually show dashboard
    await expect(page.locator('text=Admin Dashboard')).toBeVisible();
  });
});