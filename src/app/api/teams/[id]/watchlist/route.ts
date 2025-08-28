/**
 * Team Watchlist API Routes
 * Operations for team watchlist management
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTeamEnhanced, createApiResponse, handleApiError, parseJsonBody } from '@/lib/session'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/teams/[id]/watchlist - Get team watchlist
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const watchlist = await prisma.watchlist.findMany({
      where: { teamId: params.id },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            country: true,
            role: true,
            basePrice: true,
            isOverseas: true,
            stats: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    })

    const watchlistWithStats = watchlist.map(w => ({
      ...w,
      player: {
        ...w.player,
        stats: w.player.stats ? JSON.parse(w.player.stats) : null,
      },
    }))

    return createApiResponse({
      watchlist: watchlistWithStats,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/teams/[id]/watchlist - Add player to watchlist (Team only)
 */
export const POST = withTeamEnhanced(async (request: NextRequest, { params }: RouteParams, user, teamId) => {
  const body = await parseJsonBody(request)
  const { playerId, maxBid, priority } = body

  if (!playerId) {
    return createApiResponse(undefined, 'Player ID is required', 400)
  }

  try {
    // Check if player exists and is available
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        roster: true,
      },
    })

    if (!player) {
      return createApiResponse(undefined, 'Player not found', 404)
    }

    if (player.roster.length > 0) {
      return createApiResponse(undefined, 'Player is already sold', 400)
    }

    // Check if already in watchlist
    const existing = await prisma.watchlist.findUnique({
      where: {
        teamId_playerId: {
          teamId: teamId,
          playerId,
        },
      },
    })

    if (existing) {
      return createApiResponse(undefined, 'Player already in watchlist', 409)
    }

    const watchlistEntry = await prisma.watchlist.create({
      data: {
        teamId: teamId,
        playerId,
        maxBid: maxBid || null,
        priority: priority || null,
      },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            country: true,
            role: true,
            basePrice: true,
            isOverseas: true,
            stats: true,
          },
        },
      },
    })

    return createApiResponse({
      watchlistEntry: {
        ...watchlistEntry,
        player: {
          ...watchlistEntry.player,
          stats: watchlistEntry.player.stats ? JSON.parse(watchlistEntry.player.stats) : null,
        },
      },
      message: 'Player added to watchlist',
    })
  } catch (error) {
    return handleApiError(error)
  }
})