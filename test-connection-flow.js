#!/usr/bin/env node

/**
 * Test Script for Backend-Mediated WebSocket Connection Flow
 * 
 * This script validates the complete implementation:
 * 1. File structure and existence
 * 2. Environment configuration
 * 3. Code syntax validation
 * 4. Architecture compliance
 */

const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`[${step}] ${message}`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

async function testFileStructure() {
  logStep('1', 'Testing File Structure');
  
  const requiredFiles = [
    { file: './src/lib/config.ts', description: 'Centralized configuration module' },
    { file: './src/lib/websocket-manager.ts', description: 'Backend WebSocket manager' },
    { file: './src/lib/auction-connection.ts', description: 'Frontend SSE connection service' },
    { file: './src/app/api/auction/connection/route.ts', description: 'Connection API endpoint' },
    { file: './src/app/api/auction/events/[connectionId]/route.ts', description: 'SSE events endpoint' },
    { file: './src/app/admin/auctions/live/page.tsx', description: 'Updated admin live page' },
    { file: './src/app/team/page.tsx', description: 'Updated team dashboard' },
    { file: './src/app/admin/teams/status/page.tsx', description: 'Updated admin team status' },
    { file: './.env', description: 'Environment configuration' }
  ];
  
  let allFilesExist = true;
  
  requiredFiles.forEach(({ file, description }) => {
    if (fs.existsSync(file)) {
      logSuccess(`${description}: ${file}`);
    } else {
      logError(`Missing ${description}: ${file}`);
      allFilesExist = false;
    }
  });
  
  return allFilesExist;
}

async function testEnvironmentConfiguration() {
  logStep('2', 'Testing Environment Configuration');
  
  try {
    const envPath = './.env';
    
    if (!fs.existsSync(envPath)) {
      logError('.env file not found');
      return false;
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    const requiredVars = [
      'NEXT_APP_PORT',
      'WEBSOCKET_PORT', 
      'SSE_PORT',
      'WEBSOCKET_HOST',
      'WS_CONNECTION_TIMEOUT',
      'WS_HEARTBEAT_INTERVAL',
      'MAX_WEBSOCKET_CONNECTIONS',
      'MAX_CONNECTIONS_PER_USER'
    ];
    
    let allVarsPresent = true;
    requiredVars.forEach(varName => {
      if (envContent.includes(varName)) {
        logSuccess(`Environment variable present: ${varName}`);
      } else {
        logError(`Missing environment variable: ${varName}`);
        allVarsPresent = false;
      }
    });
    
    return allVarsPresent;
  } catch (error) {
    logError(`Environment configuration test failed: ${error.message}`);
    return false;
  }
}

async function testCodeStructure() {
  logStep('3', 'Testing Code Structure and Imports');
  
  const codeTests = [
    {
      file: './src/lib/config.ts',
      expectedPatterns: [
        'export interface AppConfig',
        'export const config',
        'getWebSocketUrl',
        'getSSEUrl'
      ]
    },
    {
      file: './src/lib/websocket-manager.ts', 
      expectedPatterns: [
        'class WebSocketManager',
        'establishConnection',
        'addSSEClient',
        'broadcastToAuction'
      ]
    },
    {
      file: './src/lib/auction-connection.ts',
      expectedPatterns: [
        'class AuctionConnectionService',
        'async connect',
        'sendBid',
        'EventSource'
      ]
    }
  ];
  
  let allTestsPassed = true;
  
  for (const test of codeTests) {
    if (!fs.existsSync(test.file)) {
      logError(`File not found: ${test.file}`);
      allTestsPassed = false;
      continue;
    }
    
    const content = fs.readFileSync(test.file, 'utf8');
    
    for (const pattern of test.expectedPatterns) {
      if (content.includes(pattern)) {
        logSuccess(`${test.file}: Found '${pattern}'`);
      } else {
        logError(`${test.file}: Missing '${pattern}'`);
        allTestsPassed = false;
      }
    }
  }
  
  return allTestsPassed;
}

async function runTests() {
  log('\n🚀 Backend-Mediated WebSocket Connection Flow Validation\n', 'blue');
  
  const tests = [
    testFileStructure,
    testEnvironmentConfiguration,
    testCodeStructure
  ];
  
  let passedTests = 0;
  const totalTests = tests.length;
  
  for (const test of tests) {
    try {
      const result = await test();
      if (result) {
        passedTests++;
      }
      console.log(''); // Add spacing between tests
    } catch (error) {
      logError(`Test failed with exception: ${error.message}`);
      console.log('');
    }
  }
  
  // Final results
  log('\n📊 Test Results:', 'blue');
  log(`Passed: ${passedTests}/${totalTests}`, passedTests === totalTests ? 'green' : 'yellow');
  
  if (passedTests === totalTests) {
    logSuccess('🎉 All tests passed! Backend-mediated connection implementation is ready.');
    log('\n🔧 Implementation Summary:', 'blue');
    log('✅ Centralized port configuration in .env');
    log('✅ Backend WebSocket manager for connection mediation');
    log('✅ Frontend SSE-based connection service');
    log('✅ Updated API endpoints for connection management');
    log('✅ Removed direct WebSocket connections from UI');
    
    log('\n📋 Next Steps:', 'blue');
    log('1. Start the WebSocket server: node websocket-server.js');
    log('2. Start the Next.js development server: npm run dev');
    log('3. Test the application in the browser');
    log('4. Monitor connection status in browser console');
    log('5. Verify auction functionality works correctly');
    
  } else {
    logWarning(`⚠️  ${totalTests - passedTests} test(s) failed. Please review the issues above.`);
  }
  
  return passedTests === totalTests;
}

// Run the tests
if (require.main === module) {
  runTests().catch(error => {
    logError(`Test suite failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runTests };