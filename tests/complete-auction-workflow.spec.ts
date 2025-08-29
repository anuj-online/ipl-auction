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
  createTestPlayerCSV
} from './utils/test-helpers';

/**
 * Complete Auction Setup Workflow E2E Test
 * Tests the entire flow: Create Season → Add Teams → Add Players → Create Auction
 */

test.describe('Complete Auction Setup Workflow', () => {
  
  test.beforeEach(async ({ page }) => {
    await clearAuthState(page);
    await signInAsAdmin(page);
  });

  test('Complete auction setup workflow from start to finish', async ({ page }) => {
    const testData = generateTestData();
    const currentYear = new Date().getFullYear() + 1;
    
    // ===== STEP 1: CREATE SEASON =====
    console.log('Step 1: Creating Season');
    
    // Navigate to season creation
    await page.goto('/admin');
    await page.click('a[href="/admin/seasons/create"], button:has-text("Create Season")');
    await expect(page).toHaveURL('/admin/seasons/create');
    
    // Create new season
    await fillAndSubmitForm(page, {
      'input[name="name"]': testData.seasonName,
      'input[name="year"]': currentYear.toString(),
      'textarea[name="description"]': `E2E Test Season created at ${new Date().toISOString()}`,
      'input[name="maxTeams"]': '4',
      'input[name="maxBudget"]': '800000000', // 80 Crores
      'input[name="maxSquadSize"]': '20',
      'input[name="maxOverseasPlayers"]': '6',
    });
    
    await expectSuccessMessage(page, 'Season created successfully');
    await expect(page.locator(`text=${testData.seasonName}`)).toBeVisible();
    
    // ===== STEP 2: ADD TEAMS =====
    console.log('Step 2: Adding Teams');
    
    // Navigate to team management
    await page.goto('/admin/teams');
    await verifyAdminPageAccess(page, 'Teams');
    
    // Add 4 teams for the season
    const teamNames = [
      `${testData.teamName} Lions`,
      `${testData.teamName} Tigers`,
      `${testData.teamName} Eagles`,
      `${testData.teamName} Warriors`
    ];
    
    for (const teamName of teamNames) {
      await page.click('button:has-text("Add Team"), a:has-text("Add Team")');
      
      await fillAndSubmitForm(page, {
        'input[name="name"]': teamName,
        'input[name="displayName"]': teamName,
        'input[name="budgetTotal"]': '200000000', // 20 Crores per team
        'input[name="maxSquadSize"]': '20',
        'input[name="maxOverseas"]': '6',
      });
      
      // Select the created season
      const seasonSelect = page.locator('select[name="seasonId"]');
      if (await seasonSelect.isVisible()) {
        const seasonOption = await page.locator(`select[name="seasonId"] option:has-text("${testData.seasonName}")`);
        if (await seasonOption.count() > 0) {
          await seasonSelect.selectOption({ label: testData.seasonName });
        }
      }
      
      await expectSuccessMessage(page, 'Team created successfully');
      await expect(page.locator(`text=${teamName}`)).toBeVisible();
    }
    
    // ===== STEP 3: ADD PLAYERS =====
    console.log('Step 3: Adding Players');
    
    // Navigate to player management
    await page.goto('/admin/players');
    await verifyAdminPageAccess(page, 'Player Management');
    
    // Add individual players first
    const individualPlayers = [
      { name: `${testData.playerName} Star`, role: 'BATSMAN', country: 'India', price: '150000000' },
      { name: `${testData.playerName} Ace`, role: 'BOWLER', country: 'Australia', price: '120000000' },
      { name: `${testData.playerName} Pro`, role: 'ALL_ROUNDER', country: 'England', price: '180000000' },
      { name: `${testData.playerName} Keeper`, role: 'WICKET_KEEPER', country: 'South Africa', price: '100000000' },
    ];
    
    for (const player of individualPlayers) {
      await page.click('button:has-text("Add Player")');
      
      await page.fill('input[name="name"]', player.name);
      await page.selectOption('select[name="role"]', player.role);
      await page.selectOption('select[name="country"], input[name="country"]', player.country);
      
      // Set base price
      const priceSelect = page.locator('select[name="basePrice"]');
      if (await priceSelect.isVisible()) {
        await priceSelect.selectOption(player.price);
      } else {
        await page.fill('input[name="basePrice"]', player.price);
      }
      
      // Select season
      const seasonSelect = page.locator('select[name="seasonId"]');
      if (await seasonSelect.isVisible()) {
        const seasonOption = await page.locator(`select[name="seasonId"] option:has-text("${testData.seasonName}")`);
        if (await seasonOption.count() > 0) {
          await seasonSelect.selectOption({ label: testData.seasonName });
        }
      }
      
      await page.click('button[type="submit"]:has-text("Create"), button:has-text("Add Player")');
      await waitForFormSubmission(page);
      
      await expectSuccessMessage(page, 'Player created successfully');
      await expect(page.locator(`text=${player.name}`)).toBeVisible();
    }
    
    // Add players via bulk import
    await page.click('a[href="/admin/players/import"], button:has-text("Import Players")');
    await expect(page).toHaveURL('/admin/players/import');
    
    // Create and upload CSV file
    const csvContent = `name,role,country,basePrice\n${testData.playerName} Bulk 1,BATSMAN,India,80000000\n${testData.playerName} Bulk 2,BOWLER,Pakistan,70000000\n${testData.playerName} Bulk 3,ALL_ROUNDER,West Indies,90000000\n${testData.playerName} Bulk 4,WICKET_KEEPER,New Zealand,85000000\n${testData.playerName} Bulk 5,BATSMAN,Sri Lanka,60000000\n${testData.playerName} Bulk 6,BOWLER,Bangladesh,55000000\n${testData.playerName} Bulk 7,ALL_ROUNDER,Afghanistan,75000000\n${testData.playerName} Bulk 8,BATSMAN,Australia,95000000\n${testData.playerName} Bulk 9,BOWLER,England,88000000\n${testData.playerName} Bulk 10,WICKET_KEEPER,South Africa,92000000\n${testData.playerName} Bulk 11,BATSMAN,India,78000000\n${testData.playerName} Bulk 12,BOWLER,India,82000000\n${testData.playerName} Bulk 13,ALL_ROUNDER,India,87000000\n${testData.playerName} Bulk 14,BATSMAN,Australia,94000000\n${testData.playerName} Bulk 15,BOWLER,England,89000000\n${testData.playerName} Bulk 16,WICKET_KEEPER,India,86000000`;
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([{
      name: 'bulk-players.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    }]);
    
    await waitForFormSubmission(page);
    
    // Should show import preview
    await expect(page.locator('text=16 players, text=valid')).toBeVisible();
    
    // Select the test season for import
    const importSeasonSelect = page.locator('select[name="seasonId"]');
    if (await importSeasonSelect.isVisible()) {
      const seasonOption = await page.locator(`select[name="seasonId"] option:has-text("${testData.seasonName}")`);
      if (await seasonOption.count() > 0) {
        await importSeasonSelect.selectOption({ label: testData.seasonName });
      }
    }
    
    // Proceed with import
    const importButton = page.locator('button:has-text("Import"), button:has-text("Confirm Import")');
    if (await importButton.isVisible() && await importButton.isEnabled()) {
      await importButton.click();
      await waitForFormSubmission(page);
      await expectSuccessMessage(page, 'imported successfully');
    }
    
    // ===== STEP 4: VERIFY SETUP COMPLETENESS =====
    console.log('Step 4: Verifying Setup');
    
    // Go back to players list to verify total count
    await page.goto('/admin/players');
    
    // Filter by the test season
    const playerSeasonFilter = page.locator('select[name="seasonId"], select:has(option)');
    if (await playerSeasonFilter.isVisible()) {
      const seasonOption = await page.locator(`option:has-text("${testData.seasonName}")`);
      if (await seasonOption.count() > 0) {
        await playerSeasonFilter.selectOption({ label: testData.seasonName });
        await waitForFormSubmission(page);
      }
    }
    
    // Should have at least 20 players (4 individual + 16 bulk)
    await expect(page.locator(`text=${testData.playerName}`)).toBeVisible();
    
    // ===== STEP 5: CREATE AUCTION =====
    console.log('Step 5: Creating Auction');
    
    // Navigate to auction creation
    await page.goto('/admin/auctions');
    await page.click('a[href="/admin/auctions/create"], button:has-text("Create Auction")');
    await expect(page).toHaveURL('/admin/auctions/create');
    
    // Fill auction details
    await page.fill('input[name="name"]', `${testData.auctionName} for ${testData.seasonName}`);
    
    // Select the test season
    const auctionSeasonSelect = page.locator('select[name="seasonId"]');
    await auctionSeasonSelect.selectOption({ label: testData.seasonName });
    
    // Wait for validation
    await waitForFormSubmission(page);
    
    // Should show positive validation since we have 4 teams and 20+ players
    await expect(page.locator('text=Ready to create auction, text=Setup Validation')).toBeVisible();
    
    // Configure auction settings
    await page.selectOption('select[name="lotDuration"]', '60000'); // 60 seconds
    await page.selectOption('select[name="bidIncrement"]', '500000'); // 5 Lakhs
    
    // Show advanced settings if available
    const advancedToggle = page.locator('button:has-text("Advanced")');
    if (await advancedToggle.isVisible()) {
      await advancedToggle.click();
      await page.selectOption('select[name="softCloseThreshold"]', '10000');
      await page.selectOption('select[name="maxExtensions"]', '3');
    }
    
    // Submit auction creation
    await page.click('button[type="submit"]');
    await waitForFormSubmission(page);
    
    // Should show success
    await expectSuccessMessage(page, 'Auction created successfully');
    
    // Should redirect to auctions list
    await expect(page).toHaveURL('/admin/auctions');
    
    // Auction should appear in the list
    await expect(page.locator(`text=${testData.auctionName}`)).toBeVisible();
    
    // ===== STEP 6: VERIFY COMPLETE SETUP =====
    console.log('Step 6: Final Verification');
    
    // Verify auction shows proper statistics
    await expect(page.locator('text=20, text=lots')).toBeVisible(); // Should show 20+ lots
    
    // Verify auction is in correct status
    await expect(page.locator('text=NOT_STARTED, text=CREATED')).toBeVisible();
    
    // Navigate back to dashboard to see summary
    await page.goto('/admin');
    
    // Dashboard should reflect the new data
    await expect(page.locator('text=Total Seasons')).toBeVisible();
    await expect(page.locator('text=Total Teams')).toBeVisible();
    await expect(page.locator('text=Total Players')).toBeVisible();
    
    console.log('Complete workflow test passed successfully!');
  });

  test('Workflow validation prevents auction creation with insufficient setup', async ({ page }) => {
    const testData = generateTestData();
    
    // ===== CREATE SEASON WITH MINIMAL SETUP =====
    
    // Create season
    await page.goto('/admin/seasons/create');
    await fillAndSubmitForm(page, {
      'input[name="name"]': testData.seasonName,
      'input[name="year"]': (new Date().getFullYear() + 1).toString(),
    });
    
    await expectSuccessMessage(page);
    
    // Add only 1 team (insufficient)
    await page.goto('/admin/teams');
    await page.click('button:has-text("Add Team")');
    
    await fillAndSubmitForm(page, {
      'input[name="name"]': `${testData.teamName} Solo`,
      'input[name="budgetTotal"]': '1000000000',
    });
    
    // Select the test season
    const seasonSelect = page.locator('select[name="seasonId"]');
    if (await seasonSelect.isVisible()) {
      const seasonOption = await page.locator(`option:has-text("${testData.seasonName}")`);
      if (await seasonOption.count() > 0) {
        await seasonSelect.selectOption({ label: testData.seasonName });
      }
    }
    
    await expectSuccessMessage(page);
    
    // Add only 5 players (insufficient)
    await page.goto('/admin/players');
    
    for (let i = 1; i <= 5; i++) {
      await page.click('button:has-text("Add Player")');
      
      await page.fill('input[name="name"]', `${testData.playerName} ${i}`);
      await page.selectOption('select[name="role"]', 'BATSMAN');
      await page.fill('input[name="basePrice"]', '10000000');
      
      // Select season
      const playerSeasonSelect = page.locator('select[name="seasonId"]');
      if (await playerSeasonSelect.isVisible()) {
        const seasonOption = await page.locator(`option:has-text("${testData.seasonName}")`);
        if (await seasonOption.count() > 0) {
          await playerSeasonSelect.selectOption({ label: testData.seasonName });
        }
      }
      
      await page.click('button[type="submit"]');
      await waitForFormSubmission(page);
    }
    
    // ===== TRY TO CREATE AUCTION (SHOULD FAIL) =====
    
    await page.goto('/admin/auctions/create');
    
    await page.fill('input[name="name"]', testData.auctionName);
    await page.selectOption('select[name="seasonId"]', { label: testData.seasonName });
    
    await waitForFormSubmission(page);
    
    // Should show validation errors
    await expect(page.locator('text=Minimum 2 teams required')).toBeVisible();
    await expect(page.locator('text=Minimum 20 players required')).toBeVisible();
    await expect(page.locator('text=Setup incomplete')).toBeVisible();
    
    // Submit button should be disabled
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();
    
    // Trying to force submit should show error
    await submitButton.click({ force: true });
    await expectErrorMessage(page, 'validation errors');
  });

  test('Workflow handles errors gracefully at each step', async ({ page }) => {
    const testData = generateTestData();
    
    // ===== TEST SEASON CREATION ERRORS =====
    
    await page.goto('/admin/seasons/create');
    
    // Try with duplicate name
    await fillAndSubmitForm(page, {
      'input[name="name"]': 'IPL 2024', // Existing season
      'input[name="year"]': '2025',
    });
    
    await expectErrorMessage(page, 'already exists');
    
    // ===== TEST TEAM CREATION ERRORS =====
    
    await page.goto('/admin/teams');
    await page.click('button:has-text("Add Team")');
    
    // Try with invalid budget
    await fillAndSubmitForm(page, {
      'input[name="name"]': testData.teamName,
      'input[name="budgetTotal"]': '-1000000',
    });
    
    await expectErrorMessage(page);
    
    // ===== TEST PLAYER CREATION ERRORS =====
    
    await page.goto('/admin/players');
    await page.click('button:has-text("Add Player")');
    
    // Try with invalid data
    await fillAndSubmitForm(page, {
      'input[name="name"]': '', // Empty name
      'input[name="basePrice"]': 'invalid',
    });
    
    await expectErrorMessage(page);
    
    // ===== TEST AUCTION CREATION ERRORS =====
    
    await page.goto('/admin/auctions/create');
    
    // Try without selecting season
    await fillAndSubmitForm(page, {
      'input[name="name"]': testData.auctionName,
    });
    
    await expectErrorMessage(page, 'Please select a season');
    
    console.log('Error handling test completed successfully!');
  });

  test('Workflow navigation and breadcrumbs work correctly', async ({ page }) => {
    // Test navigation flow
    await page.goto('/admin');
    
    // Dashboard → Seasons → Create Season
    await page.click('a[href="/admin/seasons/create"], button:has-text("Create Season")');
    await expect(page).toHaveURL('/admin/seasons/create');
    
    // Back to dashboard
    await page.click('a[href="/admin"], a:has-text("Dashboard")');
    await expect(page).toHaveURL('/admin');
    
    // Dashboard → Teams → Team Management
    await page.click('a[href="/admin/teams"], button:has-text("Manage Teams")');
    await expect(page).toHaveURL('/admin/teams');
    
    // Teams → Players → Player Management
    await page.click('a[href="/admin/players"], button:has-text("Manage Players")');
    await expect(page).toHaveURL('/admin/players');
    
    // Players → Import → Bulk Import
    await page.click('a[href="/admin/players/import"]');
    await expect(page).toHaveURL('/admin/players/import');
    
    // Back to players
    await page.click('a:has-text("Back"), button:has-text("Back")');
    await expect(page).toHaveURL('/admin/players');
    
    // Players → Auctions → Auction Management
    await page.click('a[href="/admin/auctions"], button:has-text("Auctions")');
    await expect(page).toHaveURL('/admin/auctions');
    
    // Auctions → Create Auction
    await page.click('a[href="/admin/auctions/create"], button:has-text("Create Auction")');
    await expect(page).toHaveURL('/admin/auctions/create');
    
    console.log('Navigation test completed successfully!');
  });

});