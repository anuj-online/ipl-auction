/**
 * Teams API Routes
 * CRUD operations for team management
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateData, teamSchema, paginationSchema } from '@/lib/validations'
import { withAdmin, createApiResponse, handleApiError, parseJsonBody, getQueryParams } from '@/lib/session'

/**
 * GET /api/teams - List teams
 */
export async function GET(request: NextRequest) {
  try {
    const params = getQueryParams(request.url)
    const seasonId = params.get('seasonId')
    
    const pagination = validateData(paginationSchema, {
      page: parseInt(params.get('page') || '1'),
      limit: parseInt(params.get('limit') || '20'),
      sortBy: params.get('sortBy') || 'createdAt',
      sortOrder: params.get('sortOrder') || 'desc',
    })

    if (!pagination.success) {
      return createApiResponse(undefined, pagination.error, 400)
    }

    const { page, limit, sortBy, sortOrder } = pagination.data
    const skip = (page - 1) * limit

    const whereClause: any = {}
    if (seasonId) whereClause.seasonId = seasonId

    const [teams, total] = await Promise.all([
      prisma.team.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
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
          _count: {
            select: {
              roster: true,
            },
          },
        },
      }),
      prisma.team.count({ where: whereClause }),
    ])

    const teamsWithStats = teams.map(team => ({
      ...team,
      rosterCount: team._count.roster,
    }))

    return createApiResponse({
      teams: teamsWithStats,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * POST /api/teams - Create new team (Admin only)
 */
export const POST = withAdmin(async (request: NextRequest) => {
  const body = await parseJsonBody(request)
  const validation = validateData(teamSchema, body)

  if (!validation.success) {
    return createApiResponse(undefined, validation.error, 400)
  }

  const { name, displayName, budgetTotal, seasonId } = validation.data

  // Check if season exists
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
  })

  if (!season) {
    return createApiResponse(undefined, 'Season not found', 404)
  }

  // Check for duplicate team name in season
  const existingTeam = await prisma.team.findFirst({
    where: {
      name,
      seasonId,
    },
  })

  if (existingTeam) {
    return createApiResponse(undefined, 'Team name already exists in this season', 409)
  }

  try {
    const team = await prisma.team.create({
      data: {
        name,
        displayName,
        budgetTotal,
        seasonId,
      },
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
      message: 'Team created successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
})