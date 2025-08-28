/**
 * WebSocket Server for Real-time Auction Communication
 * Handles live bidding, event broadcasting, and agent interactions
 */

const WebSocket = require('ws')
const { createServer } = require('http')
const { parse } = require('url')

// WebSocket Auction Server
class WebSocketAuctionServer {
  constructor(port = 3001) {
    this.port = port
    this.server = createServer()
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
          
        case 'ping':
          this.sendToClient(ws, { type: 'pong', payload: { timestamp: new Date().toISOString() } })
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
   * Send current auction state to client
   */
  async sendAuctionState(ws, auctionId) {
    const mockState = {
      id: auctionId,
      status: 'IN_PROGRESS',
      currentLotId: 'lot_123',
      currentLot: {
        id: 'lot_123',
        player: {
          id: 'player_1',
          name: 'Virat Kohli',
          role: 'BATSMAN',
          country: 'India',
          basePrice: 2000000,
          isOverseas: false,
          stats: {
            matches: 200,
            runs: 6000,
            average: '45.2',
            strikeRate: '131.5'
          }
        },
        status: 'IN_PROGRESS',
        currentPrice: 8500000,
        endsAt: new Date(Date.now() + 25000).toISOString()
      },
      timer: {
        remaining: 25000,
        endsAt: new Date(Date.now() + 25000).toISOString(),
        extensions: 0
      }
    }
    
    this.sendToClient(ws, {
      type: 'auction:state',
      payload: mockState
    })
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(ws) {
    const clientData = this.clientData.get(ws)
    
    if (clientData) {
      console.log(`Client ${clientData.userId} disconnected`)
      
      // Remove from auction room
      if (clientData.auctionId) {
        this.removeFromAuctionRoom(clientData.auctionId, ws)
      }
      
      // Clean up connections
      this.userConnections.delete(clientData.userId)
      this.clientData.delete(ws)
    }
  }

  /**
   * Send message to specific client
   */
  sendToClient(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        ...message,
        timestamp: message.timestamp || new Date().toISOString()
      }))
    }
  }

  /**
   * Send error to client
   */
  sendError(ws, error) {
    this.sendToClient(ws, {
      type: 'error',
      payload: {
        message: error,
        timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * Broadcast message to all clients in auction
   */
  broadcastToAuction(auctionId, message, excludeWs = null) {
    const room = this.connections.get(auctionId)
    if (!room) return
    
    room.forEach(ws => {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        this.sendToClient(ws, message)
      }
    })
  }

  /**
   * Setup heartbeat mechanism
   */
  setupHeartbeat() {
    const interval = setInterval(() => {
      this.wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping()
        }
      })
    }, 30000) // Ping every 30 seconds
    
    this.wss.on('close', () => {
      clearInterval(interval)
    })
  }

  /**
   * Start the server
   */
  start() {
    this.server.listen(this.port, () => {
      console.log(`✅ WebSocket server running on port ${this.port}`)
    })
  }

  /**
   * Stop the server
   */
  stop() {
    this.wss.close(() => {
      this.server.close(() => {
        console.log('WebSocket server stopped')
      })
    })
  }
}

// Create and start server if run directly
if (require.main === module) {
  const server = new WebSocketAuctionServer(process.env.WEBSOCKET_PORT || 3001)
  server.start()
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully')
    server.stop()
  })
  
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully')
    server.stop()
  })
}

module.exports = WebSocketAuctionServer