/**
 * User Profile API Route
 * Get current user profile information
 */

import { NextRequest } from 'next/server'
import { requireAuth, createApiResponse, handleApiError } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    
    return createApiResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
        teamName: user.teamName,
      }
    })

  } catch (error) {
    return handleApiError(error)
  }
}