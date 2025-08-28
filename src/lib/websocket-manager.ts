/**
 * WebSocket Manager Service
 * Backend-mediated WebSocket connection management with authentication
 */

import WebSocket from 'ws'
import { EventEmitter } from 'events'
import { config, getWebSocketUrl } from './config'
import { getAuthenticatedUser, verifyTeamAccess } from './session'
import { prisma } from './prisma'
import { AuctionState, AuctionEvent, UserRole } from '@/types/next-auth'

export interface BackendConnection {
  id: string
  userId: string
  role: UserRole
  auctionId: string
  socket: WebSocket
  lastPing: Date
  sseClients: Set<ReadableStreamDefaultController>
  metadata: {
    teamId?: string
    teamName?: string
    userAgent?: string
    ipAddress?: string
  }
}

export interface ConnectionResult {
  success: boolean
  connectionId?: string
  error?: string
  data?: any
}

export interface ValidationResult {
  valid: boolean
  user?: any
  token?: string
  error?: string
}

class WebSocketManager extends EventEmitter {
  private connections = new Map<string, BackendConnection>()
  private userConnections = new Map<string, Set<string>>()
  private auctionConnections = new Map<string, Set<string>>()
  private reconnectAttempts = new Map<string, number>()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    super()
    this.setMaxListeners(1000)
    this.startCleanupTimer()
  }

  /**
   * Establish a backend-mediated WebSocket connection
   */
  async establishConnection(
    userId: string, 
    role: UserRole, 
    auctionId: string,
    metadata: Partial<BackendConnection['metadata']> = {}
  ): Promise<ConnectionResult> {
    try {
      // Validate user and session
      const validation = await this.validateUser(userId, role)
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      // Check connection limits
      const userConnectionCount = this.userConnections.get(userId)?.size || 0
      if (userConnectionCount >= config.limits.maxPerUser) {
        return { 
          success: false, 
          error: `Maximum connections per user exceeded (${config.limits.maxPerUser})` 
        }
      }

      if (this.connections.size >= config.limits.maxConnections) {
        return { 
          success: false, 
          error: `Maximum total connections exceeded (${config.limits.maxConnections})` 
        }
      }

      // Create WebSocket connection to server
      const wsUrl = getWebSocketUrl()
      const socket = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${validation.token}`,
          'X-User-Id': userId,
          'X-Role': role,
          'X-Auction-Id': auctionId
        }
      })

      const connectionId = this.generateConnectionId()
      const connection: BackendConnection = {
        id: connectionId,
        userId,
        role,
        auctionId,
        socket,
        lastPing: new Date(),
        sseClients: new Set(),
        metadata: {
          teamId: validation.user?.teamId,
          teamName: validation.user?.team?.name,
          ...metadata
        }
      }

      // Setup event handlers
      socket.onopen = () => this.handleConnectionOpen(connection)
      socket.onmessage = (event) => this.handleMessage(connection, event)
      socket.onclose = () => this.handleConnectionClose(connection)
      socket.onerror = (error) => this.handleConnectionError(connection, error)

      // Wait for connection to open
      await this.waitForConnection(socket)

      // Store connection
      this.connections.set(connectionId, connection)
      this.addUserConnection(userId, connectionId)
      this.addAuctionConnection(auctionId, connectionId)

      if (config.features.enableDebugLogs) {
        console.log(`✅ WebSocket connection established: ${connectionId} (User: ${userId}, Role: ${role})`)
      }

      return { 
        success: true, 
        connectionId,
        data: {
          userId,
          role,
          auctionId,
          metadata: connection.metadata
        }
      }
    } catch (error) {
      console.error('❌ WebSocket connection error:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      }
    }
  }

  /**
   * Close a WebSocket connection
   */
  async closeConnection(connectionId: string): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    try {
      // Close SSE clients
      connection.sseClients.forEach(controller => {
        try {
          controller.close()
        } catch (error) {
          // Ignore close errors
        }
      })

      // Close WebSocket
      if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.close()
      }

      // Remove from tracking
      this.connections.delete(connectionId)
      this.removeUserConnection(connection.userId, connectionId)
      this.removeAuctionConnection(connection.auctionId, connectionId)

      if (config.features.enableDebugLogs) {
        console.log(`🔌 WebSocket connection closed: ${connectionId}`)
      }
    } catch (error) {
      console.error('Error closing connection:', error)
    }
  }

  /**
   * Add SSE client to connection
   */
  async addSSEClient(connectionId: string, controller: ReadableStreamDefaultController): Promise<boolean> {
    const connection = this.connections.get(connectionId)
    if (!connection) return false

    connection.sseClients.add(controller)
    connection.lastPing = new Date()

    if (config.features.enableDebugLogs) {
      console.log(`📡 SSE client added to connection: ${connectionId}`)
    }

    return true
  }

  /**
   * Remove SSE client from connection
   */
  async removeSSEClient(connectionId: string, controller: ReadableStreamDefaultController): Promise<void> {
    const connection = this.connections.get(connectionId)
    if (!connection) return

    connection.sseClients.delete(controller)

    // If no SSE clients remain, consider closing the connection
    if (connection.sseClients.size === 0) {
      setTimeout(() => {
        const conn = this.connections.get(connectionId)
        if (conn && conn.sseClients.size === 0) {
          this.closeConnection(connectionId)
        }
      }, 30000) // Grace period of 30 seconds
    }
  }

  /**
   * Send event to specific connection via SSE
   */
  async sendToConnection(connectionId: string, event: AuctionEvent): Promise<boolean> {
    const connection = this.connections.get(connectionId)
    if (!connection || connection.sseClients.size === 0) return false

    const eventData = `data: ${JSON.stringify(event)}\n\n`
    const encoder = new TextEncoder()

    let successCount = 0
    connection.sseClients.forEach(controller => {
      try {
        controller.enqueue(encoder.encode(eventData))
        successCount++
      } catch (error) {
        // Remove failed client
        connection.sseClients.delete(controller)
      }
    })

    return successCount > 0
  }

  /**
   * Broadcast event to all connections in an auction
   */
  async broadcastToAuction(auctionId: string, event: AuctionEvent): Promise<number> {
    const connectionIds = this.auctionConnections.get(auctionId)
    if (!connectionIds || connectionIds.size === 0) return 0

    let successCount = 0
    for (const connectionId of connectionIds) {
      const sent = await this.sendToConnection(connectionId, event)
      if (sent) successCount++
    }

    if (config.features.enableDebugLogs) {
      console.log(`📢 Broadcast to auction ${auctionId}: ${successCount}/${connectionIds.size} connections`)
    }

    return successCount
  }

  /**
   * Get connection by ID
   */
  getConnection(connectionId: string): BackendConnection | undefined {
    return this.connections.get(connectionId)
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      totalConnections: this.connections.size,
      userConnections: this.userConnections.size,
      auctionConnections: this.auctionConnections.size,
      connectionsByRole: this.getConnectionsByRole(),
      connectionsByAuction: this.getConnectionsByAuction()
    }
  }

  // Private methods

  private async validateUser(userId: string, role: UserRole): Promise<ValidationResult> {
    try {
      // Get user from database with enhanced validation
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { team: true }
      })

      if (!user) {
        return { valid: false, error: 'User not found' }
      }

      if (user.role !== role) {
        return { valid: false, error: 'Role mismatch' }
      }

      // Generate or validate token (simplified for now)
      const token = `backend_token_${userId}_${Date.now()}`

      return { 
        valid: true, 
        user, 
        token 
      }
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Validation failed' 
      }
    }
  }

  private async waitForConnection(socket: WebSocket): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'))
      }, config.websocket.timeout)

      socket.onopen = () => {
        clearTimeout(timeout)
        resolve()
      }

      socket.onerror = (error) => {
        clearTimeout(timeout)
        reject(error)
      }
    })
  }

  private handleConnectionOpen(connection: BackendConnection): void {
    if (config.features.enableDebugLogs) {
      console.log(`🟢 WebSocket opened: ${connection.id}`)
    }
    
    // Send initial subscription message
    connection.socket.send(JSON.stringify({
      type: 'auction:subscribe',
      payload: {
        auctionId: connection.auctionId,
        userId: connection.userId,
        role: connection.role
      }
    }))
  }

  private handleMessage(connection: BackendConnection, event: WebSocket.MessageEvent): void {
    try {
      const message = JSON.parse(event.data.toString())
      
      // Forward auction events to SSE clients
      if (message.type?.startsWith('auction:') || message.type?.startsWith('bid:')) {
        this.sendToConnection(connection.id, message)
      }

      // Update last ping
      connection.lastPing = new Date()

      if (config.features.enableDebugLogs) {
        console.log(`📨 Message from ${connection.id}: ${message.type}`)
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error)
    }
  }

  private handleConnectionClose(connection: BackendConnection): void {
    if (config.features.enableDebugLogs) {
      console.log(`🔴 WebSocket closed: ${connection.id}`)
    }
    
    // Schedule reconnection if needed
    this.scheduleReconnection(connection)
  }

  private handleConnectionError(connection: BackendConnection, error: any): void {
    console.error(`❌ WebSocket error for ${connection.id}:`, error)
    
    // Close the connection
    this.closeConnection(connection.id)
  }

  private scheduleReconnection(connection: BackendConnection): void {
    const attempts = this.reconnectAttempts.get(connection.id) || 0
    
    if (attempts >= config.websocket.maxRetries) {
      console.log(`⏰ Max reconnection attempts reached for ${connection.id}`)
      return
    }

    const delay = Math.min(
      config.websocket.reconnectInterval * Math.pow(2, attempts), 
      30000 // Max 30 seconds
    )

    setTimeout(async () => {
      try {
        await this.establishConnection(
          connection.userId,
          connection.role,
          connection.auctionId,
          connection.metadata
        )
        this.reconnectAttempts.delete(connection.id)
      } catch (error) {
        this.reconnectAttempts.set(connection.id, attempts + 1)
        console.error(`Failed to reconnect ${connection.id}:`, error)
      }
    }, delay)
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private addUserConnection(userId: string, connectionId: string): void {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set())
    }
    this.userConnections.get(userId)!.add(connectionId)
  }

  private removeUserConnection(userId: string, connectionId: string): void {
    const connections = this.userConnections.get(userId)
    if (connections) {
      connections.delete(connectionId)
      if (connections.size === 0) {
        this.userConnections.delete(userId)
      }
    }
  }

  private addAuctionConnection(auctionId: string, connectionId: string): void {
    if (!this.auctionConnections.has(auctionId)) {
      this.auctionConnections.set(auctionId, new Set())
    }
    this.auctionConnections.get(auctionId)!.add(connectionId)
  }

  private removeAuctionConnection(auctionId: string, connectionId: string): void {
    const connections = this.auctionConnections.get(auctionId)
    if (connections) {
      connections.delete(connectionId)
      if (connections.size === 0) {
        this.auctionConnections.delete(auctionId)
      }
    }
  }

  private getConnectionsByRole() {
    const roles: Record<string, number> = {}
    this.connections.forEach(conn => {
      roles[conn.role] = (roles[conn.role] || 0) + 1
    })
    return roles
  }

  private getConnectionsByAuction() {
    const auctions: Record<string, number> = {}
    this.auctionConnections.forEach((connections, auctionId) => {
      auctions[auctionId] = connections.size
    })
    return auctions
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleConnections()
    }, 60000) // Cleanup every minute
  }

  private async cleanupStaleConnections(): Promise<void> {
    const now = new Date()
    const staleThreshold = config.websocket.timeout

    for (const [connectionId, connection] of this.connections) {
      const timeSinceLastPing = now.getTime() - connection.lastPing.getTime()
      
      if (timeSinceLastPing > staleThreshold) {
        if (config.features.enableDebugLogs) {
          console.log(`🧹 Cleaning up stale connection: ${connectionId}`)
        }
        await this.closeConnection(connectionId)
      }
    }
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    // Close all connections
    const connectionIds = Array.from(this.connections.keys())
    await Promise.all(connectionIds.map(id => this.closeConnection(id)))
  }
}

// Singleton instance
export const wsManager = new WebSocketManager()

// Cleanup on process exit
process.on('exit', () => {
  wsManager.shutdown()
})

process.on('SIGINT', () => {
  wsManager.shutdown()
  process.exit(0)
})

process.on('SIGTERM', () => {
  wsManager.shutdown()
  process.exit(0)
})