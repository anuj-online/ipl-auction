/**
 * WebSocket Server for Real-time Auction Communication
 * Handles live bidding, event broadcasting, and agent interactions
 */

const WebSocket = require('ws')
const { createServer } = require('http')
const { parse } = require('url')
const fs = require('fs')
const path = require('path')

// Import auction engine - In production this would be properly compiled TypeScript
// For now, we'll create a simple HTTP client to communicate with the Next.js API
const http = require('http')
const https = require('https')

/**
 * API Client for communicating with Next.js backend
 */
class ApiClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl
  }

  async makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const url = `${this.baseUrl}${path}`
      const requestOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      }

      const req = (url.startsWith('https') ? https : http).request(url, requestOptions, (res) => {
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try {
            const result = JSON.parse(data)
            resolve(result)
          } catch (e) {
            reject(new Error('Invalid JSON response'))
          }
        })
      })

      req.on('error', reject)
      
      if (options.body) {
        req.write(JSON.stringify(options.body))
      }
      
      req.end()
    })
  }

  async placeBid(lotId, teamId, amount, authToken) {
    return this.makeRequest('/api/bids', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: { lotId, amount }
    })
  }

  async getAuctionState(auctionId, authToken) {
    return this.makeRequest(`/api/auctions/current?auctionId=${auctionId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    })
  }
}

// WebSocket Auction Server
class WebSocketAuctionServer {
  constructor(port = 3001) {
    this.port = port
    this.server = createServer()
    this.wss = new WebSocket.Server({ 
      server: this.server,
      verifyClient: this.verifyClient.bind(this)
    })
    
    // API client for communicating with Next.js backend
    this.apiClient = new ApiClient()
    
    // Store client connections by auction and user
    this.connections = new Map() // auctionId -> Set<WebSocket>
    this.userConnections = new Map() // userId -> WebSocket
    this.clientData = new Map() // WebSocket -> { userId, role, auctionId, authToken }
    
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
      const authToken = query.token || req.headers.authorization?.replace('Bearer ', '')
      
      // Store client data
      this.clientData.set(ws, { userId, role, auctionId, authToken })
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
    
    if (!clientData.authToken) {
      this.sendError(ws, 'Authentication required')
      return
    }
    
    console.log('Processing bid via API:', payload)
    
    try {
      // Place bid via API
      const result = await this.apiClient.placeBid(
        payload.lotId, 
        clientData.userId, 
        payload.amount,
        clientData.authToken
      )
      
      if (result.success) {
        // Send confirmation to bidder
        this.sendToClient(ws, {
          type: 'bid:placed',
          payload: result.data
        })
        
        // Broadcast to auction room
        this.broadcastToAuction(clientData.auctionId, {
          type: 'bid:update',
          payload: {
            lotId: payload.lotId,
            teamId: clientData.userId,
            amount: payload.amount,
            timestamp: new Date().toISOString()
          }
        }, ws) // Exclude sender
      } else {
        // Send error to bidder
        this.sendError(ws, result.error || 'Bid failed')
      }
    } catch (error) {
      console.error('Bid placement error:', error)
      this.sendError(ws, 'Internal server error')
    }
  }

  /**
   * Send current auction state to client
   */
  async sendAuctionState(ws, auctionId) {
    const clientData = this.clientData.get(ws)
    
    if (!clientData.authToken) {
      this.sendError(ws, 'Authentication required for auction state')
      return
    }
    
    try {
      // Get current auction state from API
      const stateResult = await this.apiClient.getAuctionState(auctionId, clientData.authToken)
      
      if (stateResult.success) {
        this.sendToClient(ws, {
          type: 'auction:state',
          payload: stateResult.data
        })
      } else {
        console.error('Failed to get auction state:', stateResult.error)
        // Send minimal state as fallback
        this.sendToClient(ws, {
          type: 'auction:state',
          payload: {
            id: auctionId,
            status: 'NOT_STARTED',
            message: 'Unable to load auction state'
          }
        })
      }
    } catch (error) {
      console.error('Error fetching auction state:', error)
      this.sendError(ws, 'Failed to load auction state')
    }
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