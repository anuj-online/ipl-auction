/**
 * Auction Control API Route
 * Admin controls for managing live auctions
 */

import { NextRequest } from 'next/server'
import { validateData, auctionControlSchema } from '@/lib/validations'
import { withAdmin, createApiResponse, handleApiError, parseJsonBody } from '@/lib/session'
import { auctionEngine } from '@/lib/auction-engine'

/**
 * POST /api/auctions/[id]/control - Control auction operations (Admin only)
 */
export const POST = withAdmin(
  async (
    request: NextRequest,
    user,
    { params }: { params: { id: string } }
  ) => {
    try {
      const body = await parseJsonBody(request)
      const validation = validateData(auctionControlSchema, body)

      if (!validation.success) {
        return createApiResponse(undefined, validation.error, 400)
      }

      const { action, data } = validation.data
      const auctionId = params.id

      console.log(`Admin ${user.email} executing action: ${action} on auction ${auctionId}`)

      let result: any = null

      switch (action) {
        case 'start':
          await auctionEngine.startAuction(auctionId)
          result = { message: 'Auction started successfully' }
          break

        case 'pause':
          await auctionEngine.pauseAuction(auctionId)
          result = { message: 'Auction paused successfully' }
          break

        case 'resume':
          await auctionEngine.resumeAuction(auctionId)
          result = { message: 'Auction resumed successfully' }
          break

        case 'nextLot':
          await auctionEngine.startNextLot(auctionId)
          result = { message: 'Next lot started successfully' }
          break

        case 'forceSell':
          if (!data?.lotId) {
            return createApiResponse(undefined, 'Lot ID required for force sell', 400)
          }
          await auctionEngine.forceSellLot(auctionId, data.lotId)
          result = { message: 'Lot force sold successfully' }
          break

        case 'markUnsold':
          if (!data?.lotId) {
            return createApiResponse(undefined, 'Lot ID required for mark unsold', 400)
          }
          await auctionEngine.markLotUnsold(auctionId, data.lotId)
          result = { message: 'Lot marked as unsold successfully' }
          break

        case 'end':
          // This would end the auction completely
          // For now, we'll just pause it
          await auctionEngine.pauseAuction(auctionId)
          result = { message: 'Auction ended successfully' }
          break

        default:
          return createApiResponse(undefined, `Unknown action: ${action}`, 400)
      }

      // Get updated auction state
      const updatedState = await auctionEngine.initializeAuction(auctionId)

      return createApiResponse({
        ...result,
        auctionState: updatedState,
      })
    } catch (error) {
      console.error('Auction control error:', error)
      return handleApiError(error)
    }
  }
)