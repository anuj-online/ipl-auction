/**
 * Auctions API Routes
 * CRUD operations for cricket player auctions
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateData, auctionSchema, paginationSchema } from '@/lib/validations'
import { withAdmin, createApiResponse, handleApiError, parseJsonBody, getQueryParams } from '@/lib/session'
import { auctionEngine } from '@/lib/auction-engine'

/**
 * GET /api/auctions - List auctions
 */
export async function GET(request: NextRequest) {
  try {
    const params = getQueryParams(request.url)
    const seasonId = params.get('seasonId')
    const status = params.get('status')
    
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
    if (status) whereClause.status = status

    const [auctions, total] = await Promise.all([
      prisma.auction.findMany({
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
          currentLot: {
            include: {
              player: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                  country: true,
                  basePrice: true,
                },
              },
              soldTo: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: {
              lots: true,
              events: true,
            },
          },
        },
      }),
      prisma.auction.count({ where: whereClause }),
    ])

    // Add auction statistics
    const auctionsWithStats = await Promise.all(
      auctions.map(async auction => {
        const stats = await prisma.lot.aggregate({
          where: {
            auctionId: auction.id,
            status: {
              in: ['SOLD', 'UNSOLD'],
            },
          },
          _count: { id: true },
        })

        const soldStats = await prisma.lot.aggregate({
          where: {
            auctionId: auction.id,
            status: 'SOLD',
          },
          _count: { id: true },
          _sum: { finalPrice: true },
          _avg: { finalPrice: true },
          _max: { finalPrice: true },
        })

        return {
          ...auction,
          settings: auction.settings ? JSON.parse(auction.settings) : {},
          stats: {
            totalLots: auction._count.lots,
            completedLots: stats._count.id,
            soldLots: soldStats._count.id,
            unsoldLots: stats._count.id - soldStats._count.id,
            totalValue: soldStats._sum.finalPrice || 0,
            averagePrice: Math.round(soldStats._avg.finalPrice || 0),
            highestSale: soldStats._max.finalPrice || 0,
            totalEvents: auction._count.events,
          },
        }
      })
    )

    return createApiResponse({
      auctions: auctionsWithStats,
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
 * POST /api/auctions - Create new auction (Admin only)
 */
export const POST = withAdmin(async (request: NextRequest) => {
  const body = await parseJsonBody(request)
  const validation = validateData(auctionSchema, body)

  if (!validation.success) {
    return createApiResponse(undefined, validation.error, 400)
  }

  const { name, seasonId, settings } = validation.data

  // Check if season exists
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      players: {
        where: {
          roster: {
            none: {},
          },
        },
        orderBy: {
          basePrice: 'desc',
        },
      },
    },
  })

  if (!season) {
    return createApiResponse(undefined, 'Season not found', 404)
  }

  if (season.players.length === 0) {
    return createApiResponse(undefined, 'No available players in season for auction', 400)
  }

  // Check for existing active auction in season
  const existingActiveAuction = await prisma.auction.findFirst({
    where: {
      seasonId,
      status: {
        in: ['IN_PROGRESS', 'PAUSED'],
      },
    },
  })

  if (existingActiveAuction) {
    return createApiResponse(
      undefined,
      'An active auction already exists for this season',
      409
    )
  }

  const auction = await prisma.$transaction(async (tx) => {
    // Create auction
    const newAuction = await tx.auction.create({
      data: {
        name,
        seasonId,
        settings: JSON.stringify(settings || {}),
      },
    })

    // Create lots for all available players
    const lots = season.players.map((player, index) => ({
      auctionId: newAuction.id,
      playerId: player.id,
      order: index + 1,
    }))

    await tx.lot.createMany({
      data: lots,
    })

    return newAuction
  })

  // Fetch the created auction with full details
  const fullAuction = await prisma.auction.findUnique({
    where: { id: auction.id },
    include: {
      season: {
        select: {
          id: true,
          name: true,
          year: true,
        },
      },
      _count: {
        select: {
          lots: true,
        },
      },
    },
  })

  return createApiResponse({
    auction: {
      ...fullAuction,
      settings: fullAuction!.settings ? JSON.parse(fullAuction!.settings) : {},
    },
    message: `Auction created successfully with ${season.players.length} lots`,
  })
})