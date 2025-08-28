/**
 * Centralized Configuration Module
 * Consolidates all port and WebSocket settings from environment variables
 */

export interface AppConfig {
  ports: {
    app: number
    websocket: number
    sse: number
  }
  websocket: {
    host: string
    timeout: number
    reconnectInterval: number
    maxRetries: number
    heartbeatInterval: number
    connectionTimeout: number
  }
  limits: {
    maxConnections: number
    maxPerUser: number
  }
  auction: {
    defaultLotDuration: number
    softCloseThreshold: number
    softCloseExtension: number
    maxExtensions: number
  }
  security: {
    jwtSecret: string
    bcryptRounds: number
  }
  features: {
    enableDebugLogs: boolean
    enableMockData: boolean
  }
}

function getNumberEnv(key: string, defaultValue: number): number {
  const value = process.env[key]
  if (!value) return defaultValue
  const parsed = parseInt(value, 10)
  return isNaN(parsed) ? defaultValue : parsed
}

function getBooleanEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key]
  if (!value) return defaultValue
  return value.toLowerCase() === 'true'
}

function getStringEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue
}

/**
 * Application configuration loaded from environment variables
 */
export const config: AppConfig = {
  ports: {
    // Main Next.js application port - uses 3002 if 3000 is occupied
    app: getNumberEnv('NEXT_APP_PORT', getNumberEnv('PORT', 3002)),
    // WebSocket server port
    websocket: getNumberEnv('WEBSOCKET_PORT', 3003),
    // Server-Sent Events port (for backend-mediated connections)
    sse: getNumberEnv('SSE_PORT', 3004)
  },
  
  websocket: {
    // WebSocket server host
    host: getStringEnv('WEBSOCKET_HOST', 'localhost'),
    // Connection timeout in milliseconds
    timeout: getNumberEnv('WS_CONNECTION_TIMEOUT', 60000),
    // Reconnection interval in milliseconds
    reconnectInterval: getNumberEnv('WS_RECONNECT_INTERVAL', 5000),
    // Maximum reconnection attempts
    maxRetries: getNumberEnv('WS_MAX_RETRIES', 5),
    // Heartbeat interval in milliseconds
    heartbeatInterval: getNumberEnv('WS_HEARTBEAT_INTERVAL', 30000),
    // Connection timeout for establishing connections
    connectionTimeout: getNumberEnv('WS_CONNECTION_TIMEOUT', 60000)
  },
  
  limits: {
    // Maximum total WebSocket connections
    maxConnections: getNumberEnv('MAX_WEBSOCKET_CONNECTIONS', 1000),
    // Maximum connections per user
    maxPerUser: getNumberEnv('MAX_CONNECTIONS_PER_USER', 3)
  },
  
  auction: {
    // Default lot duration in milliseconds
    defaultLotDuration: getNumberEnv('DEFAULT_LOT_DURATION', 30000),
    // Soft close threshold in milliseconds
    softCloseThreshold: getNumberEnv('SOFT_CLOSE_THRESHOLD', 5000),
    // Soft close extension in milliseconds
    softCloseExtension: getNumberEnv('SOFT_CLOSE_EXTENSION', 10000),
    // Maximum soft close extensions
    maxExtensions: getNumberEnv('MAX_EXTENSIONS', 3)
  },
  
  security: {
    // JWT secret for token signing
    jwtSecret: getStringEnv('JWT_SECRET', 'development-jwt-secret'),
    // BCrypt rounds for password hashing
    bcryptRounds: getNumberEnv('BCRYPT_ROUNDS', 12)
  },
  
  features: {
    // Enable debug logging
    enableDebugLogs: getBooleanEnv('ENABLE_DEBUG_LOGS', process.env.NODE_ENV === 'development'),
    // Enable mock data for development
    enableMockData: getBooleanEnv('ENABLE_MOCK_DATA', process.env.NODE_ENV === 'development')
  }
}

/**
 * Validate configuration on import
 */
function validateConfig() {
  const errors: string[] = []
  
  if (config.ports.app === config.ports.websocket) {
    errors.push('App port and WebSocket port cannot be the same')
  }
  
  if (config.ports.app === config.ports.sse) {
    errors.push('App port and SSE port cannot be the same')
  }
  
  if (config.ports.websocket === config.ports.sse) {
    errors.push('WebSocket port and SSE port cannot be the same')
  }
  
  if (config.websocket.timeout < 1000) {
    errors.push('WebSocket timeout must be at least 1000ms')
  }
  
  if (config.websocket.reconnectInterval < 1000) {
    errors.push('WebSocket reconnect interval must be at least 1000ms')
  }
  
  if (config.limits.maxPerUser > config.limits.maxConnections) {
    errors.push('Max connections per user cannot exceed total max connections')
  }
  
  if (errors.length > 0) {
    console.error('❌ Configuration validation errors:')
    errors.forEach(error => console.error(`  - ${error}`))
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid configuration detected')
    }
  }
}

// Validate configuration on module load
validateConfig()

/**
 * Get WebSocket server URL
 */
export function getWebSocketUrl(): string {
  return `ws://${config.websocket.host}:${config.ports.websocket}`
}

/**
 * Get SSE endpoint URL for a connection
 */
export function getSSEUrl(connectionId: string): string {
  return `/api/auction/events/${connectionId}`
}

/**
 * Log configuration on startup (development only)
 */
if (config.features.enableDebugLogs) {
  console.log('🔧 Application Configuration:')
  console.log(`  📱 App Port: ${config.ports.app}`)
  console.log(`  🔌 WebSocket Port: ${config.ports.websocket}`)
  console.log(`  📡 SSE Port: ${config.ports.sse}`)
  console.log(`  🌐 WebSocket Host: ${config.websocket.host}`)
  console.log(`  ⏱️  Connection Timeout: ${config.websocket.timeout}ms`)
  console.log(`  🔄 Reconnect Interval: ${config.websocket.reconnectInterval}ms`)
  console.log(`  📊 Max Connections: ${config.limits.maxConnections}`)
  console.log(`  👤 Max Per User: ${config.limits.maxPerUser}`)
}