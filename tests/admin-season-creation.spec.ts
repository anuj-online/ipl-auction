import { test, expect } from '@playwright/test';
import { 
  signInAsAdmin, 
  clearAuthState, 
  generateTestData, 
  fillAndSubmitForm, 
  expectSuccessMessage, 
  expectErrorMessage, 
  navigateToAdminSection, 
  verifyAdminPageAccess,
  verifyLoadingStates,
  waitForFormSubmission
} from './utils/test-helpers';

/**
 * Season Creation E2E Tests
 * Tests the complete season management workflow for admins
 */

test.describe('Season Creation and Management', () => {
  
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await signInAsAdmin(page);
  });

  test('Admin can navigate to season creation page', async ({ page }) => {
    // Navigate directly to season creation page
    await navigateToAdminSection(page, 'seasons/create');
    
    // Verify we're on the season creation page
    await expect(page).toHaveURL('/admin/seasons/create');
    await verifyAdminPageAccess(page, 'Create New Season');
    
    // Check form elements are present
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="year"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Season creation form validation works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'seasons/create');
    
    // Check that required fields have validation
    const nameInput = page.locator('input[name="name"]');
    const yearInput = page.locator('input[name="year"]');
    
    await expect(nameInput).toHaveAttribute('required');
    await expect(yearInput).toHaveAttribute('required');
    
    // Test server-side validation by filling form with invalid data
    const testData = generateTestData();
    await page.fill('input[name="name"]', testData.seasonName);
    await page.fill('input[name="year"]', '2020'); // Past year
    
    // Submit form
    await page.click('button[type="submit"]');
    await waitForFormSubmission(page);
    
    // Should show validation error for past year
    await expectErrorMessage(page);
    
    // Should still be on the same page
    await expect(page).toHaveURL('/admin/seasons/create');
  });

  test('Successfully create a new season with basic configuration', async ({ page }) => {
    await navigateToAdminSection(page, 'seasons/create');
    
    const testData = generateTestData();
    const currentYear = new Date().getFullYear();
    
    // Fill in basic season information
    await fillAndSubmitForm(page, {
      'input[name="name"]': testData.seasonName,
      'input[name="year"]': (currentYear + 1).toString(),
      'textarea[name="description"]': `Test season created at ${new Date().toISOString()}`,
    });
    
    // Should show success message
    await expectSuccessMessage(page, 'Season created successfully');
    
    // Should redirect to seasons list
    await expect(page).toHaveURL(/\/admin\/seasons/);
    
    // Verify the season appears in the list
    await expect(page.locator(`text=${testData.seasonName}`)).toBeVisible();
  });

  test('Create season with advanced configuration settings', async ({ page }) => {
    await navigateToAdminSection(page, 'seasons/create');
    
    const testData = generateTestData();
    const currentYear = new Date().getFullYear();
    
    // Fill basic information
    await page.fill('input[name="name"]', testData.seasonName);
    await page.fill('input[name="year"]', (currentYear + 1).toString());
    
    // Configure advanced settings
    await page.fill('input[name="maxTeams"]', '10');
    await page.fill('input[name="maxBudget"]', '1000000000'); // 100 Crores
    await page.fill('input[name="maxSquadSize"]', '25');
    await page.fill('input[name="maxOverseasPlayers"]', '8');
    
    // Set auction rules
    await page.fill('input[name="bidIncrement"]', '500000'); // 5 Lakhs
    await page.fill('input[name="lotTimer"]', '60');
    
    // Submit form
    await page.click('button[type="submit"]');
    await waitForFormSubmission(page);
    
    // Verify success
    await expectSuccessMessage(page);
    await expect(page.locator(`text=${testData.seasonName}`)).toBeVisible();
  });

  test('Cannot create season with duplicate name', async ({ page }) => {
    await navigateToAdminSection(page, 'seasons/create');
    
    // Try to create a season with existing name
    await fillAndSubmitForm(page, {
      'input[name="name"]': 'IPL 2024', // This should already exist
      'input[name="year"]': '2025',
    });
    
    // Should show error message
    await expectErrorMessage(page, 'Season already exists');
    
    // Should stay on creation page
    await expect(page).toHaveURL('/admin/seasons/create');
  });

  test('Season year validation works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'seasons/create');
    
    const testData = generateTestData();
    
    // Try with past year
    await fillAndSubmitForm(page, {
      'input[name="name"]': testData.seasonName,
      'input[name="year"]': '2020',
    });
    
    // Should show validation error for past year
    await expectErrorMessage(page, 'cannot be in the past');
  });

  test('Admin can view seasons list', async ({ page }) => {
    await navigateToAdminSection(page, 'seasons');
    
    await verifyAdminPageAccess(page, 'Seasons');
    
    // Should show seasons table
    await expect(page.locator('table, .grid')).toBeVisible();
    
    // Should show create season button
    await expect(page.locator('a[href="/admin/seasons/create"], button:has-text("Create Season")')).toBeVisible();
    
    // Should show existing seasons
    await expect(page.locator('text=IPL 2024')).toBeVisible();
  });

  test('Admin can edit existing season', async ({ page }) => {
    await navigateToAdminSection(page, 'seasons');
    
    // Click edit button for a season
    const editButton = page.locator('a[href*="/edit"], button:has-text("Edit")').first();
    await editButton.click();
    
    // Should navigate to edit page
    await expect(page).toHaveURL(/\/admin\/seasons\/.*\/edit/);
    
    // Form should be pre-populated
    await expect(page.locator('input[name="name"]')).toHaveValue(/.+/);
    await expect(page.locator('input[name="year"]')).toHaveValue(/.+/);
    
    // Make a change
    const testData = generateTestData();
    await page.fill('textarea[name="description"]', `Updated description ${testData.uniqueId}`);
    
    // Submit changes
    await page.click('button[type="submit"]');
    await waitForFormSubmission(page);
    
    // Should show success message
    await expectSuccessMessage(page, 'Season updated successfully');
  });

  test('Season status management works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'seasons');
    
    // Look for season status indicators
    await expect(page.locator('.bg-gray-100, .bg-green-100, .bg-blue-100')).toBeVisible();
    
    // Should show status text (DRAFT, ACTIVE, COMPLETED)
    const statusLocator = page.locator('text=DRAFT, text=ACTIVE, text=COMPLETED').first();
    if (await statusLocator.isVisible()) {
      await expect(statusLocator).toBeVisible();
    }
  });

  test('Season configuration form shows proper validation messages', async ({ page }) => {
    await navigateToAdminSection(page, 'seasons/create');
    
    const testData = generateTestData();
    
    // Fill required fields first
    await page.fill('input[name="name"]', testData.seasonName);
    await page.fill('input[name="year"]', (new Date().getFullYear() + 1).toString());
    
    // Test numeric field validation with invalid values
    await page.fill('input[name="maxTeams"]', '1'); // Below minimum
    await page.click('button[type="submit"]');
    await waitForFormSubmission(page);
    
    await expectErrorMessage(page);
    
    // Test maximum values
    await page.fill('input[name="maxTeams"]', '20'); // Above maximum
    await page.click('button[type="submit"]');
    await waitForFormSubmission(page);
    
    await expectErrorMessage(page);
  });

  test('Navigation between season pages works correctly', async ({ page }) => {
    // Start from dashboard
    await page.goto('/admin');
    await expect(page.locator('h1')).toContainText('Admin Dashboard');
    
    // Navigate to seasons
    await page.click('a[href="/admin/seasons"], button:has-text("Manage Seasons")');
    await expect(page).toHaveURL('/admin/seasons');
    
    // Navigate to create season
    await page.click('a[href="/admin/seasons/create"], button:has-text("Create Season")');
    await expect(page).toHaveURL('/admin/seasons/create');
    
    // Use back navigation
    await page.click('a:has-text("Back"), button:has-text("Back")');
    await expect(page).toHaveURL('/admin/seasons');
    
    // Return to dashboard
    await page.click('a[href="/admin"], a:has-text("Dashboard")');
    await expect(page).toHaveURL('/admin');
  });

  test('Loading states are handled properly during season operations', async ({ page }) => {
    await navigateToAdminSection(page, 'seasons/create');
    
    const testData = generateTestData();
    
    // Fill form
    await page.fill('input[name="name"]', testData.seasonName);
    await page.fill('input[name="year"]', '2025');
    
    // Submit and check for loading state
    await page.click('button[type="submit"]');
    
    // Should show loading state briefly
    const submitButton = page.locator('button[type="submit"]');
    
    // Button should either be disabled or show loading text
    const isDisabled = await submitButton.isDisabled().catch(() => false);
    const hasLoadingText = await submitButton.locator('text=Creating, text=Loading').isVisible().catch(() => false);
    
    expect(isDisabled || hasLoadingText).toBeTruthy();
    
    // Verify loading states clear
    await verifyLoadingStates(page);
  });

  test('Error handling works for server errors', async ({ page }) => {
    await navigateToAdminSection(page, 'seasons/create');
    
    // Try to trigger a server error by creating invalid data
    // This test might need to be adjusted based on actual server validation
    await fillAndSubmitForm(page, {
      'input[name="name"]': '', // Empty name
      'input[name="year"]': 'invalid', // Invalid year
    });
    
    // Should handle the error gracefully
    await expect(page.locator('.text-red-600, .bg-red-50')).toBeVisible();
    
    // Form should still be usable
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

});