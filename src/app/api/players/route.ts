/**
 * Players API Routes
 * CRUD operations for player management
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateData, playerSchema, paginationSchema } from '@/lib/validations'
import { withAdmin, createApiResponse, handleApiError, parseJsonBody, getQueryParams } from '@/lib/session'

/**
 * GET /api/players - List players
 */
export async function GET(request: NextRequest) {
  try {
    const params = getQueryParams(request.url)
    const seasonId = params.get('seasonId')
    const role = params.get('role')
    const country = params.get('country')
    const isOverseas = params.get('isOverseas')
    
    const pagination = validateData(paginationSchema, {
      page: parseInt(params.get('page') || '1'),
      limit: parseInt(params.get('limit') || '50'),
      sortBy: params.get('sortBy') || 'name',
      sortOrder: params.get('sortOrder') || 'asc',
    })

    if (!pagination.success) {
      return createApiResponse(undefined, pagination.error, 400)
    }

    const { page, limit, sortBy, sortOrder } = pagination.data
    const skip = (page - 1) * limit

    const whereClause: any = {}
    if (seasonId) whereClause.seasonId = seasonId
    if (role) whereClause.role = role
    if (country) whereClause.country = country
    if (isOverseas !== null) whereClause.isOverseas = isOverseas === 'true'

    const [players, total] = await Promise.all([
      prisma.player.findMany({
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
          roster: {
            select: {
              team: {
                select: {
                  id: true,
                  name: true,
                  displayName: true,
                },
              },
              price: true,
            },
          },
          lots: {
            select: {
              id: true,
              status: true,
              finalPrice: true,
              soldTo: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.player.count({ where: whereClause }),
    ])

    const playersWithStats = players.map(player => ({
      ...player,
      stats: player.stats ? JSON.parse(player.stats) : null,
      currentTeam: player.roster[0]?.team || null,
      soldFor: player.roster[0]?.price || null,
      auctionStatus: player.lots[0]?.status || 'QUEUED',
    }))

    return createApiResponse({
      players: playersWithStats,
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
 * POST /api/players - Create new player (Admin only)
 */
export const POST = withAdmin(async (request: NextRequest) => {
  const body = await parseJsonBody(request)
  const validation = validateData(playerSchema, body)

  if (!validation.success) {
    return createApiResponse(undefined, validation.error, 400)
  }

  const { name, country, role, basePrice, seasonId, stats, tags, isOverseas } = validation.data

  // Check if season exists
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
  })

  if (!season) {
    return createApiResponse(undefined, 'Season not found', 404)
  }

  // Check for duplicate player name in season
  const existingPlayer = await prisma.player.findFirst({
    where: {
      name,
      seasonId,
    },
  })

  if (existingPlayer) {
    return createApiResponse(undefined, 'Player already exists in this season', 409)
  }

  try {
    const player = await prisma.player.create({
      data: {
        name,
        country,
        role,
        basePrice,
        seasonId,
        stats: stats ? JSON.stringify(stats) : undefined,
        tags,
        isOverseas: isOverseas ?? (country !== 'India'),
      },
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

    return createApiResponse({
      player: {
        ...player,
        stats: player.stats ? JSON.parse(player.stats) : null,
      },
      message: 'Player created successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
})
