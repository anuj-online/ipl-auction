/**
 * Individual Watchlist Entry API Routes
 * Operations for specific watchlist entries
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTeamEnhanced, createApiResponse, handleApiError } from '@/lib/session'

interface RouteParams {
  params: { 
    id: string // team id
    entryId: string // watchlist entry id
  }
}

/**
 * DELETE /api/teams/[id]/watchlist/[entryId] - Remove from watchlist (Team only)
 */
export const DELETE = withTeamEnhanced(async (request: NextRequest, { params }: RouteParams, user, teamId) => {
  try {
    const watchlistEntry = await prisma.watchlist.findUnique({
      where: { id: params.entryId },
    })

    if (!watchlistEntry) {
      return createApiResponse(undefined, 'Watchlist entry not found', 404)
    }

    if (watchlistEntry.teamId !== teamId) {
      return createApiResponse(undefined, 'Access denied', 403)
    }

    await prisma.watchlist.delete({
      where: { id: params.entryId },
    })

    return createApiResponse({
      message: 'Player removed from watchlist',
    })
  } catch (error) {
    return handleApiError(error)
  }
})