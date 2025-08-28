/**
 * Seasons API Routes
 * CRUD operations for season management
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateData, seasonSchema, paginationSchema } from '@/lib/validations'
import { withAdmin, createApiResponse, handleApiError, parseJsonBody, getQueryParams } from '@/lib/session'

/**
 * GET /api/seasons - List seasons
 */
export async function GET(request: NextRequest) {
  try {
    const params = getQueryParams(request.url)
    const status = params.get('status')
    
    const pagination = validateData(paginationSchema, {
      page: parseInt(params.get('page') || '1'),
      limit: parseInt(params.get('limit') || '20'),
      sortBy: params.get('sortBy') || 'year',
      sortOrder: params.get('sortOrder') || 'desc',
    })

    if (!pagination.success) {
      return createApiResponse(undefined, pagination.error, 400)
    }

    const { page, limit, sortBy, sortOrder } = pagination.data
    const skip = (page - 1) * limit

    const whereClause: any = {}
    if (status) whereClause.status = status

    const [seasons, total] = await Promise.all([
      prisma.season.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              teams: true,
              players: true,
              auctions: true,
            },
          },
        },
      }),
      prisma.season.count({ where: whereClause }),
    ])

    const seasonsWithStats = seasons.map(season => ({
      ...season,
      settings: season.settings ? JSON.parse(season.settings) : {},
      teamCount: season._count.teams,
      playerCount: season._count.players,
      auctionCount: season._count.auctions,
    }))

    return createApiResponse({
      seasons: seasonsWithStats,
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
 * POST /api/seasons - Create new season (Admin only)
 */
export const POST = withAdmin(async (request: NextRequest) => {
  const body = await parseJsonBody(request)
  const validation = validateData(seasonSchema, body)

  if (!validation.success) {
    return createApiResponse(undefined, validation.error, 400)
  }

  const { name, year, description, status, startDate, endDate, settings } = validation.data

  // Check for duplicate season name and year
  const existingSeason = await prisma.season.findFirst({
    where: {
      OR: [
        { name, year },
        { name },
      ],
    },
  })

  if (existingSeason) {
    return createApiResponse(undefined, 'Season with this name already exists', 409)
  }

  try {
    const season = await prisma.season.create({
      data: {
        name,
        year,
        description,
        status,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        settings: JSON.stringify(settings || {}),
      },
      include: {
        _count: {
          select: {
            teams: true,
            players: true,
            auctions: true,
          },
        },
      },
    })

    return createApiResponse({
      season: {
        ...season,
        settings: season.settings ? JSON.parse(season.settings) : {},
        teamCount: season._count.teams,
        playerCount: season._count.players,
        auctionCount: season._count.auctions,
      },
      message: 'Season created successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
})