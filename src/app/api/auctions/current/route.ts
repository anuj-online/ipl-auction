/**
 * Current Auction API Route
 * Real-time auction state for admin live control
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse, handleApiError, getQueryParams } from '@/lib/session'

/**
 * GET /api/auctions/current - Get current active auction state
 * Returns the currently active auction with detailed state information
 */
export async function GET(request: NextRequest) {
  try {
    const queryParams = getQueryParams(request.url)
    const includeTeamStatus = queryParams.get('includeTeamStatus') === 'true'

    // Find the current active auction
    const auction = await prisma.auction.findFirst({
      where: {
        status: {
          in: ['IN_PROGRESS', 'PAUSED']
        }
      },
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
                stats: true,
              },
            },
            bids: {
              take: 10,
              orderBy: {
                createdAt: 'desc',
              },
              include: {
                team: {
                  select: {
                    id: true,
                    name: true,
                    displayName: true,
                  },
                },
              },
            },
          },
        },
        lots: {
          select: {
            id: true,
            lotNumber: true,
            status: true,
            finalPrice: true,
            soldToTeamId: true,
            player: {
              select: {
                id: true,
                name: true,
                role: true,
                basePrice: true,
              },
            },
          },
          orderBy: {
            lotNumber: 'asc',
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    if (!auction) {
      return createApiResponse(null, 'No active auction found', 404)
    }

    // Calculate auction statistics
    const completedLots = auction.lots.filter(lot => lot.status === 'SOLD' || lot.status === 'UNSOLD')
    const soldLots = auction.lots.filter(lot => lot.status === 'SOLD')
    const unsoldLots = auction.lots.filter(lot => lot.status === 'UNSOLD')
    
    const totalValue = soldLots.reduce((sum, lot) => sum + (lot.finalPrice || 0), 0)
    const averagePrice = soldLots.length > 0 ? Math.round(totalValue / soldLots.length) : 0

    // Get current highest bid if there's an active lot
    let currentPrice = 0
    let currentBidder = null
    let bidHistory: any[] = []

    if (auction.currentLot && auction.currentLot.bids.length > 0) {
      const highestBid = auction.currentLot.bids[0]
      currentPrice = highestBid.amount
      currentBidder = {
        teamId: highestBid.team.id,
        teamName: highestBid.team.displayName || highestBid.team.name,
      }
      bidHistory = auction.currentLot.bids.map(bid => ({
        teamId: bid.team.id,
        teamName: bid.team.displayName || bid.team.name,
        amount: bid.amount,
        timestamp: bid.createdAt.toISOString(),
      }))
    }

    // Build response with current auction state
    const auctionState = {
      id: auction.id,
      name: auction.name,
      status: auction.status,
      season: auction.season,
      currentLot: auction.currentLot ? {
        id: auction.currentLot.id,
        lotNumber: auction.currentLot.lotNumber,
        player: auction.currentLot.player,
        currentPrice,
        currentBidder,
        timeRemaining: auction.currentLot.endsAt ? 
          Math.max(0, Math.floor((new Date(auction.currentLot.endsAt).getTime() - Date.now()) / 1000)) : 
          60, // Default 60 seconds if no end time
        bidHistory,
        status: auction.currentLot.status,
      } : null,
      stats: {
        totalLots: auction.lots.length,
        completedLots: completedLots.length,
        soldLots: soldLots.length,
        unsoldLots: unsoldLots.length,
        totalValue,
        averagePrice,
        highestBid: soldLots.length > 0 ? Math.max(...soldLots.map(lot => lot.finalPrice || 0)) : 0,
      },
      connectedTeams: 0, // Will be updated by WebSocket
      connectedViewers: 0, // Will be updated by WebSocket
      updatedAt: auction.updatedAt.toISOString(),
    }

    // Include team status if requested
    if (includeTeamStatus) {
      const teams = await prisma.team.findMany({
        where: {
          seasonId: auction.season.id,
        },
        select: {
          id: true,
          name: true,
          displayName: true,
          budgetTotal: true,
          budgetRemaining: true,
          _count: {
            select: {
              roster: true,
            },
          },
        },
      })

      return createApiResponse({
        auction: auctionState,
        teams,
      })
    }

    return createApiResponse(auctionState)
  } catch (error) {
    console.error('Failed to fetch current auction:', error)
    return handleApiError(error)
  }
}