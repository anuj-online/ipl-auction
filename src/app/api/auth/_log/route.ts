/**
 * Auth Logging API Route
 * Handles authentication event logging
 */

import { NextRequest } from 'next/server'
import { createApiResponse, handleApiError, parseJsonBody } from '@/lib/session'

/**
 * POST /api/auth/_log - Log authentication events
 */
export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody(request)
    
    // Log the authentication event
    console.log('Auth Event:', {
      timestamp: new Date().toISOString(),
      type: body.type || 'unknown',
      message: body.message || 'Authentication event',
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      data: body,
    })
    
    return createApiResponse({
      logged: true,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * GET /api/auth/_log - Not supported
 */
export async function GET() {
  return createApiResponse(undefined, 'Method not allowed', 405)
}