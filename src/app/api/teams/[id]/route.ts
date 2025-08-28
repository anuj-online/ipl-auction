/**
 * Individual Team API Routes
 * Operations for specific teams
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateData, teamSchema } from '@/lib/validations'
import { withAdmin, createApiResponse, handleApiError, parseJsonBody } from '@/lib/session'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/teams/[id] - Get team details
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: {
        season: {
          select: {
            id: true,
            name: true,
            year: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        roster: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                role: true,
                country: true,
                isOverseas: true,
                stats: true,
              },
            },
          },
          orderBy: {
            price: 'desc',
          },
        },
        transactions: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
        _count: {
          select: {
            roster: true,
          },
        },
      },
    })

    if (!team) {
      return createApiResponse(undefined, 'Team not found', 404)
    }

    const teamWithStats = {
      ...team,
      rosterCount: team._count.roster,
      roster: team.roster.map(r => ({
        ...r,
        player: {
          ...r.player,
          stats: r.player.stats ? JSON.parse(r.player.stats) : null,
        },
      })),
    }

    return createApiResponse({ team: teamWithStats })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/teams/[id] - Update team (Admin only)
 */
export const PUT = withAdmin(async (request: NextRequest, { params }: RouteParams) => {
  const body = await parseJsonBody(request)
  const validation = validateData(teamSchema.partial(), body)

  if (!validation.success) {
    return createApiResponse(undefined, validation.error, 400)
  }

  try {
    const team = await prisma.team.update({
      where: { id: params.id },
      data: validation.data,
      include: {
        season: {
          select: {
            id: true,
            name: true,
            year: true,
          },
        },
        users: true,
        _count: {
          select: {
            roster: true,
          },
        },
      },
    })

    return createApiResponse({
      team: {
        ...team,
        rosterCount: team._count.roster,
      },
      message: 'Team updated successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
})

/**
 * DELETE /api/teams/[id] - Delete team (Admin only)
 */
export const DELETE = withAdmin(async (request: NextRequest, { params }: RouteParams) => {
  try {
    // Check if team has roster or bids
    const team = await prisma.team.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: {
            roster: true,
            bids: true,
          },
        },
      },
    })

    if (!team) {
      return createApiResponse(undefined, 'Team not found', 404)
    }

    if (team._count.roster > 0 || team._count.bids > 0) {
      return createApiResponse(
        undefined,
        'Cannot delete team with existing players or bids',
        400
      )
    }

    await prisma.team.delete({
      where: { id: params.id },
    })

    return createApiResponse({ message: 'Team deleted successfully' })
  } catch (error) {
    return handleApiError(error)
  }
})