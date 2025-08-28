/**
 * Auction Connection API
 * Backend-mediated WebSocket connection management
 */

import { NextRequest } from 'next/server'
import { withAuth, createApiResponse, handleApiError, parseJsonBody } from '@/lib/session'
import { wsManager } from '@/lib/websocket-manager'
import { config } from '@/lib/config'
import { validateData } from '@/lib/validations'
import { z } from 'zod'

const connectionRequestSchema = z.object({
  action: z.enum(['connect', 'disconnect']),
  auctionId: z.string().min(1, 'Auction ID is required'),
  connectionId: z.string().optional(),
  metadata: z.object({
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
  }).optional()
})

/**
 * POST /api/auction/connection - Manage WebSocket connections
 */
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await parseJsonBody(request)
    const validation = validateData(connectionRequestSchema, body)

    if (!validation.success) {
      return createApiResponse(undefined, validation.error, 400)
    }

    const { action, auctionId, connectionId, metadata } = validation.data

    if (action === 'connect') {
      // Extract client metadata
      const clientMetadata = {
        userAgent: request.headers.get('user-agent') || metadata?.userAgent,
        ipAddress: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  metadata?.ipAddress || 'unknown'
      }

      // Establish backend-mediated connection
      const result = await wsManager.establishConnection(
        user.id,
        user.role,
        auctionId,
        clientMetadata
      )

      if (!result.success) {
        return createApiResponse(undefined, result.error, 400)
      }

      if (config.features.enableDebugLogs) {
        console.log(`🔌 Connection established for user ${user.id}: ${result.connectionId}`)
      }

      return createApiResponse({
        connectionId: result.connectionId,
        sseEndpoint: `/api/auction/events/${result.connectionId}`,
        status: 'connected',
        user: {
          id: user.id,
          role: user.role,
          teamId: user.teamId,
          teamName: user.team?.name
        },
        auction: {
          id: auctionId
        },
        websocket: {
          host: config.websocket.host,
          port: config.ports.websocket,
          timeout: config.websocket.timeout
        }
      })
    }

    if (action === 'disconnect') {
      if (!connectionId) {
        return createApiResponse(undefined, 'Connection ID required for disconnect', 400)
      }

      // Verify connection belongs to user
      const connection = wsManager.getConnection(connectionId)
      if (!connection) {
        return createApiResponse(undefined, 'Connection not found', 404)
      }

      if (connection.userId !== user.id && user.role !== 'ADMIN') {
        return createApiResponse(undefined, 'Unauthorized to disconnect this connection', 403)
      }

      await wsManager.closeConnection(connectionId)

      if (config.features.enableDebugLogs) {
        console.log(`🔌 Connection disconnected: ${connectionId}`)
      }

      return createApiResponse({
        status: 'disconnected',
        connectionId
      })
    }

    return createApiResponse(undefined, 'Invalid action', 400)
  } catch (error) {
    console.error('❌ Connection API error:', error)
    return handleApiError(error)
  }
})

/**
 * GET /api/auction/connection - Get connection status
 */
export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId')

    if (connectionId) {
      // Get specific connection status
      const connection = wsManager.getConnection(connectionId)
      
      if (!connection) {
        return createApiResponse(undefined, 'Connection not found', 404)
      }

      if (connection.userId !== user.id && user.role !== 'ADMIN') {
        return createApiResponse(undefined, 'Unauthorized to view this connection', 403)
      }

      return createApiResponse({
        connectionId: connection.id,
        status: 'connected',
        userId: connection.userId,
        role: connection.role,
        auctionId: connection.auctionId,
        lastPing: connection.lastPing.toISOString(),
        sseClients: connection.sseClients.size,
        metadata: connection.metadata
      })
    } else {
      // Get user's connections and system stats
      const stats = wsManager.getStats()
      
      // Filter connections for non-admin users
      let userConnections = []
      if (user.role === 'ADMIN') {
        // Admin can see basic stats
        return createApiResponse({
          stats,
          isAdmin: true
        })
      } else {
        // Regular users see only their connections
        for (const [id, connection] of wsManager['connections']) {
          if (connection.userId === user.id) {
            userConnections.push({
              connectionId: connection.id,
              auctionId: connection.auctionId,
              lastPing: connection.lastPing.toISOString(),
              sseClients: connection.sseClients.size
            })
          }
        }

        return createApiResponse({
          userConnections,
          totalUserConnections: userConnections.length
        })
      }
    }
  } catch (error) {
    return handleApiError(error)
  }
})

/**
 * DELETE /api/auction/connection - Force disconnect (Admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await import('@/lib/session').then(m => m.requireAdmin())
    const url = new URL(request.url)
    const connectionId = url.searchParams.get('connectionId')

    if (!connectionId) {
      return createApiResponse(undefined, 'Connection ID is required', 400)
    }

    const connection = wsManager.getConnection(connectionId)
    if (!connection) {
      return createApiResponse(undefined, 'Connection not found', 404)
    }

    await wsManager.closeConnection(connectionId)

    if (config.features.enableDebugLogs) {
      console.log(`🔌 Admin force disconnect: ${connectionId}`)
    }

    return createApiResponse({
      status: 'force_disconnected',
      connectionId,
      disconnectedUser: {
        id: connection.userId,
        role: connection.role
      }
    })
  } catch (error) {
    return handleApiError(error)
  }
}