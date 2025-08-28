/**
 * Current Auction API Route
 * Get the current active auction state and details
 */

import { NextRequest } from 'next/server'
import { withAuth, createApiResponse, handleApiError, getQueryParams } from '@/lib/session'
import { auctionEngine } from '@/lib/auction-engine'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/auctions/current - Get current auction state
 */
export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const params = getQueryParams(request.url)
    const auctionId = params.get('auctionId')
    const includeTeamStatus = params.get('includeTeamStatus') === 'true'
    const includeState = params.get('includeState') === 'true'

    if (!auctionId) {
      return createApiResponse(undefined, 'Auction ID is required', 400)
    }

    // Get auction state from engine
    const auctionState = await auctionEngine.initializeAuction(auctionId)

    let responseData: any = {
      auctionState
    }

    // Include team budget information if requested
    if (includeTeamStatus) {
      const teamBudgets = await auctionEngine.getTeamBudgets(auctionId)
      responseData.teamBudgets = teamBudgets
    }

    // Include additional state information if requested
    if (includeState) {
      // Get recent events
      const recentEvents = await auctionEngine.getEventsSince(auctionId)
      responseData.recentEvents = recentEvents.slice(-10) // Last 10 events
      
      // Get current lot details if available
      if (auctionState.currentLotId) {
        const currentLot = await prisma.lot.findUnique({
          where: { id: auctionState.currentLotId },
          include: {
            player: true,
            bids: {
              orderBy: { createdAt: 'desc' },
              take: 5,
              include: {
                team: {
                  select: {
                    id: true,
                    name: true,
                    displayName: true
                  }
                }
              }
            }
          }
        })
        
        responseData.currentLotDetails = currentLot
      }
    }

    return createApiResponse(responseData)
  } catch (error) {
    console.error('Current auction error:', error)
    return handleApiError(error)
  }
})
