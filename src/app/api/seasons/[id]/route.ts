/**
 * Individual Season API Routes
 * GET, PUT, DELETE operations for specific seasons
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateData, seasonSchema } from '@/lib/validations'
import { withAdmin, createApiResponse, handleApiError, parseJsonBody } from '@/lib/session'

/**
 * GET /api/seasons/[id] - Get season by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const season = await prisma.season.findUnique({
      where: { id: params.id },
      include: {
        teams: {
          include: {
            _count: {
              select: {
                roster: true,
              },
            },
          },
        },
        players: {
          select: {
            id: true,
            name: true,
            role: true,
            country: true,
            basePrice: true,
            isOverseas: true,
          },
        },
        auctions: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            teams: true,
            players: true,
            auctions: true,
          },
        },
      },
    })

    if (!season) {
      return createApiResponse(undefined, 'Season not found', 404)
    }

    // Parse settings JSON
    const seasonWithSettings = {
      ...season,
      settings: season.settings ? JSON.parse(season.settings) : {},
    }

    return createApiResponse({ season: seasonWithSettings })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/seasons/[id] - Update season (Admin only)
 */
export const PUT = withAdmin(
  async (request: NextRequest, user, { params }: { params: { id: string } }) => {
    const body = await parseJsonBody(request)
    const validation = validateData(seasonSchema.partial(), body)

    if (!validation.success) {
      return createApiResponse(undefined, validation.error, 400)
    }

    const { name, year, description, status, startDate, endDate, settings } = validation.data

    // Check if season exists
    const existingSeason = await prisma.season.findUnique({
      where: { id: params.id },
    })

    if (!existingSeason) {
      return createApiResponse(undefined, 'Season not found', 404)
    }

    // Check for duplicate name/year if updating
    if ((name && name !== existingSeason.name) || (year && year !== existingSeason.year)) {
      const duplicate = await prisma.season.findFirst({
        where: {
          name: name || existingSeason.name,
          year: year || existingSeason.year,
          NOT: { id: params.id },
        },
      })

      if (duplicate) {
        return createApiResponse(undefined, 'Season name/year combination already exists', 409)
      }
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (year !== undefined) updateData.year = year
    if (description !== undefined) updateData.description = description
    if (status !== undefined) updateData.status = status
    if (startDate !== undefined) updateData.startDate = startDate
    if (endDate !== undefined) updateData.endDate = endDate
    if (settings !== undefined) updateData.settings = JSON.stringify(settings)

    const season = await prisma.season.update({
      where: { id: params.id },
      data: updateData,
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
      season,
      message: 'Season updated successfully',
    })
  }
)

/**
 * DELETE /api/seasons/[id] - Delete season (Admin only)
 */
export const DELETE = withAdmin(
  async (request: NextRequest, user, { params }: { params: { id: string } }) => {
    // Check if season exists
    const season = await prisma.season.findUnique({
      where: { id: params.id },
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

    if (!season) {
      return createApiResponse(undefined, 'Season not found', 404)
    }

    // Prevent deletion if season has active auctions
    const activeAuctions = await prisma.auction.findFirst({
      where: {
        seasonId: params.id,
        status: {
          in: ['IN_PROGRESS', 'PAUSED'],
        },
      },
    })

    if (activeAuctions) {
      return createApiResponse(
        undefined,
        'Cannot delete season with active auctions',
        409
      )
    }

    // Delete in correct order to avoid foreign key constraints
    await prisma.$transaction([
      // Delete auction events first
      prisma.auctionEvent.deleteMany({
        where: {
          auction: {
            seasonId: params.id,
          },
        },
      }),
      // Delete bids
      prisma.bid.deleteMany({
        where: {
          lot: {
            auction: {
              seasonId: params.id,
            },
          },
        },
      }),
      // Delete lots
      prisma.lot.deleteMany({
        where: {
          auction: {
            seasonId: params.id,
          },
        },
      }),
      // Delete auctions
      prisma.auction.deleteMany({
        where: { seasonId: params.id },
      }),
      // Delete roster entries
      prisma.roster.deleteMany({
        where: {
          team: {
            seasonId: params.id,
          },
        },
      }),
      // Delete budget transactions
      prisma.budgetTransaction.deleteMany({
        where: {
          team: {
            seasonId: params.id,
          },
        },
      }),
      // Delete watchlist entries
      prisma.watchlist.deleteMany({
        where: {
          team: {
            seasonId: params.id,
          },
        },
      }),
      // Delete teams
      prisma.team.deleteMany({
        where: { seasonId: params.id },
      }),
      // Delete players
      prisma.player.deleteMany({
        where: { seasonId: params.id },
      }),
      // Finally delete the season
      prisma.season.delete({
        where: { id: params.id },
      }),
    ])

    return createApiResponse({
      message: 'Season deleted successfully',
    })
  }
)