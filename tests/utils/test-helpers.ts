import { Page, expect } from '@playwright/test';

/**
 * Test Utilities for IPL Auction E2E Tests
 * Common authentication and helper functions for Playwright tests
 */

export const testUsers = {
  admin: {
    email: 'admin@iplauction.com',
    password: 'admin123',
    role: 'ADMIN'
  },
  team: {
    email: 'mi@iplauction.com',
    password: 'team123',
    role: 'TEAM'
  },
  team2: {
    email: 'csk@iplauction.com',
    password: 'team123',
    role: 'TEAM'
  }
};

/**
 * Sign in a user and wait for the authentication to complete
 */
export async function signInUser(page: Page, userType: 'admin' | 'team' | 'team2') {
  const user = testUsers[userType];
  await page.goto('/auth/signin');
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  
  // Verify successful authentication
  await expect(page.locator('text=Welcome,')).toBeVisible();
  // Use more specific locator for role badge to avoid strict mode violations
  await expect(page.locator(`span:has-text("${user.role}"), .bg-orange-500:has-text("${user.role}")`).first()).toBeVisible();
}

/**
 * Sign in as admin specifically
 */
export async function signInAsAdmin(page: Page) {
  await signInUser(page, 'admin');
  await expect(page.locator('h1')).toContainText('Admin Dashboard');
}

/**
 * Clear cookies and ensure clean state
 */
export async function clearAuthState(page: Page) {
  await page.context().clearCookies();
  await page.goto('/');
}

/**
 * Generate unique test data to avoid conflicts
 */
export function generateTestData() {
  const timestamp = Date.now();
  return {
    seasonName: `Test Season ${timestamp}`,
    teamName: `Test Team ${timestamp}`,
    playerName: `Test Player ${timestamp}`,
    auctionName: `Test Auction ${timestamp}`,
    uniqueId: timestamp.toString()
  };
}

/**
 * Wait for a form submission to complete
 */
export async function waitForFormSubmission(page: Page) {
  // Wait for loading state and any success/error messages
  await page.waitForLoadState('networkidle');
  
  // Wait a bit more for any async operations
  await page.waitForTimeout(1000);
}

/**
 * Fill and submit a form with error handling
 */
export async function fillAndSubmitForm(page: Page, formData: Record<string, string>, submitSelector: string = 'button[type="submit"]') {
  // Fill form fields
  for (const [selector, value] of Object.entries(formData)) {
    await page.fill(selector, value);
  }
  
  // Submit form
  await page.click(submitSelector);
  await waitForFormSubmission(page);
}

/**
 * Check for success or error messages
 */
export async function expectSuccessMessage(page: Page, message?: string) {
  const successLocator = page.locator('.bg-green-50, .text-green-600');
  await expect(successLocator).toBeVisible();
  
  if (message) {
    await expect(page.locator(`text=${message}`)).toBeVisible();
  }
}

export async function expectErrorMessage(page: Page, message?: string) {
  const errorLocator = page.locator('.bg-red-50, .text-red-600');
  await expect(errorLocator).toBeVisible();
  
  if (message) {
    await expect(page.locator(`text=${message}`)).toBeVisible();
  }
}

/**
 * Navigate to admin section and verify access
 */
export async function navigateToAdminSection(page: Page, section: string) {
  // Navigate to specific admin section
  await page.goto(`/admin/${section}`);
  
  // Verify we're in the correct section
  await expect(page).toHaveURL(`/admin/${section}`);
  
  // Wait for page to load completely
  await page.waitForLoadState('networkidle');
}

/**
 * Upload a file and wait for processing
 */
export async function uploadFile(page: Page, fileInputSelector: string, filePath: string) {
  await page.setInputFiles(fileInputSelector, filePath);
  await waitForFormSubmission(page);
}

/**
 * Create a temporary CSV file for testing player import
 */
export function createTestPlayerCSV(): string {
  const testData = generateTestData();
  const csvContent = `name,role,country,basePrice
${testData.playerName} 1,BATSMAN,India,10000000
${testData.playerName} 2,BOWLER,Australia,8000000
${testData.playerName} 3,ALL_ROUNDER,England,12000000
${testData.playerName} 4,WICKET_KEEPER,South Africa,9000000
${testData.playerName} 5,BATSMAN,West Indies,7000000`;

  // For testing, we'll return the content as a blob URL
  return csvContent;
}

/**
 * Wait for page load and verify admin access
 */
export async function verifyAdminPageAccess(page: Page, expectedTitle?: string) {
  // Wait for authentication and page load
  await page.waitForLoadState('networkidle');
  
  // Verify we're not getting access denied
  await expect(page.locator('text=Access Denied, text=Unauthorized')).not.toBeVisible();
  
  // Check for expected page title or heading
  if (expectedTitle) {
    await expect(page.locator('h1, h2, h3').filter({ hasText: expectedTitle })).toBeVisible();
  }
  
  // Should have admin navigation elements
  await expect(page.locator('a[href^="/admin"], nav').first()).toBeVisible();
}

/**
 * Check table data and pagination
 */
export async function verifyTableData(page: Page, tableSelector: string, expectedRowCount?: number) {
  const table = page.locator(tableSelector);
  await expect(table).toBeVisible();
  
  if (expectedRowCount !== undefined) {
    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(expectedRowCount);
  }
}

/**
 * Handle modal dialogs consistently
 */
export async function handleModal(page: Page, action: 'confirm' | 'cancel' = 'confirm') {
  // Wait for modal to appear
  await page.waitForSelector('[role="dialog"], .modal, .fixed.inset-0', { timeout: 5000 });
  
  if (action === 'confirm') {
    // Look for confirmation buttons with various text patterns
    const confirmButton = page.locator('button').filter({ 
      hasText: /^(confirm|yes|create|save|delete|ok)$/i 
    }).first();
    await confirmButton.click();
  } else {
    // Look for cancel buttons
    const cancelButton = page.locator('button').filter({ 
      hasText: /^(cancel|no|close)$/i 
    }).first();
    await cancelButton.click();
  }
  
  await waitForFormSubmission(page);
}

/**
 * Verify loading states are handled properly
 */
export async function verifyLoadingStates(page: Page) {
  // Should not show infinite loading spinners
  const loadingSpinner = page.locator('.animate-spin');
  
  // If loading spinner is present, it should disappear within reasonable time
  if (await loadingSpinner.isVisible()) {
    await expect(loadingSpinner).not.toBeVisible({ timeout: 10000 });
  }
}

/**
 * Test data cleanup helper
 */
export async function cleanupTestData(page: Page, testData: any) {
  // This would typically clean up any test data created during tests
  // For now, we'll rely on the database being reset between test runs
  console.log('Cleanup test data:', testData);
}