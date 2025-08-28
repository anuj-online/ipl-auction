/**
 * Frontend Auction Connection Service
 * SSE-based real-time communication through backend-mediated connections
 */

export interface AuctionEvent {
  type: string
  payload: any
  timestamp?: string
  connectionId?: string
}

export interface ConnectionConfig {
  auctionId: string
  onEvent?: (event: AuctionEvent) => void
  onError?: (error: string) => void
  onConnect?: () => void
  onDisconnect?: () => void
  onReconnect?: (attempt: number) => void
}

export interface ConnectionStatus {
  connected: boolean
  connectionId: string | null
  lastEvent?: string
  reconnectAttempts: number
  error?: string
}

export interface BidRequest {
  lotId: string
  amount: number
  metadata?: any
}

export interface BidResult {
  success: boolean
  error?: string
  bidId?: string
  timestamp?: string
}

class AuctionConnectionService {
  private connectionId: string | null = null
  private eventSource: EventSource | null = null
  private isConnected = false
  private config: ConnectionConfig | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private heartbeatTimer: NodeJS.Timeout | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectInterval = 5000
  private lastEventTime: Date | null = null
  private connectionPromise: Promise<boolean> | null = null

  /**
   * Connect to auction with backend-mediated WebSocket
   */
  async connect(config: ConnectionConfig): Promise<boolean> {
    // Prevent multiple simultaneous connection attempts
    if (this.connectionPromise) {
      return this.connectionPromise
    }

    this.config = config
    this.reconnectAttempts = 0

    this.connectionPromise = this._attemptConnection()
    const result = await this.connectionPromise
    this.connectionPromise = null

    return result
  }

  /**
   * Send a bid through the backend API
   */
  async sendBid(bidRequest: BidRequest): Promise<BidResult> {
    if (!this.isConnected || !this.connectionId) {
      return { success: false, error: 'Not connected to auction' }
    }

    try {
      const response = await fetch('/api/auction/bid', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Connection-Id': this.connectionId
        },
        body: JSON.stringify({ 
          ...bidRequest,
          connectionId: this.connectionId 
        })
      })

      const data = await response.json()

      if (!response.ok) {
        return { 
          success: false, 
          error: data.error || `HTTP ${response.status}` 
        }
      }

      return { 
        success: data.success, 
        error: data.error,
        bidId: data.data?.bidId,
        timestamp: data.timestamp
      }
    } catch (error) {
      console.error('❌ Bid request failed:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Bid request failed' 
      }
    }
  }

  /**
   * Send admin control command
   */
  async sendAdminControl(action: string, params: any = {}): Promise<BidResult> {
    if (!this.isConnected || !this.connectionId) {
      return { success: false, error: 'Not connected to auction' }
    }

    try {
      const response = await fetch('/api/auction/control', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Connection-Id': this.connectionId
        },
        body: JSON.stringify({ 
          action,
          ...params,
          connectionId: this.connectionId 
        })
      })

      const data = await response.json()

      if (!response.ok) {
        return { 
          success: false, 
          error: data.error || `HTTP ${response.status}` 
        }
      }

      return { 
        success: data.success, 
        error: data.error,
        timestamp: data.timestamp
      }
    } catch (error) {
      console.error('❌ Admin control failed:', error)
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Control command failed' 
      }
    }
  }

  /**
   * Disconnect from auction
   */
  async disconnect(): Promise<void> {
    this._clearTimers()

    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }

    if (this.connectionId) {
      try {
        await fetch('/api/auction/connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'disconnect',
            connectionId: this.connectionId,
            auctionId: this.config?.auctionId
          })
        })
      } catch (error) {
        console.error('Error disconnecting:', error)
      }
      this.connectionId = null
    }

    this.isConnected = false
    this.config?.onDisconnect?.()
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return {
      connected: this.isConnected,
      connectionId: this.connectionId,
      lastEvent: this.lastEventTime?.toISOString(),
      reconnectAttempts: this.reconnectAttempts,
      error: this.isConnected ? undefined : 'Disconnected'
    }
  }

  /**
   * Check if connected
   */
  isConnectionActive(): boolean {
    return this.isConnected && this.connectionId !== null
  }

  // Private methods

  private async _attemptConnection(): Promise<boolean> {
    if (!this.config) return false

    try {
      // Establish backend connection
      const response = await fetch('/api/auction/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'connect',
          auctionId: this.config.auctionId,
          metadata: {
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      this.connectionId = data.data.connectionId
      const sseEndpoint = data.data.sseEndpoint

      // Subscribe to SSE events
      await this._setupSSEConnection(sseEndpoint)

      return true
    } catch (error) {
      console.error('❌ Connection attempt failed:', error)
      this.config?.onError?.(error instanceof Error ? error.message : 'Connection failed')
      this._scheduleReconnect()
      return false
    }
  }

  private async _setupSSEConnection(sseEndpoint: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(sseEndpoint)
      
      const connectionTimeout = setTimeout(() => {
        eventSource.close()
        reject(new Error('SSE connection timeout'))
      }, 10000) // 10 second timeout

      eventSource.onopen = () => {
        clearTimeout(connectionTimeout)
        this.eventSource = eventSource
        this.isConnected = true
        this.reconnectAttempts = 0
        this.config?.onConnect?.()
        this._startHeartbeatMonitor()
        resolve()
      }

      eventSource.onmessage = (event) => {
        this._handleSSEMessage(event)
      }

      eventSource.onerror = (error) => {
        clearTimeout(connectionTimeout)
        console.error('❌ SSE connection error:', error)
        this.isConnected = false
        this.config?.onDisconnect?.()
        this._scheduleReconnect()
        
        if (this.eventSource === eventSource) {
          reject(error)
        }
      }
    })
  }

  private _handleSSEMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data)
      this.lastEventTime = new Date()

      // Handle heartbeat
      if (data.type === 'heartbeat') {
        return // Just update lastEventTime
      }

      // Handle connection established
      if (data.type === 'connection:established') {
        console.log('✅ SSE connection established:', data.payload)
        return
      }

      // Forward event to application
      this.config?.onEvent?.(data)
    } catch (error) {
      console.error('❌ Error parsing SSE message:', error)
    }
  }

  private _scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      const error = `Max reconnection attempts reached (${this.maxReconnectAttempts})`
      console.error('❌ ' + error)
      this.config?.onError?.(error)
      return
    }

    const delay = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempts), 
      30000 // Max 30 seconds
    )

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++
      this.config?.onReconnect?.(this.reconnectAttempts)
      
      console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
      
      const success = await this._attemptConnection()
      if (!success) {
        // _attemptConnection will schedule the next reconnect
      }
    }, delay)
  }

  private _startHeartbeatMonitor(): void {
    this.heartbeatTimer = setInterval(() => {
      if (!this.lastEventTime) return

      const timeSinceLastEvent = Date.now() - this.lastEventTime.getTime()
      if (timeSinceLastEvent > 60000) { // 60 seconds without any event
        console.warn('⚠️ No heartbeat received, connection may be stale')
        this._triggerReconnect()
      }
    }, 30000) // Check every 30 seconds
  }

  private _triggerReconnect(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
    this.isConnected = false
    this.config?.onDisconnect?.()
    this._scheduleReconnect()
  }

  private _clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }
}

// Singleton instance
export const auctionConnection = new AuctionConnectionService()

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    auctionConnection.disconnect()
  })

  // Cleanup on visibility change (when tab becomes hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Don't disconnect immediately, just note the state
      console.log('📱 Tab hidden, maintaining connection')
    } else {
      // Tab visible again, check connection health
      if (!auctionConnection.isConnectionActive()) {
        console.log('📱 Tab visible, connection lost - attempting reconnect')
        // The service will handle reconnection automatically
      }
    }
  })
}

export default auctionConnection