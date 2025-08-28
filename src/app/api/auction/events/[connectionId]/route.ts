/**
 * Server-Sent Events API for Auction Events
 * Streams real-time auction data through backend-mediated connections
 */

import { NextRequest } from 'next/server'
import { wsManager } from '@/lib/websocket-manager'
import { config } from '@/lib/config'

/**
 * GET /api/auction/events/[connectionId] - SSE stream for auction events
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  const { connectionId } = params

  try {
    // Validate connection exists
    const connection = wsManager.getConnection(connectionId)
    if (!connection) {
      return new Response('Connection not found', { 
        status: 404,
        headers: {
          'Content-Type': 'text/plain'
        }
      })
    }

    if (config.features.enableDebugLogs) {
      console.log(`📡 SSE stream requested for connection: ${connectionId}`)
    }

    // Create Server-Sent Events stream
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        
        // Send initial connection confirmation
        const welcomeEvent = {
          type: 'connection:established',
          payload: {
            connectionId,
            timestamp: new Date().toISOString(),
            user: {
              id: connection.userId,
              role: connection.role,
              teamId: connection.metadata.teamId,
              teamName: connection.metadata.teamName
            },
            auction: {
              id: connection.auctionId
            }
          }
        }

        const welcomeData = `data: ${JSON.stringify(welcomeEvent)}\n\n`
        controller.enqueue(encoder.encode(welcomeData))

        // Add this controller to the connection's SSE clients
        wsManager.addSSEClient(connectionId, controller)

        if (config.features.enableDebugLogs) {
          console.log(`📡 SSE client added to connection: ${connectionId}`)
        }

        // Send periodic heartbeat to keep connection alive
        const heartbeatInterval = setInterval(() => {
          try {
            const heartbeat = `data: ${JSON.stringify({
              type: 'heartbeat',
              payload: {
                timestamp: new Date().toISOString(),
                connectionId
              }
            })}\n\n`
            controller.enqueue(encoder.encode(heartbeat))
          } catch (error) {
            // Connection closed, clear interval
            clearInterval(heartbeatInterval)
          }
        }, 30000) // Heartbeat every 30 seconds

        // Setup cleanup on client disconnect
        const cleanup = () => {
          clearInterval(heartbeatInterval)
          wsManager.removeSSEClient(connectionId, controller)
          
          if (config.features.enableDebugLogs) {
            console.log(`📡 SSE client removed from connection: ${connectionId}`)
          }
          
          try {
            controller.close()
          } catch (error) {
            // Ignore close errors
          }
        }

        // Listen for request abortion (client disconnect)
        request.signal.addEventListener('abort', cleanup)

        // Store cleanup function for manual cleanup
        controller['cleanup'] = cleanup
      },

      cancel() {
        // This is called when the stream is cancelled
        if (config.features.enableDebugLogs) {
          console.log(`📡 SSE stream cancelled for connection: ${connectionId}`)
        }
      }
    })

    // Return SSE response with appropriate headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control, Content-Type',
        'Access-Control-Allow-Methods': 'GET',
        'X-Accel-Buffering': 'no', // Disable nginx buffering
        'Transfer-Encoding': 'chunked'
      }
    })

  } catch (error) {
    console.error('❌ SSE endpoint error:', error)
    
    return new Response(`data: ${JSON.stringify({
      type: 'error',
      payload: {
        error: error instanceof Error ? error.message : 'SSE stream error',
        timestamp: new Date().toISOString(),
        connectionId
      }
    })}\n\n`, {
      status: 500,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    })
  }
}

/**
 * OPTIONS /api/auction/events/[connectionId] - CORS preflight
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
      'Access-Control-Max-Age': '86400'
    }
  })
}