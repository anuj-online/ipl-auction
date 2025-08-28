/**
 * Team Roster API Routes
 * Operations for team roster management
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse, handleApiError } from '@/lib/session'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/teams/[id]/roster - Get team roster
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        budgetTotal: true,
        budgetSpent: true,
      },
    })

    if (!team) {
      return createApiResponse(undefined, 'Team not found', 404)
    }

    const roster = await prisma.roster.findMany({
      where: { teamId: params.id },
      include: {
        player: {
          select: {
            id: true,
            name: true,
            country: true,
            role: true,
            isOverseas: true,
            stats: true,
          },
        },
      },
      orderBy: {
        price: 'desc',
      },
    })

    // Calculate team statistics
    const rosterWithStats = roster.map(r => ({
      ...r,
      player: {
        ...r.player,
        stats: r.player.stats ? JSON.parse(r.player.stats) : null,
      },
    }))

    const roleDistribution = roster.reduce((acc, r) => {
      acc[r.player.role] = (acc[r.player.role] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const stats = {
      totalSpent: team.budgetSpent,
      budgetRemaining: team.budgetTotal - team.budgetSpent,
      playerCount: roster.length,
      overseasCount: roster.filter(r => r.player.isOverseas).length,
      roleDistribution: {
        BATSMAN: roleDistribution.BATSMAN || 0,
        BOWLER: roleDistribution.BOWLER || 0,
        ALL_ROUNDER: roleDistribution.ALL_ROUNDER || 0,
        WICKET_KEEPER: roleDistribution.WICKET_KEEPER || 0,
      },
    }

    return createApiResponse({
      roster: rosterWithStats,
      stats,
      team: {
        id: team.id,
        name: team.name,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}