/**
 * Team Strategy API Route
 * Manage team auction strategies and planning
 */

import { NextRequest } from 'next/server'
import { createApiResponse, handleApiError, parseJsonBody } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

interface RouteParams {
  params: { id: string }
}

/**
 * GET /api/teams/[id]/strategy - Get team strategy
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return createApiResponse(undefined, 'Authentication required', 401)
    }

    // Check access permissions
    if (session.user.role !== 'ADMIN' && session.user.teamId !== params.id) {
      return createApiResponse(undefined, 'Access denied', 403)
    }

    // Try to find existing strategy
    const strategy = await prisma.teamStrategy.findFirst({
      where: {
        teamId: params.id,
      },
      include: {
        team: {
          select: {
            name: true,
            budgetTotal: true,
            budgetSpent: true,
            season: {
              select: {
                id: true,
                name: true,
                year: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    if (!strategy) {
      return createApiResponse(undefined, 'Strategy not found', 404)
    }

    return createApiResponse({
      strategy: {
        id: strategy.id,
        teamId: strategy.teamId,
        seasonId: strategy.team.season.id,
        budget: strategy.budget as any,
        roleStrategies: strategy.roleStrategies as any,
        targetPlayers: strategy.targetPlayers as any,
        generalNotes: strategy.generalNotes,
        lastUpdated: strategy.updatedAt.toISOString(),
        team: strategy.team,
      },
    })
  } catch (error) {
    console.error('Failed to fetch team strategy:', error)
    return handleApiError(error)
  }
}

/**
 * POST /api/teams/[id]/strategy - Create or update team strategy
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return createApiResponse(undefined, 'Authentication required', 401)
    }

    // Check access permissions
    if (session.user.role !== 'ADMIN' && session.user.teamId !== params.id) {
      return createApiResponse(undefined, 'Access denied', 403)
    }

    const body = await parseJsonBody(request)
    
    // Validate required fields
    if (!body.budget || !body.roleStrategies || !Array.isArray(body.targetPlayers)) {
      return createApiResponse(undefined, 'Invalid strategy data', 400)
    }

    // Verify team exists
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
      },
    })

    if (!team) {
      return createApiResponse(undefined, 'Team not found', 404)
    }

    // Create or update strategy
    const strategyData = {
      teamId: params.id,
      seasonId: team.seasonId,
      budget: body.budget,
      roleStrategies: body.roleStrategies,
      targetPlayers: body.targetPlayers,
      generalNotes: body.generalNotes || '',
      updatedAt: new Date(),
    }

    const strategy = await prisma.teamStrategy.upsert({
      where: {
        teamId_seasonId: {
          teamId: params.id,
          seasonId: team.seasonId,
        },
      },
      update: strategyData,
      create: strategyData,
      include: {
        team: {
          select: {
            name: true,
            budgetTotal: true,
            budgetSpent: true,
            season: {
              select: {
                id: true,
                name: true,
                year: true,
              },
            },
          },
        },
      },
    })

    return createApiResponse({
      strategy: {
        id: strategy.id,
        teamId: strategy.teamId,
        seasonId: strategy.seasonId,
        budget: strategy.budget,
        roleStrategies: strategy.roleStrategies,
        targetPlayers: strategy.targetPlayers,
        generalNotes: strategy.generalNotes,
        lastUpdated: strategy.updatedAt.toISOString(),
        team: strategy.team,
      },
      message: 'Strategy saved successfully',
    })
  } catch (error) {
    console.error('Failed to save team strategy:', error)
    return handleApiError(error)
  }
}

/**
 * DELETE /api/teams/[id]/strategy - Delete team strategy
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return createApiResponse(undefined, 'Authentication required', 401)
    }

    // Check access permissions
    if (session.user.role !== 'ADMIN' && session.user.teamId !== params.id) {
      return createApiResponse(undefined, 'Access denied', 403)
    }

    await prisma.teamStrategy.deleteMany({
      where: {
        teamId: params.id,
      },
    })

    return createApiResponse({
      message: 'Strategy deleted successfully',
    })
  } catch (error) {
    console.error('Failed to delete team strategy:', error)
    return handleApiError(error)
  }
}