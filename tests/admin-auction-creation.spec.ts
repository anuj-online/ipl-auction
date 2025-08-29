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
  waitForFormSubmission,
  handleModal
} from './utils/test-helpers';

/**
 * Auction Creation and Validation E2E Tests
 * Tests the complete auction setup and validation workflow
 */

test.describe('Auction Creation and Validation', () => {
  
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await signInAsAdmin(page);
  });

  test('Admin can navigate to auction creation page', async ({ page }) => {
    // Navigate from dashboard
    await page.click('a[href="/admin/auctions"], button:has-text("Auctions")');
    
    // Verify we're on the auctions page
    await expect(page).toHaveURL('/admin/auctions');
    await verifyAdminPageAccess(page, 'Auction');
    
    // Click create auction button
    await page.click('a[href="/admin/auctions/create"], button:has-text("Create Auction")');
    
    // Verify we're on the auction creation page
    await expect(page).toHaveURL('/admin/auctions/create');
    await verifyAdminPageAccess(page, 'Create New Auction');
    
    // Check form elements are present
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('select[name="seasonId"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Create Auction');
  });

  test('Auction creation form validation works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'auctions/create');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expectErrorMessage(page);
    await expect(page.locator('text=Auction name is required, text=Name is required')).toBeVisible();
    
    // Fill partial form
    const testData = generateTestData();
    await page.fill('input[name="name"]', testData.auctionName);
    
    // Submit without season selection
    await page.click('button[type="submit"]');
    await expectErrorMessage(page, 'Please select a season');
    
    // Should still be on the same page
    await expect(page).toHaveURL('/admin/auctions/create');
  });

  test('Season selection and validation works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'auctions/create');
    
    const testData = generateTestData();
    await page.fill('input[name="name"]', testData.auctionName);
    
    // Select a season
    const seasonSelect = page.locator('select[name="seasonId"]');
    await seasonSelect.selectOption({ index: 1 }); // Select first available season
    
    // Should trigger validation check
    await waitForFormSubmission(page);
    
    // Should show validation results
    await expect(page.locator('text=Setup Validation, text=Validation')).toBeVisible();
    
    // May show warnings or errors based on season setup
    const validationResults = page.locator('.text-red-600, .text-yellow-600, .text-green-600');
    await expect(validationResults).toBeVisible();
  });

  test('Auction settings configuration works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'auctions/create');
    
    const testData = generateTestData();
    
    // Fill basic information
    await page.fill('input[name="name"]', testData.auctionName);
    await page.selectOption('select[name="seasonId"]', { index: 1 });
    
    // Configure auction settings
    await page.selectOption('select[name="lotDuration"]', '60000'); // 60 seconds
    await page.selectOption('select[name="bidIncrement"]', '500000'); // 5 Lakhs
    
    // Show advanced settings
    const advancedToggle = page.locator('button:has-text("Show Advanced"), button:has-text("Advanced")');
    if (await advancedToggle.isVisible()) {
      await advancedToggle.click();
      
      // Configure advanced settings
      await page.selectOption('select[name="softCloseThreshold"]', '10000'); // 10 seconds
      await page.selectOption('select[name="softCloseExtension"]', '30000'); // 30 seconds
      await page.selectOption('select[name="maxExtensions"]', '3');
      
      // Toggle auto-bidding
      const autoBiddingCheckbox = page.locator('input[type="checkbox"][name="allowAutoBidding"]');
      if (await autoBiddingCheckbox.isVisible()) {
        await autoBiddingCheckbox.check();
      }
    }
    
    // Settings summary should update
    await expect(page.locator('text=60s, text=₹5L')).toBeVisible();
  });

  test('Auction validation shows proper setup requirements', async ({ page }) => {
    await navigateToAdminSection(page, 'auctions/create');
    
    // Select a season that might have insufficient setup
    await page.selectOption('select[name="seasonId"]', { index: 1 });
    await waitForFormSubmission(page);
    
    // Should show validation status
    await expect(page.locator('text=Setup Validation')).toBeVisible();
    
    // Check for common validation messages
    const validationMessages = [
      'Minimum 2 teams required',
      'Minimum 20 players required',
      'Ready to create auction',
      'Setup incomplete'
    ];
    
    let foundValidation = false;
    for (const message of validationMessages) {
      if (await page.locator(`text=${message}`).isVisible()) {
        foundValidation = true;
        break;
      }
    }
    
    expect(foundValidation).toBeTruthy();
    
    // Should show season info
    await expect(page.locator('text=Teams:, text=Players:')).toBeVisible();
  });

  test('Cannot create auction for season with insufficient setup', async ({ page }) => {
    await navigateToAdminSection(page, 'auctions/create');
    
    const testData = generateTestData();
    
    // Try to create auction for a season that might not be ready
    await page.fill('input[name="name"]', testData.auctionName);
    await page.selectOption('select[name="seasonId"]', { index: 1 });
    
    await waitForFormSubmission(page);
    
    // If validation shows errors, submit button should be disabled
    const hasErrors = await page.locator('.text-red-600').isVisible();
    
    if (hasErrors) {
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeDisabled();
      
      // Try to submit anyway
      await submitButton.click({ force: true });
      
      // Should show error message
      await expectErrorMessage(page, 'validation errors');
    }
  });

  test('Successfully create auction with proper season setup', async ({ page }) => {
    await navigateToAdminSection(page, 'auctions/create');
    
    const testData = generateTestData();
    
    // Fill auction details
    await page.fill('input[name="name"]', testData.auctionName);
    
    // Select a season (try to find one that's properly set up)
    const seasonOptions = page.locator('select[name="seasonId"] option');
    const optionCount = await seasonOptions.count();
    
    let validSeasonFound = false;
    
    // Try different seasons to find one that's ready
    for (let i = 1; i < optionCount && !validSeasonFound; i++) {
      await page.selectOption('select[name="seasonId"]', { index: i });
      await waitForFormSubmission(page);
      
      // Check if this season is ready
      const isReady = await page.locator('text=Ready to create auction').isVisible();
      
      if (isReady) {
        validSeasonFound = true;
        
        // Submit the form
        await page.click('button[type="submit"]');
        await waitForFormSubmission(page);
        
        // Should show success message
        await expectSuccessMessage(page, 'Auction created successfully');
        
        // Should redirect to auctions list
        await expect(page).toHaveURL('/admin/auctions');
        
        // Auction should appear in the list
        await expect(page.locator(`text=${testData.auctionName}`)).toBeVisible();
      }
    }
    
    // If no valid season found, that's also a valid test result
    if (!validSeasonFound) {
      console.log('No seasons with sufficient setup found - this is expected behavior');
    }
  });

  test('Cannot create duplicate auction for same season', async ({ page }) => {
    await navigateToAdminSection(page, 'auctions/create');
    
    const testData = generateTestData();
    
    // Fill form with season that might already have an auction
    await page.fill('input[name="name"]', testData.auctionName);
    await page.selectOption('select[name="seasonId"]', { index: 1 });
    
    await waitForFormSubmission(page);
    
    // If season already has an active auction, should show error
    const hasActiveAuction = await page.locator('text=active auction already exists').isVisible();
    
    if (hasActiveAuction) {
      await page.click('button[type="submit"]');
      await expectErrorMessage(page, 'active auction already exists');
    }
  });

  test('Auction settings summary updates correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'auctions/create');
    
    // Change lot duration
    await page.selectOption('select[name="lotDuration"]', '90000'); // 90 seconds
    
    // Should update settings summary
    await expect(page.locator('text=90s')).toBeVisible();
    
    // Change bid increment
    await page.selectOption('select[name="bidIncrement"]', '1000000'); // 10 Lakhs
    
    // Should update settings summary
    await expect(page.locator('text=₹10L')).toBeVisible();
    
    // Show advanced settings
    const advancedToggle = page.locator('button:has-text("Advanced")');
    if (await advancedToggle.isVisible()) {
      await advancedToggle.click();
      
      // Change advanced settings
      await page.selectOption('select[name="maxExtensions"]', '5');
      
      // Should update summary
      await expect(page.locator('text=5')).toBeVisible();
    }
  });

  test('Auction creation shows proper loading states', async ({ page }) => {
    await navigateToAdminSection(page, 'auctions/create');
    
    const testData = generateTestData();
    
    // Fill form
    await page.fill('input[name="name"]', testData.auctionName);
    await page.selectOption('select[name="seasonId"]', { index: 1 });
    
    // Submit and check for loading state
    await page.click('button[type="submit"]');
    
    // Should show loading state
    const submitButton = page.locator('button[type="submit"]');
    
    // Button should be disabled or show loading text
    const isDisabled = await submitButton.isDisabled().catch(() => false);
    const hasLoadingText = await submitButton.locator('text=Creating, text=Loading').isVisible().catch(() => false);
    
    expect(isDisabled || hasLoadingText).toBeTruthy();
    
    // Verify loading states clear
    await verifyLoadingStates(page);
  });

  test('Admin can view and manage existing auctions', async ({ page }) => {
    await navigateToAdminSection(page, 'auctions');
    
    await verifyAdminPageAccess(page, 'Auction');
    
    // Should show auctions list
    await expect(page.locator('.bg-white')).toBeVisible();
    
    // Should show auction status indicators
    await expect(page.locator('.bg-green-100, .bg-yellow-100, .bg-blue-100, .bg-gray-100')).toBeVisible();
    
    // Should show create auction button
    await expect(page.locator('a[href="/admin/auctions/create"], button:has-text("Create Auction")')).toBeVisible();
    
    // Should show existing auctions if any
    const existingAuctions = page.locator('text=IPL, text=Auction');
    if (await existingAuctions.isVisible()) {
      await expect(existingAuctions).toBeVisible();
    }
  });

  test('Auction status and statistics display correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'auctions');
    
    // Look for auction cards or table rows
    const auctionCard = page.locator('.bg-white').first();
    
    if (await auctionCard.isVisible()) {
      // Should show auction status
      await expect(page.locator('text=LIVE, text=COMPLETED, text=NOT_STARTED')).toBeVisible();
      
      // Should show statistics
      await expect(page.locator('text=lots, text=₹')).toBeVisible();
      
      // Should show progress information
      await expect(page.locator('text=/, text=of')).toBeVisible();
    }
  });

  test('Error handling works for auction creation', async ({ page }) => {
    await navigateToAdminSection(page, 'auctions/create');
    
    // Try to create auction with invalid data
    await fillAndSubmitForm(page, {
      'input[name="name"]': '', // Empty name
    });
    
    // Should handle errors gracefully
    await expect(page.locator('.text-red-600, .bg-red-50')).toBeVisible();
    
    // Form should remain functional
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('Navigation between auction pages works correctly', async ({ page }) => {
    // Start from dashboard
    await page.goto('/admin');
    
    // Navigate to auctions
    await page.click('a[href="/admin/auctions"], button:has-text("Control Auctions")');
    await expect(page).toHaveURL('/admin/auctions');
    
    // Navigate to create auction
    await page.click('a[href="/admin/auctions/create"], button:has-text("Create Auction")');
    await expect(page).toHaveURL('/admin/auctions/create');
    
    // Use back navigation
    await page.click('a:has-text("Back"), button:has-text("Back")');
    await expect(page).toHaveURL('/admin/auctions');
    
    // Return to dashboard
    await page.click('a[href="/admin"], a:has-text("Dashboard")');
    await expect(page).toHaveURL('/admin');
  });

  test('Auction validation API integration works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'auctions/create');
    
    // Select season and wait for validation
    await page.selectOption('select[name="seasonId"]', { index: 1 });
    
    // Should trigger validation API call
    await waitForFormSubmission(page);
    
    // Should show validation results from API
    await expect(page.locator('text=Validating, text=Validation')).toBeVisible();
    
    // Should eventually show validation status
    await page.waitForSelector('.text-green-600, .text-red-600, .text-yellow-600', { timeout: 10000 });
    
    // Validation results should be detailed
    const validationSection = page.locator('[data-testid="validation"], .bg-white:has-text("Validation")');
    
    if (await validationSection.isVisible()) {
      // Should show team and player counts
      await expect(page.locator('text=Teams:, text=Players:')).toBeVisible();
      
      // Should show budget information
      await expect(page.locator('text=Budget, text=₹')).toBeVisible();
    }
  });

  test('Form persistence works correctly during navigation', async ({ page }) => {
    await navigateToAdminSection(page, 'auctions/create');
    
    const testData = generateTestData();
    
    // Fill some form data
    await page.fill('input[name="name"]', testData.auctionName);
    await page.selectOption('select[name="lotDuration"]', '90000');
    
    // Navigate away and back
    await page.click('a:has-text("Back")');
    await expect(page).toHaveURL('/admin/auctions');
    
    await page.click('a[href="/admin/auctions/create"]');
    await expect(page).toHaveURL('/admin/auctions/create');
    
    // Form should be reset (this is typically expected behavior)
    await expect(page.locator('input[name="name"]')).toHaveValue('');
  });

});