/**
 * System Status API Route
 * Real-time system health monitoring for admin dashboard
 */

import { NextRequest } from 'next/server'
import { withAdmin, createApiResponse, handleApiError } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { readFileSync, statSync } from 'fs'
import { join } from 'path'

interface SystemStatus {
  database: {
    status: 'healthy' | 'warning' | 'error'
    responseTime: number
    connections: number
    lastError?: string
  }
  webSocket: {
    status: 'online' | 'offline' | 'unknown'
    connectedClients: number
    serverUptime?: number
    lastError?: string
  }
  application: {
    status: 'healthy' | 'warning' | 'error'
    uptime: number
    memoryUsage: {
      used: number
      total: number
      percentage: number
    }
    cpu: {
      usage: number
    }
  }
  storage: {
    status: 'healthy' | 'warning' | 'error'
    usedSpace: number
    totalSpace: number
    percentage: number
  }
  activeConnections: {
    teams: number
    viewers: number
    admins: number
  }
}

/**
 * GET /api/admin/system-status - Get comprehensive system status (Admin only)
 */
export const GET = withAdmin(async (request: NextRequest, user) => {
  try {
    const startTime = Date.now()
    
    // Test database connectivity and performance
    const dbStatus = await testDatabaseHealth()
    
    // Check WebSocket server status
    const wsStatus = await testWebSocketServer()
    
    // Get application metrics
    const appStatus = getApplicationMetrics()
    
    // Check storage status
    const storageStatus = await getStorageMetrics()
    
    // Get active connections (placeholder - would come from WebSocket server)
    const connectionStats = await getConnectionStats()
    
    const systemStatus: SystemStatus = {
      database: dbStatus,
      webSocket: wsStatus,
      application: appStatus,
      storage: storageStatus,
      activeConnections: connectionStats
    }
    
    const responseTime = Date.now() - startTime
    
    return createApiResponse({
      ...systemStatus,
      meta: {
        checkTime: new Date().toISOString(),
        responseTime,
        overallStatus: calculateOverallStatus(systemStatus)
      }
    })
    
  } catch (error) {
    console.error('Failed to get system status:', error)
    return handleApiError(error)
  }
})

async function testDatabaseHealth() {
  const startTime = Date.now()
  
  try {
    // Test basic connectivity
    await prisma.$queryRaw`SELECT 1`
    
    // Get connection info (basic health check)
    const responseTime = Date.now() - startTime
    
    return {
      status: 'healthy' as const,
      responseTime,
      connections: 1, // Basic check - in production, you'd query actual connection pool
    }
  } catch (error) {
    return {
      status: 'error' as const,
      responseTime: Date.now() - startTime,
      connections: 0,
      lastError: error instanceof Error ? error.message : 'Unknown database error'
    }
  }
}

async function testWebSocketServer() {
  try {
    // Try to connect to WebSocket server
    const wsUrls = [
      'ws://localhost:8080',
      'ws://localhost:3001'
    ]
    
    for (const url of wsUrls) {
      try {
        // In a real implementation, you'd make an HTTP request to a health endpoint
        // or maintain a registry of WebSocket server status
        const response = await fetch(url.replace('ws://', 'http://') + '/health', {
          method: 'GET',
          signal: AbortSignal.timeout(2000)
        })
        
        if (response.ok) {
          const data = await response.json()
          return {
            status: 'online' as const,
            connectedClients: data.connectedClients || 0,
            serverUptime: data.uptime || 0
          }
        }
      } catch (error) {
        // Continue to next URL
        continue
      }
    }
    
    // If no WebSocket server responds, return offline status
    return {
      status: 'offline' as const,
      connectedClients: 0,
      lastError: 'WebSocket server not responding'
    }
    
  } catch (error) {
    return {
      status: 'unknown' as const,
      connectedClients: 0,
      lastError: error instanceof Error ? error.message : 'WebSocket check failed'
    }
  }
}

function getApplicationMetrics() {
  try {
    const memUsage = process.memoryUsage()
    const totalMemory = memUsage.heapTotal + memUsage.external
    const usedMemory = memUsage.heapUsed
    
    return {
      status: 'healthy' as const,
      uptime: process.uptime(),
      memoryUsage: {
        used: usedMemory,
        total: totalMemory,
        percentage: Math.round((usedMemory / totalMemory) * 100)
      },
      cpu: {
        usage: 0 // Placeholder - would need additional monitoring for real CPU usage
      }
    }
  } catch (error) {
    return {
      status: 'error' as const,
      uptime: 0,
      memoryUsage: {
        used: 0,
        total: 0,
        percentage: 0
      },
      cpu: {
        usage: 0
      }
    }
  }
}

async function getStorageMetrics() {
  try {
    // Check database file size (for SQLite) or general storage
    const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './prisma/dev.db'
    
    try {
      const stats = statSync(dbPath)
      const fileSize = stats.size
      
      // Estimate available space (simplified)
      const totalSpace = 10 * 1024 * 1024 * 1024 // 10GB estimate
      const usedSpace = fileSize
      const percentage = (usedSpace / totalSpace) * 100
      
      return {
        status: percentage > 90 ? 'error' as const : 
                percentage > 75 ? 'warning' as const : 'healthy' as const,
        usedSpace,
        totalSpace,
        percentage: Math.round(percentage * 100) / 100
      }
    } catch (error) {
      // If can't access file, return basic metrics
      return {
        status: 'healthy' as const,
        usedSpace: 0,
        totalSpace: 1024 * 1024 * 1024, // 1GB default
        percentage: 0
      }
    }
  } catch (error) {
    return {
      status: 'error' as const,
      usedSpace: 0,
      totalSpace: 0,
      percentage: 0
    }
  }
}

async function getConnectionStats() {
  try {
    // In a real implementation, this would query the WebSocket server
    // For now, return placeholder data
    return {
      teams: 0,
      viewers: 0,
      admins: 1 // Current admin user
    }
  } catch (error) {
    return {
      teams: 0,
      viewers: 0,
      admins: 0
    }
  }
}

function calculateOverallStatus(status: SystemStatus): 'healthy' | 'warning' | 'error' {
  const statuses = [
    status.database.status,
    status.application.status,
    status.storage.status
  ]
  
  if (statuses.includes('error')) return 'error'
  if (statuses.includes('warning')) return 'warning'
  return 'healthy'
}