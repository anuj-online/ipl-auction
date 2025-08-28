/**
 * Session API Route
 * Handles session retrieval for the application
 */

import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { createApiResponse, handleApiError } from '@/lib/session'

/**
 * GET /api/auth/session - Get current session
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    
    return createApiResponse({
      session: session || null,
      authenticated: !!session?.user,
    })
  } catch (error) {
    return handleApiError(error)
  }
}