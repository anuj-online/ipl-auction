/**
 * Bids API Routes
 * Handles bidding operations for auction lots
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTeam, withAuth, createApiResponse, handleApiError, parseJsonBody, getQueryParams } from '@/lib/session'
import { validateData, bidSchema, paginationSchema } from '@/lib/validations'
import { auctionEngine } from '@/lib/auction-engine'

/**
 * GET /api/bids - List bids with filters
 */
export async function GET(request: NextRequest) {
  try {
    const params = getQueryParams(request.url)
    const lotId = params.get('lotId')
    const teamId = params.get('teamId')
    const auctionId = params.get('auctionId')
    
    const pagination = validateData(paginationSchema, {
      page: parseInt(params.get('page') || '1'),
      limit: parseInt(params.get('limit') || '50'),
      sortBy: params.get('sortBy') || 'createdAt',
      sortOrder: params.get('sortOrder') || 'desc',
    })

    if (!pagination.success) {
      return createApiResponse(undefined, pagination.error, 400)
    }

    const { page, limit, sortBy, sortOrder } = pagination.data
    const skip = (page - 1) * limit

    const whereClause: any = {}
    if (lotId) whereClause.lotId = lotId
    if (teamId) whereClause.teamId = teamId
    if (auctionId) {
      whereClause.lot = {
        auctionId: auctionId
      }
    }

    const [bids, total] = await Promise.all([
      prisma.bid.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
          lot: {
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
              auction: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
      prisma.bid.count({ where: whereClause }),
    ])

    return createApiResponse({
      bids,
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
 * POST /api/bids - Place a bid (Team only)
 */
export const POST = withTeam(async (request: NextRequest, user) => {
  const body = await parseJsonBody(request)
  const validation = validateData(bidSchema, body)

  if (!validation.success) {
    return createApiResponse(undefined, validation.error, 400)
  }

  const { lotId, amount } = validation.data

  // Get lot details
  const lot = await prisma.lot.findUnique({
    where: { id: lotId },
    include: {
      player: true,
      auction: true,
      bids: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          team: true,
        },
      },
    },
  })

  if (!lot) {
    return createApiResponse(undefined, 'Lot not found', 404)
  }

  if (lot.status !== 'IN_PROGRESS') {
    return createApiResponse(undefined, 'Lot is not active for bidding', 400)
  }

  if (lot.auction.status !== 'IN_PROGRESS') {
    return createApiResponse(undefined, 'Auction is not active', 400)
  }

  // Get team details
  const team = await prisma.team.findUnique({
    where: { id: user.teamId! },
  })

  if (!team) {
    return createApiResponse(undefined, 'Team not found', 403)
  }

  // Validate bid amount
  const currentPrice = lot.currentPrice || lot.player.basePrice
  const minimumBid = currentPrice + 25000 // ₹25,000 increment

  if (amount < minimumBid) {
    return createApiResponse(
      undefined,
      `Minimum bid amount is ₹${minimumBid.toLocaleString()}`,
      400
    )
  }

  // Check team budget
  if (team.budgetSpent + amount > team.budgetTotal) {
    return createApiResponse(
      undefined,
      `Insufficient budget. Available: ₹${(team.budgetTotal - team.budgetSpent).toLocaleString()}`,
      400
    )
  }

  // Check if this is the same team as the highest bidder
  if (lot.bids.length > 0 && lot.bids[0].teamId === team.id) {
    return createApiResponse(undefined, 'You are already the highest bidder', 400)
  }

  try {
    // Use auction engine to place bid
    const result = await auctionEngine.placeBid({
      lotId,
      teamId: team.id,
      amount,
      userId: user.id,
    })

    if (!result.success) {
      return createApiResponse(undefined, result.error, 400)
    }

    return createApiResponse({
      bid: result.bid,
      lot: result.lot,
      message: 'Bid placed successfully',
    })
  } catch (error) {
    return handleApiError(error)
  }
})

/**
 * DELETE /api/bids/[bidId] - Cancel a bid (if allowed)
 */
export const DELETE = withAuth(async (request: NextRequest) => {
  const url = new URL(request.url)
  const bidId = url.pathname.split('/').pop()

  if (!bidId) {
    return createApiResponse(undefined, 'Bid ID is required', 400)
  }

  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    include: {
      lot: {
        include: {
          auction: true,
        },
      },
      team: true,
    },
  })

  if (!bid) {
    return createApiResponse(undefined, 'Bid not found', 404)
  }

  // Only allow cancellation if it's the team's own bid and the lot is still active
  if (bid.teamId !== request.headers.get('x-team-id')) {
    return createApiResponse(undefined, 'Unauthorized to cancel this bid', 403)
  }

  if (bid.lot.status !== 'IN_PROGRESS') {
    return createApiResponse(undefined, 'Cannot cancel bid on inactive lot', 400)
  }

  // Mark bid as invalid (soft delete)
  await prisma.bid.update({
    where: { id: bidId },
    data: { isValid: false },
  })

  return createApiResponse({
    message: 'Bid cancelled successfully',
  })
})