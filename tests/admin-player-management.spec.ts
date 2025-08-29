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
  handleModal,
  verifyTableData,
  createTestPlayerCSV
} from './utils/test-helpers';

/**
 * Player Management E2E Tests
 * Tests the complete player management workflow including individual and bulk operations
 */

test.describe('Player Management and Operations', () => {
  
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await signInAsAdmin(page);
  });

  test('Admin can navigate to player management page', async ({ page }) => {
    // Navigate from dashboard
    await page.click('a[href="/admin/players"], button:has-text("Manage Players")');
    
    // Verify we're on the players page
    await expect(page).toHaveURL('/admin/players');
    await verifyAdminPageAccess(page, 'Player Management');
    
    // Check for player management elements
    await expect(page.locator('button:has-text("Add Player"), a:has-text("Add Player")')).toBeVisible();
    await expect(page.locator('a[href="/admin/players/import"], button:has-text("Import Players")')).toBeVisible();
    
    // Should show players table if any exist
    const playersTable = page.locator('table');
    if (await playersTable.isVisible()) {
      await verifyTableData(page, 'table');
    }
  });

  test('Admin can create a new player individually', async ({ page }) => {
    await navigateToAdminSection(page, 'players');
    
    // Click add player button
    await page.click('button:has-text("Add Player"), a:has-text("Add Player")');
    
    // Should open player creation form/modal
    await expect(page.locator('h2:has-text("Add"), h3:has-text("Create Player")')).toBeVisible();
    
    const testData = generateTestData();
    
    // Fill player information
    await fillAndSubmitForm(page, {
      'input[name="name"]': testData.playerName,
      'input[name="country"]': 'India',
      'input[name="basePrice"]': '10000000', // 1 Crore
      'input[name="tags"]': 'test,batsman',
    });
    
    // Select role
    await page.selectOption('select[name="role"]', 'BATSMAN');
    
    // Select season
    const seasonSelect = page.locator('select[name="seasonId"]');
    if (await seasonSelect.isVisible()) {
      await seasonSelect.selectOption({ index: 1 });
    }
    
    // Submit form
    await page.click('button[type="submit"]:has-text("Create"), button:has-text("Add Player")');
    await waitForFormSubmission(page);
    
    // Should show success message
    await expectSuccessMessage(page, 'Player created successfully');
    
    // Player should appear in the list
    await expect(page.locator(`text=${testData.playerName}`)).toBeVisible();
  });

  test('Player creation form validation works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'players');
    
    // Open player creation form
    await page.click('button:has-text("Add Player")');
    
    // Try to submit empty form
    await page.click('button[type="submit"]:has-text("Create"), button:has-text("Add Player")');
    
    // Should show validation errors
    await expectErrorMessage(page);
    await expect(page.locator('text=Player name is required, text=Name is required')).toBeVisible();
    
    // Test invalid base price
    await page.fill('input[name="name"]', 'Test Player');
    await page.fill('input[name="basePrice"]', '-1');
    await page.click('button[type="submit"]');
    
    await expectErrorMessage(page, 'Base price must be positive');
  });

  test('Player role selection and country assignment work correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'players');
    
    await page.click('button:has-text("Add Player")');
    
    const testData = generateTestData();
    
    // Test each role
    const roles = ['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'];
    
    for (const role of roles) {
      await page.fill('input[name="name"]', `${testData.playerName} ${role}`);
      await page.selectOption('select[name="role"]', role);
      
      // Test different countries
      await page.selectOption('select[name="country"], input[name="country"]', 'Australia');
      
      // Overseas checkbox should be automatically checked for non-India countries
      const overseasCheckbox = page.locator('input[type="checkbox"][name="isOverseas"]');
      if (await overseasCheckbox.isVisible()) {
        await expect(overseasCheckbox).toBeChecked();
      }
      
      // Change to India
      await page.selectOption('select[name="country"], input[name="country"]', 'India');
      
      // Overseas checkbox should be unchecked for India
      if (await overseasCheckbox.isVisible()) {
        await expect(overseasCheckbox).not.toBeChecked();
      }
      
      break; // Test just one iteration to avoid creating multiple players
    }
    
    // Cancel the form
    await page.click('button:has-text("Cancel")');
  });

  test('Player base price configuration works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'players');
    
    await page.click('button:has-text("Add Player")');
    
    const testData = generateTestData();
    
    // Test different price options
    await page.fill('input[name="name"]', testData.playerName);
    
    // Select from dropdown options
    const priceSelect = page.locator('select[name="basePrice"]');
    if (await priceSelect.isVisible()) {
      await priceSelect.selectOption('15000000'); // 1.5 Crores
    } else {
      // If it's a direct input
      await page.fill('input[name="basePrice"]', '15000000');
    }
    
    await page.selectOption('select[name="role"]', 'BATSMAN');
    
    // Submit form
    await page.click('button[type="submit"]');
    await waitForFormSubmission(page);
    
    // Should show success with correct price format
    await expectSuccessMessage(page);
    await expect(page.locator('text=₹1.5Cr, text=15000000')).toBeVisible();
  });

  test('Admin can edit existing player', async ({ page }) => {
    await navigateToAdminSection(page, 'players');
    
    // Look for edit button on an existing player
    const editButton = page.locator('button:has-text("Edit"), a:has-text("Edit")').first();
    
    if (await editButton.isVisible()) {
      await editButton.click();
      
      // Should open edit form
      await expect(page.locator('h2:has-text("Edit"), h3:has-text("Update")')).toBeVisible();
      
      // Form should be pre-populated
      await expect(page.locator('input[name="name"]')).toHaveValue(/.+/);
      
      // Make changes
      const testData = generateTestData();
      await page.fill('input[name="tags"]', `updated,${testData.uniqueId}`);
      
      // Submit changes
      await page.click('button[type="submit"]:has-text("Update"), button:has-text("Save")');
      await waitForFormSubmission(page);
      
      // Should show success message
      await expectSuccessMessage(page, 'Player updated successfully');
    }
  });

  test('Player search and filtering functionality works', async ({ page }) => {
    await navigateToAdminSection(page, 'players');
    
    // Test search functionality
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('Virat');
      await waitForFormSubmission(page);
      
      // Should filter players
      await expect(page.locator('text=Virat')).toBeVisible();
      
      // Clear search
      await searchInput.fill('');
      await waitForFormSubmission(page);
    }
    
    // Test role filter
    const roleFilter = page.locator('select[name="role"], select:has(option:has-text("BATSMAN"))');
    
    if (await roleFilter.isVisible()) {
      await roleFilter.selectOption('BATSMAN');
      await waitForFormSubmission(page);
      
      // Should show only batsmen
      await expect(page.locator('text=BATSMAN')).toBeVisible();
    }
    
    // Test country filter
    const countryFilter = page.locator('select[name="country"], select:has(option:has-text("India"))');
    
    if (await countryFilter.isVisible()) {
      await countryFilter.selectOption('India');
      await waitForFormSubmission(page);
      
      // Should show only Indian players
      await expect(page.locator('text=India')).toBeVisible();
    }
    
    // Test season filter
    const seasonFilter = page.locator('select[name="seasonId"], select:has(option:has-text("Season"))');
    
    if (await seasonFilter.isVisible()) {
      await seasonFilter.selectOption({ index: 1 });
      await waitForFormSubmission(page);
      
      await verifyLoadingStates(page);
    }
  });

  test('Bulk player import functionality works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'players');
    
    // Navigate to import page
    await page.click('a[href="/admin/players/import"], button:has-text("Import Players")');
    
    // Verify we're on import page
    await expect(page).toHaveURL('/admin/players/import');
    await verifyAdminPageAccess(page, 'Import');
    
    // Should show file upload interface
    await expect(page.locator('input[type="file"], input[accept*="csv"]')).toBeVisible();
    await expect(page.locator('text=CSV, text=Excel')).toBeVisible();
    
    // Should show sample format or template
    await expect(page.locator('text=name,role,country,basePrice, text=Sample Format')).toBeVisible();
  });

  test('CSV file upload and validation works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'players/import');
    
    // Create test CSV content
    const csvContent = createTestPlayerCSV();
    
    // Create a blob and file for upload
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const file = new File([blob], 'test-players.csv', { type: 'text/csv' });
    
    // Upload file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([{
      name: 'test-players.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    }]);
    
    // Should show file preview or validation
    await waitForFormSubmission(page);
    
    // Should show preview of players to be imported
    await expect(page.locator('text=5 players, text=valid')).toBeVisible();
    
    // Should show different roles
    await expect(page.locator('text=BATSMAN, text=BOWLER, text=ALL_ROUNDER, text=WICKET_KEEPER')).toBeVisible();
  });

  test('Player import preview and validation works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'players/import');
    
    // Upload a valid file (we'll simulate this)
    const fileInput = page.locator('input[type="file"]');
    
    // Create test file content
    const csvContent = createTestPlayerCSV();
    
    await fileInput.setInputFiles([{
      name: 'test-players.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    }]);
    
    await waitForFormSubmission(page);
    
    // Should show import preview
    await expect(page.locator('text=Preview, text=Import Preview')).toBeVisible();
    
    // Should show player data
    await expect(page.locator('table')).toBeVisible();
    
    // Should show validation results
    await expect(page.locator('text=Valid, text=Error')).toBeVisible();
    
    // Should have import button
    await expect(page.locator('button:has-text("Import"), button:has-text("Confirm Import")')).toBeVisible();
  });

  test('Player import with errors shows proper validation', async ({ page }) => {
    await navigateToAdminSection(page, 'players/import');
    
    // Create CSV with errors
    const invalidCsvContent = `name,role,country,basePrice
Invalid Player,,Invalid Country,abc
,BATSMAN,India,5000000
Valid Player,INVALID_ROLE,India,10000000`;
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([{
      name: 'invalid-players.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(invalidCsvContent)
    }]);
    
    await waitForFormSubmission(page);
    
    // Should show validation errors
    await expectErrorMessage(page);
    await expect(page.locator('text=Invalid role, text=Name is required')).toBeVisible();
    
    // Should show error count
    await expect(page.locator('text=2 errors, text=error')).toBeVisible();
    
    // Import button should be disabled or show warning
    const importButton = page.locator('button:has-text("Import")');
    if (await importButton.isVisible()) {
      await expect(importButton).toBeDisabled();
    }
  });

  test('Successful player import shows progress and results', async ({ page }) => {
    await navigateToAdminSection(page, 'players/import');
    
    // Upload valid file
    const csvContent = createTestPlayerCSV();
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([{
      name: 'test-players.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    }]);
    
    await waitForFormSubmission(page);
    
    // Proceed with import
    const importButton = page.locator('button:has-text("Import"), button:has-text("Confirm Import")');
    
    if (await importButton.isVisible() && await importButton.isEnabled()) {
      await importButton.click();
      
      // Should show progress
      await expect(page.locator('text=Importing, text=Progress')).toBeVisible();
      
      // Wait for completion
      await waitForFormSubmission(page);
      
      // Should show success message
      await expectSuccessMessage(page, 'players imported successfully');
      
      // Should show import statistics
      await expect(page.locator('text=5 players, text=imported')).toBeVisible();
    }
  });

  test('Player deletion works with confirmation', async ({ page }) => {
    await navigateToAdminSection(page, 'players');
    
    // Look for delete button on a player
    const deleteButton = page.locator('button:has-text("Delete"), button:has-text("Remove")').first();
    
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      
      // Should show confirmation dialog
      await expect(page.locator('text=Are you sure, text=Delete player')).toBeVisible();
      
      // Confirm deletion
      await handleModal(page, 'confirm');
      
      // Should show success message
      await expectSuccessMessage(page, 'Player deleted successfully');
    }
  });

  test('Player statistics and information display correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'players');
    
    // Should show player statistics
    await expect(page.locator('text=₹, text=Cr, text=L')).toBeVisible(); // Price display
    
    // Should show role badges
    await expect(page.locator('.bg-blue-100, .bg-red-100, .bg-green-100, .bg-purple-100')).toBeVisible();
    
    // Should show country information
    await expect(page.locator('text=India, text=Australia, text=England')).toBeVisible();
    
    // Should show overseas indicators
    const overseasBadge = page.locator('text=Overseas, .bg-orange-100');
    if (await overseasBadge.isVisible()) {
      await expect(overseasBadge).toBeVisible();
    }
  });

  test('Player pagination works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'players');
    
    // Look for pagination controls
    const paginationNext = page.locator('button:has-text("Next"), a:has-text("Next")');
    const paginationPrev = page.locator('button:has-text("Previous"), a:has-text("Previous")');
    
    if (await paginationNext.isVisible()) {
      await paginationNext.click();
      await waitForFormSubmission(page);
      
      // Should load next page
      await verifyLoadingStates(page);
      
      // Previous button should now be enabled
      if (await paginationPrev.isVisible()) {
        await expect(paginationPrev).toBeEnabled();
      }
    }
  });

  test('Error handling works for player operations', async ({ page }) => {
    await navigateToAdminSection(page, 'players');
    
    // Try to create player with invalid data
    await page.click('button:has-text("Add Player")');
    
    await fillAndSubmitForm(page, {
      'input[name="name"]': '', // Empty name
      'input[name="basePrice"]': 'invalid', // Invalid price
    });
    
    // Should handle errors gracefully
    await expect(page.locator('.text-red-600, .bg-red-50')).toBeVisible();
    
    // Form should remain functional
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('Loading states work properly during player operations', async ({ page }) => {
    await navigateToAdminSection(page, 'players');
    
    // Test loading during player creation
    const testData = generateTestData();
    
    await page.click('button:has-text("Add Player")');
    await page.fill('input[name="name"]', testData.playerName);
    await page.click('button[type="submit"]');
    
    // Verify loading states are handled
    await verifyLoadingStates(page);
  });

  test('Navigation between player pages works correctly', async ({ page }) => {
    // Start from dashboard
    await page.goto('/admin');
    
    // Navigate to players
    await page.click('a[href="/admin/players"], button:has-text("Manage Players")');
    await expect(page).toHaveURL('/admin/players');
    
    // Navigate to import
    await page.click('a[href="/admin/players/import"]');
    await expect(page).toHaveURL('/admin/players/import');
    
    // Back to players list
    await page.click('a:has-text("Back"), button:has-text("Back")');
    await expect(page).toHaveURL('/admin/players');
    
    // Return to dashboard
    await page.click('a[href="/admin"], a:has-text("Dashboard")');
    await expect(page).toHaveURL('/admin');
  });

});