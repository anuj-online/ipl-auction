/**
 * WebSocket Server for Real-time Auction Communication
 * Handles live bidding, event broadcasting, and agent interactions
 */

const WebSocket = require('ws')
const { createServer } = require('http')
const { parse } = require('url')

// In a real implementation, these would be imported from the compiled TypeScript
// For now, we'll create a simplified version
class WebSocketAuctionServer {
  constructor(port = 3001) {
    this.port = port
    this.server = createServer(this.handleHttpRequest.bind(this))
    this.wss = new WebSocket.Server({ 
      server: this.server,
      verifyClient: this.verifyClient.bind(this)
    })
    
    // Store client connections by auction and user
    this.connections = new Map() // auctionId -> Set<WebSocket>
    this.userConnections = new Map() // userId -> WebSocket
    this.clientData = new Map() // WebSocket -> { userId, role, auctionId }
    
    this.setupWebSocketHandling()
    this.setupHeartbeat()
  }

  /**
   * Handle HTTP requests (for health checks)
   */
  handleHttpRequest(req, res) {
    const { pathname } = parse(req.url)
    
    if (pathname === '/health') {
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type'
      })
      
      res.end(JSON.stringify({
        status: 'healthy',
        connectedClients: this.wss.clients.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        port: this.port
      }))
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found')
    }
  }

  /**
   * Verify client connection
   */
  verifyClient(info) {
    // Extract auth token from query or headers
    const { query } = parse(info.req.url, true)
    const token = query.token || info.req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      console.log('WebSocket connection rejected: No auth token')
      return false
    }
    
    // In production, verify JWT token here
    // For now, accept all connections
    return true
  }

  /**
   * Setup WebSocket event handling
   */
  setupWebSocketHandling() {
    this.wss.on('connection', (ws, req) => {
      console.log('New WebSocket connection established')
      
      // Parse connection info
      const { query } = parse(req.url, true)
      const auctionId = query.auctionId
      const userId = query.userId || 'anonymous'
      const role = query.role || 'VIEWER'
      
      // Store client data
      this.clientData.set(ws, { userId, role, auctionId })
      this.userConnections.set(userId, ws)
      
      // Add to auction room
      if (auctionId) {
        this.addToAuctionRoom(auctionId, ws)
      }
      
      // Setup message handling
      ws.on('message', (data) => {
        this.handleMessage(ws, data)
      })
      
      // Setup close handling
      ws.on('close', () => {
        this.handleDisconnection(ws)
      })
      
      // Setup error handling
      ws.on('error', (error) => {
        console.error('WebSocket error:', error)
        this.handleDisconnection(ws)
      })
      
      // Send welcome message
      this.sendToClient(ws, {
        type: 'connection:established',
        payload: {
          userId,
          auctionId,
          timestamp: new Date().toISOString()
        }
      })
      
      // If joining an auction, send current state
      if (auctionId) {
        this.sendAuctionState(ws, auctionId)
      }
    })
  }

  /**
   * Add client to auction room
   */
  addToAuctionRoom(auctionId, ws) {
    if (!this.connections.has(auctionId)) {
      this.connections.set(auctionId, new Set())
    }
    this.connections.get(auctionId).add(ws)
    
    console.log(`Client added to auction ${auctionId}. Room size: ${this.connections.get(auctionId).size}`)
  }

  /**
   * Remove client from auction room
   */
  removeFromAuctionRoom(auctionId, ws) {
    const room = this.connections.get(auctionId)
    if (room) {
      room.delete(ws)
      if (room.size === 0) {
        this.connections.delete(auctionId)
      }
      console.log(`Client removed from auction ${auctionId}. Room size: ${room.size}`)
    }
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString())
      const clientData = this.clientData.get(ws)
      
      if (!clientData) {
        this.sendError(ws, 'Client not properly initialized')
        return
      }
      
      console.log(`Received message from ${clientData.userId}:`, message.type)
      
      switch (message.type) {
        case 'bid.place':
          await this.handleBidPlace(ws, message.payload)
          break
          
        case 'bid.cancel':
          await this.handleBidCancel(ws, message.payload)
          break
          
        case 'watchlist.add':
          await this.handleWatchlistAdd(ws, message.payload)
          break
          
        case 'watchlist.remove':
          await this.handleWatchlistRemove(ws, message.payload)
          break
          
        case 'batch':
          await this.handleBatchActions(ws, message.payload)
          break
          
        case 'ping':
          this.sendToClient(ws, { type: 'pong', payload: { timestamp: new Date().toISOString() } })
          break
          
        case 'auction.subscribe':
          this.handleAuctionSubscribe(ws, message.payload)
          break
          
        case 'auction.unsubscribe':
          this.handleAuctionUnsubscribe(ws, message.payload)
          break
          
        default:
          console.log('Unknown message type:', message.type)
          this.sendError(ws, `Unknown message type: ${message.type}`)
      }
    } catch (error) {
      console.error('Error handling message:', error)
      this.sendError(ws, 'Invalid message format')
    }
  }

  /**
   * Handle bid placement
   */
  async handleBidPlace(ws, payload) {
    const clientData = this.clientData.get(ws)
    
    if (clientData.role !== 'TEAM') {
      this.sendError(ws, 'Only team users can place bids')
      return
    }
    
    // In production, this would interact with the auction engine
    console.log('Processing bid:', payload)
    
    // Simulate bid processing
    const bidResult = {
      success: true,
      bid: {
        id: 'bid_' + Date.now(),
        amount: payload.amount,
        timestamp: new Date().toISOString()
      },
      newPrice: payload.amount
    }
    
    // Send confirmation to bidder
    this.sendToClient(ws, {
      type: 'bid:placed',
      payload: bidResult
    })
    
    // Broadcast to auction room
    this.broadcastToAuction(clientData.auctionId, {
      type: 'bid:placed',
      payload: {
        lotId: payload.lotId,
        teamId: clientData.userId,
        amount: payload.amount,
        timestamp: new Date().toISOString()
      }
    }, ws) // Exclude sender
  }

  /**
   * Handle bid cancellation
   */
  async handleBidCancel(ws, payload) {
    const clientData = this.clientData.get(ws)
    
    if (clientData.role !== 'TEAM') {
      this.sendError(ws, 'Only team users can cancel bids')
      return
    }
    
    console.log('Processing bid cancellation:', payload)
    
    // Send confirmation
    this.sendToClient(ws, {
      type: 'bid:cancelled',
      payload: {
        lotId: payload.lotId,
        timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * Handle watchlist operations
   */
  async handleWatchlistAdd(ws, payload) {
    const clientData = this.clientData.get(ws)
    
    if (clientData.role !== 'TEAM') {
      this.sendError(ws, 'Only team users can manage watchlist')
      return
    }
    
    console.log('Adding to watchlist:', payload)
    
    this.sendToClient(ws, {
      type: 'watchlist:added',
      payload: {
        playerId: payload.playerId,
        maxBid: payload.maxBid,
        timestamp: new Date().toISOString()
      }
    })
  }

  async handleWatchlistRemove(ws, payload) {
    const clientData = this.clientData.get(ws)
    
    if (clientData.role !== 'TEAM') {
      this.sendError(ws, 'Only team users can manage watchlist')
      return
    }
    
    console.log('Removing from watchlist:', payload)
    
    this.sendToClient(ws, {
      type: 'watchlist:removed',
      payload: {
        playerId: payload.playerId,
        timestamp: new Date().toISOString()
      }
    })
  }\n\n  /**\n   * Handle batch actions for agent optimization\n   */\n  async handleBatchActions(ws, payload) {\n    const clientData = this.clientData.get(ws)\n    const { batchId, actions } = payload\n    \n    console.log(`Processing batch ${batchId} with ${actions.length} actions`)\n    \n    const results = []\n    \n    for (const action of actions) {\n      try {\n        switch (action.type) {\n          case 'bid.place':\n            await this.handleBidPlace(ws, action.payload)\n            results.push({ action: action.type, success: true })\n            break\n            \n          case 'watchlist.add':\n            await this.handleWatchlistAdd(ws, action.payload)\n            results.push({ action: action.type, success: true })\n            break\n            \n          default:\n            results.push({ action: action.type, success: false, error: 'Unknown action' })\n        }\n      } catch (error) {\n        results.push({ action: action.type, success: false, error: error.message })\n      }\n    }\n    \n    // Send batch results\n    this.sendToClient(ws, {\n      type: 'batch:completed',\n      payload: {\n        batchId,\n        results,\n        timestamp: new Date().toISOString()\n      }\n    })\n  }\n\n  /**\n   * Handle auction subscription\n   */\n  handleAuctionSubscribe(ws, payload) {\n    const { auctionId } = payload\n    const clientData = this.clientData.get(ws)\n    \n    // Remove from current auction if any\n    if (clientData.auctionId) {\n      this.removeFromAuctionRoom(clientData.auctionId, ws)\n    }\n    \n    // Add to new auction\n    clientData.auctionId = auctionId\n    this.addToAuctionRoom(auctionId, ws)\n    \n    // Send current auction state\n    this.sendAuctionState(ws, auctionId)\n  }\n\n  /**\n   * Handle auction unsubscription\n   */\n  handleAuctionUnsubscribe(ws, payload) {\n    const clientData = this.clientData.get(ws)\n    \n    if (clientData.auctionId) {\n      this.removeFromAuctionRoom(clientData.auctionId, ws)\n      clientData.auctionId = null\n    }\n  }\n\n  /**\n   * Send current auction state to client\n   */\n  async sendAuctionState(ws, auctionId) {\n    // In production, this would fetch from auction engine\n    const mockState = {\n      id: auctionId,\n      status: 'IN_PROGRESS',\n      currentLotId: 'lot_123',\n      currentLot: {\n        id: 'lot_123',\n        player: {\n          id: 'player_1',\n          name: 'Virat Kohli',\n          role: 'BATSMAN',\n          country: 'India',\n          basePrice: 2000000\n        },\n        status: 'IN_PROGRESS',\n        currentPrice: 8500000,\n        endsAt: new Date(Date.now() + 25000).toISOString()\n      },\n      timer: {\n        remaining: 25000,\n        endsAt: new Date(Date.now() + 25000).toISOString(),\n        extensions: 0\n      }\n    }\n    \n    this.sendToClient(ws, {\n      type: 'auction:state',\n      payload: mockState\n    })\n  }\n\n  /**\n   * Handle client disconnection\n   */\n  handleDisconnection(ws) {\n    const clientData = this.clientData.get(ws)\n    \n    if (clientData) {\n      console.log(`Client ${clientData.userId} disconnected`)\n      \n      // Remove from auction room\n      if (clientData.auctionId) {\n        this.removeFromAuctionRoom(clientData.auctionId, ws)\n      }\n      \n      // Clean up connections\n      this.userConnections.delete(clientData.userId)\n      this.clientData.delete(ws)\n    }\n  }\n\n  /**\n   * Send message to specific client\n   */\n  sendToClient(ws, message) {\n    if (ws.readyState === WebSocket.OPEN) {\n      ws.send(JSON.stringify({\n        ...message,\n        timestamp: message.timestamp || new Date().toISOString()\n      }))\n    }\n  }\n\n  /**\n   * Send error to client\n   */\n  sendError(ws, error) {\n    this.sendToClient(ws, {\n      type: 'error',\n      payload: {\n        message: error,\n        timestamp: new Date().toISOString()\n      }\n    })\n  }\n\n  /**\n   * Broadcast message to all clients in auction\n   */\n  broadcastToAuction(auctionId, message, excludeWs = null) {\n    const room = this.connections.get(auctionId)\n    if (!room) return\n    \n    room.forEach(ws => {\n      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {\n        this.sendToClient(ws, message)\n      }\n    })\n  }\n\n  /**\n   * Broadcast to all clients\n   */\n  broadcastToAll(message) {\n    this.wss.clients.forEach(ws => {\n      if (ws.readyState === WebSocket.OPEN) {\n        this.sendToClient(ws, message)\n      }\n    })\n  }\n\n  /**\n   * Setup heartbeat mechanism\n   */\n  setupHeartbeat() {\n    const interval = setInterval(() => {\n      this.wss.clients.forEach(ws => {\n        if (ws.readyState === WebSocket.OPEN) {\n          ws.ping()\n        }\n      })\n    }, 30000) // Ping every 30 seconds\n    \n    this.wss.on('close', () => {\n      clearInterval(interval)\n    })\n  }\n\n  /**\n   * Get server statistics\n   */\n  getStats() {\n    return {\n      totalConnections: this.wss.clients.size,\n      activeAuctions: this.connections.size,\n      auctionRooms: Array.from(this.connections.entries()).map(([auctionId, clients]) => ({\n        auctionId,\n        clientCount: clients.size\n      }))\n    }\n  }\n\n  /**\n   * Start the server\n   */\n  start() {\n    this.server.listen(this.port, () => {\n      console.log(`✅ WebSocket server running on port ${this.port}`)\n    })\n  }\n\n  /**\n   * Stop the server\n   */\n  stop() {\n    this.wss.close(() => {\n      this.server.close(() => {\n        console.log('WebSocket server stopped')\n      })\n    })\n  }\n}\n\n// Create and start server if run directly\nif (require.main === module) {\n  const server = new WebSocketAuctionServer(process.env.WEBSOCKET_PORT || 3001)\n  server.start()\n  \n  // Graceful shutdown\n  process.on('SIGTERM', () => {\n    console.log('Received SIGTERM, shutting down gracefully')\n    server.stop()\n  })\n  \n  process.on('SIGINT', () => {\n    console.log('Received SIGINT, shutting down gracefully')\n    server.stop()\n  })\n}\n\nmodule.exports = WebSocketAuctionServer"