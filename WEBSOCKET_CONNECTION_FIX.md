# WebSocket Connection Fix for Team Bidding

## Problem Summary

Teams were experiencing "Connection failed" errors when trying to connect to the auction system for bidding. The errors occurred in:

1. **Line 239** in `src/lib/auction-connection.ts`: HTTP connection to `/api/auction/connection` failed
2. **Line 220** in `src/app/team/page.tsx`: Connection error handling showing "Connection failed"

## Root Causes Identified

### 1. WebSocket Server Not Running
- The WebSocket server (`websocket-server-new.js`) was not started
- Required for backend-mediated connections between frontend and auction system
- Server needed to run on port 3003 as configured in environment

### 2. Port Configuration Mismatch
- WebSocket server was starting on default port 3001
- Environment configuration expected port 3003
- Missing environment variable handling in server startup

### 3. Error Handling Issues
- JSON parsing errors when API responses were not properly formatted
- Missing defensive error handling in connection attempts
- Generic error messages not providing useful debugging information

## Solutions Implemented

### 1. Started WebSocket Server
```bash
# Start WebSocket server on correct port
WEBSOCKET_PORT=3003 node websocket-server-new.js
```

### 2. Added NPM Scripts
Updated `package.json` with convenient scripts:
```json
{
  "scripts": {
    "ws": "WEBSOCKET_PORT=3003 node websocket-server-new.js",
    "dev:full": "npm run ws & npm run dev"
  }
}
```

### 3. Improved Error Handling
Enhanced `src/lib/auction-connection.ts` with:
- Defensive JSON parsing with try-catch blocks
- Better error message extraction from API responses
- Validation of response data structure
- More informative error messages for debugging

### 4. Configuration Verification
Confirmed proper environment setup:
- WebSocket server port: 3003
- Next.js application port: 3000
- Centralized configuration in `.env` file

## Testing Results

### WebSocket Server Health Check
```bash
curl -s http://localhost:3003/health
# Response: {"status":"healthy","connectedClients":11,"uptime":45.222525916,"timestamp":"2025-08-28T19:29:08.830Z","port":"3003"}
```

### API Endpoint Test
```bash
curl -X POST -H "Content-Type: application/json" -d '{"action":"connect","auctionId":"auction_1","metadata":{"userAgent":"test"}}' http://localhost:3000/api/auction/connection
# Response: {"error":"Authentication required"}
```

The "Authentication required" response confirms the API is working and properly enforcing security.

## Next Steps for Complete Resolution

### 1. Authentication Integration
- Ensure team users have proper session tokens
- Verify `withAuth` middleware correctly identifies team users
- Test end-to-end authentication flow for team connections

### 2. Run Both Servers
To start the complete system:
```bash
# Terminal 1: Start WebSocket server
npm run ws

# Terminal 2: Start Next.js application
npm run dev

# Or run both together (background mode)
npm run dev:full
```

### 3. Monitoring and Logging
- WebSocket server provides health endpoint at `http://localhost:3003/health`
- Debug logs enabled in development mode
- Connection statistics available through health endpoint

## Key Files Modified

1. **`/Users/anuj/Documents/ipl/ipl-auction/src/lib/auction-connection.ts`**
   - Enhanced error handling in `_attemptConnection()`
   - Added defensive JSON parsing
   - Improved error message formatting

2. **`/Users/anuj/Documents/ipl/ipl-auction/package.json`**
   - Added `ws` script for WebSocket server
   - Added `dev:full` script for running both servers

## Architecture Confirmed

The system uses a **backend-mediated WebSocket architecture**:
1. Frontend connects to Next.js API (`/api/auction/connection`)
2. Next.js API establishes WebSocket connection to dedicated server (port 3003)
3. Real-time events flow through Server-Sent Events (SSE) to frontend
4. Authentication and authorization handled by Next.js middleware

This architecture ensures proper security, session management, and scalability for the auction system.