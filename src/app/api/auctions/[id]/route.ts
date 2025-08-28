/**
 * Individual Auction API Routes
 * Get auction details and state information
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse, handleApiError, getQueryParams } from '@/lib/session'
import { auctionEngine } from '@/lib/auction-engine'

/**
 * GET /api/auctions/[id] - Get auction details and current state
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const queryParams = getQueryParams(request.url)
    const includeState = queryParams.get('includeState') === 'true'
    const includeTeams = queryParams.get('includeTeams') === 'true'
    const includeLots = queryParams.get('includeLots') === 'true'

    const auction = await prisma.auction.findUnique({
      where: { id: params.id },
      include: {
        season: {
          select: {
            id: true,
            name: true,
            year: true,
            settings: true,
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
                isOverseas: true,
                stats: true,
              },
            },
            soldTo: {
              select: {
                id: true,
                name: true,
              },
            },
            bids: {
              include: {
                team: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
              orderBy: {
                createdAt: 'desc',
              },
              take: 5,
            },
          },
        },
        ...(includeTeams && {
          season: {
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
            },
          },
        }),
        ...(includeLots && {
          lots: {
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
            orderBy: {
              order: 'asc',
            },
          },
        }),
        _count: {
          select: {
            lots: true,
            events: true,
          },
        },
      },
    })

    if (!auction) {
      return createApiResponse(undefined, 'Auction not found', 404)
    }

    // Get auction statistics
    const stats = await prisma.lot.aggregate({
      where: {
        auctionId: params.id,
      },
      _count: {
        id: true,
      },
    })

    const completedStats = await prisma.lot.aggregate({
      where: {
        auctionId: params.id,
        status: {
          in: ['SOLD', 'UNSOLD'],
        },
      },
      _count: {
        id: true,
      },
    })

    const soldStats = await prisma.lot.aggregate({
      where: {
        auctionId: params.id,
        status: 'SOLD',
      },
      _count: {
        id: true,
      },
      _sum: {
        finalPrice: true,
      },
      _avg: {
        finalPrice: true,
      },
      _max: {
        finalPrice: true,
      },
    })

    // Parse JSON fields
    const auctionWithParsedData = {
      ...auction,
      settings: auction.settings ? JSON.parse(auction.settings) : {},
      season: {
        ...auction.season,
        settings: auction.season.settings ? JSON.parse(auction.season.settings) : {},
      },
      currentLot: auction.currentLot ? {
        ...auction.currentLot,
        player: {
          ...auction.currentLot.player,
          stats: auction.currentLot.player.stats ? JSON.parse(auction.currentLot.player.stats) : {},
        },
      } : null,
      stats: {
        totalLots: stats._count.id,
        completedLots: completedStats._count.id,
        soldLots: soldStats._count.id,
        unsoldLots: completedStats._count.id - soldStats._count.id,
        totalValue: soldStats._sum.finalPrice || 0,
        averagePrice: Math.round(soldStats._avg.finalPrice || 0),
        highestSale: soldStats._max.finalPrice || 0,
        totalEvents: auction._count.events,
        progress: stats._count.id > 0 ? Math.round((completedStats._count.id / stats._count.id) * 100) : 0,
      },
    }

    // Get live auction state if requested
    let liveState = null
    if (includeState && auction.status === 'IN_PROGRESS') {
      try {
        liveState = await auctionEngine.initializeAuction(params.id)
      } catch (error) {
        console.error('Error getting live auction state:', error)
        // Continue without live state if there's an error
      }
    }

    // Get team budgets if teams are included
    let teamBudgets = null
    if (includeTeams) {
      teamBudgets = await auctionEngine.getTeamBudgets(params.id)
    }

    return createApiResponse({
      auction: auctionWithParsedData,
      liveState,
      teamBudgets,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * GET /api/auctions/[id]/changes - Get events since last sync (for delta sync)
 */
export async function GET_CHANGES(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const queryParams = getQueryParams(request.url)
    const sinceEventId = queryParams.get('sinceEventId')
    const sinceSequence = sinceEventId ? parseInt(sinceEventId) : undefined

    // Get events since the specified sequence
    const events = await auctionEngine.getEventsSince(params.id, sinceSequence)
    
    // Get current auction state
    const currentState = await auctionEngine.initializeAuction(params.id)

    return createApiResponse({
      events,
      currentState,
      lastEventId: events.length > 0 ? events[events.length - 1].sequence : sinceSequence || 0,
    })
  } catch (error) {
    return handleApiError(error)
  }
}