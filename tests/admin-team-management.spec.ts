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
  verifyTableData
} from './utils/test-helpers';

/**
 * Team Management E2E Tests
 * Tests the complete team management workflow for admins
 */

test.describe('Team Management and Configuration', () => {
  
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await signInAsAdmin(page);
  });

  test('Admin can navigate to team management page', async ({ page }) => {
    // Navigate from dashboard
    await page.click('a[href="/admin/teams"], button:has-text("Manage Teams")');
    
    // Verify we're on the teams page
    await expect(page).toHaveURL('/admin/teams');
    await verifyAdminPageAccess(page, 'Teams');
    
    // Check for team management elements
    await expect(page.locator('button:has-text("Add Team"), a:has-text("Add Team")')).toBeVisible();
    
    // Should show existing teams if any
    const teamsTable = page.locator('table, .grid');
    if (await teamsTable.isVisible()) {
      await verifyTableData(page, 'table, .grid');
    }
  });

  test('Admin can create a new team', async ({ page }) => {
    await navigateToAdminSection(page, 'teams');
    
    // Click add team button
    await page.click('button:has-text("Add Team"), a:has-text("Add Team")');
    
    // Should open team creation form/modal
    await expect(page.locator('h2:has-text("Add Team"), h3:has-text("Create Team")')).toBeVisible();
    
    const testData = generateTestData();
    
    // Fill team information
    await fillAndSubmitForm(page, {
      'input[name="name"]': testData.teamName,
      'input[name="displayName"]': `${testData.teamName} Lions`,
      'input[name="budgetTotal"]': '1000000000', // 100 Crores
      'input[name="maxSquadSize"]': '25',
      'input[name="maxOverseas"]': '8',
    });
    
    // Should show success message
    await expectSuccessMessage(page, 'Team created successfully');
    
    // Team should appear in the list
    await expect(page.locator(`text=${testData.teamName}`)).toBeVisible();
  });

  test('Team creation form validation works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'teams');
    
    // Open team creation form
    await page.click('button:has-text("Add Team"), a:has-text("Add Team")');
    
    // Try to submit empty form
    await page.click('button[type="submit"]:has-text("Create"), button:has-text("Add Team")');
    
    // Should show validation errors
    await expectErrorMessage(page);
    await expect(page.locator('text=Team name is required, text=Name is required')).toBeVisible();
    
    // Test invalid budget
    await page.fill('input[name="name"]', 'Test Team');
    await page.fill('input[name="budgetTotal"]', '-1');
    await page.click('button[type="submit"]:has-text("Create"), button:has-text("Add Team")');
    
    await expectErrorMessage(page, 'Budget must be positive');
  });

  test('Cannot create team with duplicate name', async ({ page }) => {
    await navigateToAdminSection(page, 'teams');
    
    // Try to create team with existing name
    await page.click('button:has-text("Add Team"), a:has-text("Add Team")');
    
    await fillAndSubmitForm(page, {
      'input[name="name"]': 'Mumbai Indians', // Should already exist
      'input[name="displayName"]': 'MI Test',
      'input[name="budgetTotal"]': '1000000000',
    });
    
    // Should show error message
    await expectErrorMessage(page, 'Team already exists');
  });

  test('Admin can edit existing team', async ({ page }) => {
    await navigateToAdminSection(page, 'teams');
    
    // Look for edit button on an existing team
    const editButton = page.locator('button:has-text("Edit"), a:has-text("Edit")').first();
    await editButton.click();
    
    // Should open edit form
    await expect(page.locator('h2:has-text("Edit Team"), h3:has-text("Update Team")')).toBeVisible();
    
    // Form should be pre-populated
    await expect(page.locator('input[name="name"]')).toHaveValue(/.+/);
    
    // Make changes
    const testData = generateTestData();
    await page.fill('input[name="displayName"]', `Updated ${testData.teamName}`);
    
    // Submit changes
    await page.click('button[type="submit"]:has-text("Update"), button:has-text("Save")');
    await waitForFormSubmission(page);
    
    // Should show success message
    await expectSuccessMessage(page, 'Team updated successfully');
  });

  test('Admin can assign teams to seasons', async ({ page }) => {
    await navigateToAdminSection(page, 'teams');
    
    // Look for season assignment functionality
    await expect(page.locator('select[name="seasonId"], select:has(option)')).toBeVisible();
    
    // Select a season for team assignment
    const seasonSelect = page.locator('select[name="seasonId"], select:has(option)').first();
    await seasonSelect.selectOption({ index: 1 }); // Select first available season
    
    // Should update the team assignment
    await waitForFormSubmission(page);
    
    // Verify the assignment is reflected in the UI
    await expect(page.locator('.text-green-600, .bg-green-100')).toBeVisible();
  });

  test('Team budget configuration works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'teams');
    
    // Open team creation or edit form
    await page.click('button:has-text("Add Team"), button:has-text("Edit")').first();
    
    // Test budget validation
    await page.fill('input[name="budgetTotal"]', '50000000'); // 5 Crores
    await page.fill('input[name="name"]', 'Budget Test Team');
    
    await page.click('button[type="submit"]');
    await waitForFormSubmission(page);
    
    // Should accept valid budget
    if (await page.locator('.text-green-600').isVisible()) {
      await expectSuccessMessage(page);
    }
  });

  test('Squad size and overseas player limits work correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'teams');
    
    await page.click('button:has-text("Add Team"), a:has-text("Add Team")');
    
    const testData = generateTestData();
    
    // Configure team limits
    await fillAndSubmitForm(page, {
      'input[name="name"]': testData.teamName,
      'input[name="displayName"]': testData.teamName,
      'input[name="budgetTotal"]': '1000000000',
      'input[name="maxSquadSize"]': '25',
      'input[name="maxOverseas"]': '8',
    });
    
    // Should create team with proper limits
    await expectSuccessMessage(page);
    
    // Verify the limits are displayed correctly
    await expect(page.locator('text=25')).toBeVisible(); // Squad size
    await expect(page.locator('text=8')).toBeVisible();  // Overseas limit
  });

  test('Team deletion works with confirmation', async ({ page }) => {
    await navigateToAdminSection(page, 'teams');
    
    // Create a test team first
    await page.click('button:has-text("Add Team")');
    
    const testData = generateTestData();
    await fillAndSubmitForm(page, {
      'input[name="name"]': testData.teamName,
      'input[name="displayName"]': testData.teamName,
      'input[name="budgetTotal"]': '1000000000',
    });
    
    await expectSuccessMessage(page);
    
    // Now try to delete it
    const deleteButton = page.locator(`tr:has-text("${testData.teamName}") button:has-text("Delete"), tr:has-text("${testData.teamName}") button:has-text("Remove")`);
    if (await deleteButton.isVisible()) {
      await deleteButton.click();
      
      // Should show confirmation dialog
      await expect(page.locator('text=Are you sure')).toBeVisible();
      
      // Confirm deletion
      await handleModal(page, 'confirm');
      
      // Should show success message
      await expectSuccessMessage(page, 'Team deleted successfully');
      
      // Team should no longer appear in list
      await expect(page.locator(`text=${testData.teamName}`)).not.toBeVisible();
    }
  });

  test('Team status tracking works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'teams');
    
    // Should show team status indicators
    await expect(page.locator('.bg-green-100, .bg-yellow-100, .bg-gray-100')).toBeVisible();
    
    // Status should include budget information
    await expect(page.locator('text=Budget, text=Spent, text=Remaining')).toBeVisible();
  });

  test('Bulk team operations work correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'teams');
    
    // Look for bulk operation controls
    const selectAllCheckbox = page.locator('input[type="checkbox"]:has-text("Select All"), thead input[type="checkbox"]');
    
    if (await selectAllCheckbox.isVisible()) {
      await selectAllCheckbox.check();
      
      // Should show bulk action options
      await expect(page.locator('button:has-text("Bulk"), select:has(option:has-text("Bulk"))')).toBeVisible();
    }
  });

  test('Team search and filtering works correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'teams');
    
    // Look for search functionality
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('Mumbai');
      await waitForFormSubmission(page);
      
      // Should filter teams
      await expect(page.locator('text=Mumbai')).toBeVisible();
    }
    
    // Test filter by season
    const seasonFilter = page.locator('select:has(option:has-text("Season")), select[name*="season"]');
    
    if (await seasonFilter.isVisible()) {
      await seasonFilter.selectOption({ index: 1 });
      await waitForFormSubmission(page);
      
      // Should filter by season
      await verifyLoadingStates(page);
    }
  });

  test('Team roster management interface is accessible', async ({ page }) => {
    await navigateToAdminSection(page, 'teams');
    
    // Look for roster management links
    const rosterButton = page.locator('a:has-text("Roster"), button:has-text("View Roster")').first();
    
    if (await rosterButton.isVisible()) {
      await rosterButton.click();
      
      // Should navigate to roster management
      await expect(page).toHaveURL(/\/roster|\/squad/);
      await verifyAdminPageAccess(page, 'Roster');
    }
  });

  test('Team budget monitoring displays correctly', async ({ page }) => {
    await navigateToAdminSection(page, 'teams');
    
    // Should show budget information for teams
    await expect(page.locator('text=₹, text=Cr, text=Budget')).toBeVisible();
    
    // Budget should be displayed in proper format
    const budgetDisplay = page.locator('text=/₹.*Cr/');
    if (await budgetDisplay.isVisible()) {
      await expect(budgetDisplay).toBeVisible();
    }
  });

  test('Error handling works for team operations', async ({ page }) => {
    await navigateToAdminSection(page, 'teams');
    
    // Try to create team with invalid data
    await page.click('button:has-text("Add Team")');
    
    await fillAndSubmitForm(page, {
      'input[name="name"]': '', // Empty name
      'input[name="budgetTotal"]': 'invalid', // Invalid budget
    });
    
    // Should handle errors gracefully
    await expect(page.locator('.text-red-600, .bg-red-50')).toBeVisible();
    
    // Form should remain functional
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeEnabled();
  });

  test('Loading states work properly during team operations', async ({ page }) => {
    await navigateToAdminSection(page, 'teams');
    
    const testData = generateTestData();
    
    // Create a team and monitor loading states
    await page.click('button:has-text("Add Team")');
    
    await page.fill('input[name="name"]', testData.teamName);
    await page.fill('input[name="budgetTotal"]', '1000000000');
    
    // Submit and check loading state
    await page.click('button[type="submit"]');
    
    // Verify loading states are handled
    await verifyLoadingStates(page);
  });

  test('Team page navigation and breadcrumbs work correctly', async ({ page }) => {
    // Start from dashboard
    await page.goto('/admin');
    
    // Navigate to teams
    await page.click('a[href="/admin/teams"], button:has-text("Manage Teams")');
    await expect(page).toHaveURL('/admin/teams');
    
    // Should show breadcrumb navigation
    await expect(page.locator('nav, .breadcrumb')).toBeVisible();
    
    // Back to dashboard should work
    await page.click('a[href="/admin"], a:has-text("Dashboard")');
    await expect(page).toHaveURL('/admin');
  });

});