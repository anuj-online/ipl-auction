/**
 * Auction Engine - Core Logic
 * State machine for managing live cricket player auctions
 */

import { EventEmitter } from 'events'
import { prisma } from './prisma'
import { 
  AuctionState, 
  BidRequest, 
  BidResult, 
  IncrementBand, 
  ValidationResult,
  AuctionEvent as AuctionEventType,
  TeamBudget
} from '@/types/next-auth'

export class AuctionEngine extends EventEmitter {
  private auctionStates = new Map<string, AuctionState>()
  private eventSequence = new Map<string, number>()
  private timers = new Map<string, NodeJS.Timeout>()
  private extensions = new Map<string, number>()

  constructor() {
    super()
    this.setMaxListeners(100) // Allow many WebSocket connections
  }

  /**
   * Initialize auction from database
   */
  async initializeAuction(auctionId: string): Promise<AuctionState> {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        season: true,
        currentLot: {
          include: {
            player: true,
            soldTo: true,
            bids: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { team: true }
            }
          }
        },
        lots: {
          include: { player: true, soldTo: true },
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!auction) {
      throw new Error('Auction not found')
    }

    const state: AuctionState = {
      id: auctionId,
      status: auction.status as any,
      currentLotId: auction.currentLotId || undefined,
      currentLot: auction.currentLot ? {
        id: auction.currentLot.id,
        player: {
          id: auction.currentLot.player.id,
          name: auction.currentLot.player.name,
          role: auction.currentLot.player.role,
          country: auction.currentLot.player.country,
          basePrice: auction.currentLot.player.basePrice,
        },
        status: auction.currentLot.status as any,
        currentPrice: auction.currentLot.currentPrice || undefined,
        endsAt: auction.currentLot.endsAt?.toISOString(),
        soldTo: auction.currentLot.soldTo ? {
          id: auction.currentLot.soldTo.id,
          name: auction.currentLot.soldTo.name,
        } : undefined,
        finalPrice: auction.currentLot.finalPrice || undefined,
      } : undefined,
    }

    // Calculate timer if lot is in progress
    if (state.currentLot?.status === 'IN_PROGRESS' && state.currentLot.endsAt) {
      const endsAt = new Date(state.currentLot.endsAt)
      const remaining = Math.max(0, endsAt.getTime() - Date.now())
      
      state.timer = {
        remaining,
        endsAt: state.currentLot.endsAt,
        extensions: this.extensions.get(`${auctionId}:${state.currentLotId}`) || 0,
      }
    }

    this.auctionStates.set(auctionId, state)
    this.eventSequence.set(auctionId, await this.getLastEventSequence(auctionId))

    return state
  }

  /**
   * Start auction
   */
  async startAuction(auctionId: string): Promise<void> {
    const state = await this.getAuctionState(auctionId)
    
    if (state.status !== 'NOT_STARTED') {
      throw new Error('Auction cannot be started')
    }

    // Update database
    await prisma.auction.update({
      where: { id: auctionId },
      data: { status: 'IN_PROGRESS' }
    })

    // Update state
    state.status = 'IN_PROGRESS'
    this.auctionStates.set(auctionId, state)

    // Emit event
    await this.emitEvent(auctionId, {
      type: 'AUCTION_STARTED',
      data: { auctionId, timestamp: new Date().toISOString() }
    })

    // Start first lot if available
    await this.startNextLot(auctionId)
  }

  /**
   * Pause auction
   */
  async pauseAuction(auctionId: string): Promise<void> {
    const state = await this.getAuctionState(auctionId)
    
    if (state.status !== 'IN_PROGRESS') {
      throw new Error('Auction is not in progress')
    }

    // Clear any active timers
    this.clearTimer(auctionId)

    // Update database
    await prisma.auction.update({
      where: { id: auctionId },
      data: { status: 'PAUSED' }
    })

    // Update current lot if in progress
    if (state.currentLotId) {
      await prisma.lot.update({
        where: { id: state.currentLotId },
        data: { status: 'PAUSED' }
      })
    }

    // Update state
    state.status = 'PAUSED'
    if (state.currentLot) {
      state.currentLot.status = 'PAUSED'
    }
    this.auctionStates.set(auctionId, state)

    // Emit event
    await this.emitEvent(auctionId, {
      type: 'AUCTION_PAUSED',
      data: { auctionId, timestamp: new Date().toISOString() }
    })
  }

  /**
   * Resume auction
   */
  async resumeAuction(auctionId: string): Promise<void> {
    const state = await this.getAuctionState(auctionId)
    
    if (state.status !== 'PAUSED') {
      throw new Error('Auction is not paused')
    }

    // Update database
    await prisma.auction.update({
      where: { id: auctionId },
      data: { status: 'IN_PROGRESS' }
    })

    // Update current lot if paused
    if (state.currentLotId) {
      const settings = await this.getAuctionSettings(auctionId)
      const newEndsAt = new Date(Date.now() + settings.lotDuration)
      
      await prisma.lot.update({
        where: { id: state.currentLotId },
        data: { 
          status: 'IN_PROGRESS',
          endsAt: newEndsAt
        }
      })

      // Restart timer
      this.startLotTimer(auctionId, state.currentLotId, settings.lotDuration)
      
      // Update state
      if (state.currentLot) {
        state.currentLot.status = 'IN_PROGRESS'
        state.currentLot.endsAt = newEndsAt.toISOString()
        state.timer = {
          remaining: settings.lotDuration,
          endsAt: newEndsAt.toISOString(),
          extensions: this.extensions.get(`${auctionId}:${state.currentLotId}`) || 0,
        }
      }
    }

    // Update state
    state.status = 'IN_PROGRESS'
    this.auctionStates.set(auctionId, state)

    // Emit event
    await this.emitEvent(auctionId, {
      type: 'AUCTION_RESUMED',
      data: { auctionId, timestamp: new Date().toISOString() }
    })
  }

  /**
   * Start next lot
   */
  async startNextLot(auctionId: string): Promise<void> {
    const state = await this.getAuctionState(auctionId)
    
    if (state.status !== 'IN_PROGRESS') {
      throw new Error('Auction is not in progress')
    }

    // Get next queued lot
    const nextLot = await prisma.lot.findFirst({
      where: {
        auctionId,
        status: 'QUEUED'
      },
      include: { player: true },
      orderBy: { order: 'asc' }
    })

    if (!nextLot) {
      // No more lots, end auction
      await this.endAuction(auctionId)
      return
    }

    const settings = await this.getAuctionSettings(auctionId)
    const startTime = new Date()
    const endTime = new Date(startTime.getTime() + settings.lotDuration)

    // Update database
    await prisma.$transaction([
      prisma.lot.update({
        where: { id: nextLot.id },
        data: {
          status: 'IN_PROGRESS',
          currentPrice: nextLot.player.basePrice,
          startedAt: startTime,
          endsAt: endTime
        }
      }),
      prisma.auction.update({
        where: { id: auctionId },
        data: { currentLotId: nextLot.id }
      })
    ])

    // Reset extensions for this lot
    this.extensions.delete(`${auctionId}:${nextLot.id}`)

    // Update state
    state.currentLotId = nextLot.id
    state.currentLot = {
      id: nextLot.id,
      player: {
        id: nextLot.player.id,
        name: nextLot.player.name,
        role: nextLot.player.role,
        country: nextLot.player.country,
        basePrice: nextLot.player.basePrice,
      },
      status: 'IN_PROGRESS',
      currentPrice: nextLot.player.basePrice,
      endsAt: endTime.toISOString(),
    }
    state.timer = {
      remaining: settings.lotDuration,
      endsAt: endTime.toISOString(),
      extensions: 0,
    }
    this.auctionStates.set(auctionId, state)

    // Start timer
    this.startLotTimer(auctionId, nextLot.id, settings.lotDuration)

    // Emit event
    await this.emitEvent(auctionId, {
      type: 'LOT_STARTED',
      data: {
        lotId: nextLot.id,
        player: state.currentLot.player,
        basePrice: nextLot.player.basePrice,
        endsAt: endTime.toISOString()
      }
    })
  }

  /**
   * Process a bid
   */
  async processBid(auctionId: string, bid: BidRequest): Promise<BidResult> {
    const state = await this.getAuctionState(auctionId)
    
    if (state.status !== 'IN_PROGRESS') {
      return { success: false, reason: 'Auction is not in progress' }
    }

    if (!state.currentLot || state.currentLot.status !== 'IN_PROGRESS') {
      return { success: false, reason: 'No active lot' }
    }

    if (bid.lotId !== state.currentLotId) {
      return { success: false, reason: 'Bid is for inactive lot' }
    }

    // Validate bid
    const validation = await this.validateBid(auctionId, bid)
    if (!validation.valid) {
      return { success: false, reason: validation.reason }
    }

    // Calculate next valid amount
    const nextAmount = await this.calculateNextBidAmount(auctionId, state.currentLot.currentPrice!)
    
    if (bid.amount < nextAmount) {
      return { 
        success: false, 
        reason: `Minimum bid amount is ₹${nextAmount.toLocaleString()}` 
      }
    }

    // Save bid to database
    const bidRecord = await prisma.bid.create({
      data: {
        lotId: bid.lotId,
        teamId: bid.teamId,
        amount: bid.amount,
      },
      include: { team: true }
    })

    // Update lot current price
    await prisma.lot.update({
      where: { id: bid.lotId },
      data: { currentPrice: bid.amount }
    })

    // Update state
    state.currentLot.currentPrice = bid.amount
    this.auctionStates.set(auctionId, state)

    // Check for soft close
    await this.checkSoftClose(auctionId, bid.lotId)

    // Emit event
    await this.emitEvent(auctionId, {
      type: 'BID_PLACED',
      data: {
        lotId: bid.lotId,
        teamId: bid.teamId,
        teamName: bidRecord.team.name,
        amount: bid.amount,
        timestamp: bidRecord.createdAt.toISOString()
      }
    })

    return {
      success: true,
      bid: {
        id: bidRecord.id,
        amount: bid.amount,
        timestamp: bidRecord.createdAt.toISOString()
      },
      newPrice: bid.amount
    }
  }

  /**
   * Validate a bid
   */
  private async validateBid(auctionId: string, bid: BidRequest): Promise<ValidationResult> {
    // Check team budget
    const team = await prisma.team.findUnique({
      where: { id: bid.teamId },
      include: { roster: true }
    })

    if (!team) {
      return { valid: false, reason: 'Team not found' }
    }

    const remainingBudget = team.budgetTotal - team.budgetSpent
    if (bid.amount > remainingBudget) {
      return { 
        valid: false, 
        reason: `Insufficient budget. Remaining: ₹${remainingBudget.toLocaleString()}` 
      }
    }

    // Check squad constraints
    const seasonSettings = await this.getSeasonSettings(auctionId)
    if (team.roster.length >= seasonSettings.maxSquadSize) {
      return { 
        valid: false, 
        reason: `Squad is full (${seasonSettings.maxSquadSize} players)` 
      }
    }

    // Additional role-based validations could be added here

    return { valid: true }
  }

  /**
   * Calculate next valid bid amount
   */
  private async calculateNextBidAmount(auctionId: string, currentPrice: number): Promise<number> {
    const settings = await this.getAuctionSettings(auctionId)
    
    for (const band of settings.incrementBands) {
      if (currentPrice >= band.min && currentPrice < band.max) {
        return currentPrice + band.step
      }
    }
    
    // Use last band's step if price exceeds all bands
    const lastBand = settings.incrementBands[settings.incrementBands.length - 1]
    return currentPrice + lastBand.step
  }

  /**
   * Check for soft close and extend timer if needed
   */
  private async checkSoftClose(auctionId: string, lotId: string): Promise<void> {
    const state = this.auctionStates.get(auctionId)
    if (!state?.timer) return

    const settings = await this.getAuctionSettings(auctionId)
    const timeRemaining = state.timer.remaining
    const currentExtensions = this.extensions.get(`${auctionId}:${lotId}`) || 0

    if (timeRemaining <= settings.softCloseThreshold && currentExtensions < settings.maxExtensions) {
      // Extend the timer
      const newEndsAt = new Date(Date.now() + settings.softCloseExtension)
      
      await prisma.lot.update({
        where: { id: lotId },
        data: { endsAt: newEndsAt }
      })

      this.extensions.set(`${auctionId}:${lotId}`, currentExtensions + 1)

      // Clear old timer and start new one
      this.clearTimer(auctionId)
      this.startLotTimer(auctionId, lotId, settings.softCloseExtension)

      // Update state
      state.timer = {
        remaining: settings.softCloseExtension,
        endsAt: newEndsAt.toISOString(),
        extensions: currentExtensions + 1,
      }
      if (state.currentLot) {
        state.currentLot.endsAt = newEndsAt.toISOString()
      }
      this.auctionStates.set(auctionId, state)

      // Emit event
      await this.emitEvent(auctionId, {
        type: 'LOT_EXTENDED',
        data: {
          lotId,
          newEndsAt: newEndsAt.toISOString(),
          reason: 'Soft close triggered'
        }
      })
    }
  }

  /**
   * End current lot (sold or unsold)
   */
  private async endLot(auctionId: string, lotId: string): Promise<void> {
    const state = await this.getAuctionState(auctionId)
    
    if (!state.currentLot || state.currentLot.id !== lotId) {
      return
    }

    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: {
        bids: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { team: true }
        },
        player: true
      }
    })

    if (!lot) return

    const highestBid = lot.bids[0]
    
    if (highestBid) {
      // Lot sold
      await prisma.$transaction([
        prisma.lot.update({
          where: { id: lotId },
          data: {
            status: 'SOLD',
            soldToId: highestBid.teamId,
            finalPrice: highestBid.amount
          }
        }),
        prisma.roster.create({
          data: {
            teamId: highestBid.teamId,
            playerId: lot.playerId,
            price: highestBid.amount
          }
        }),
        prisma.budgetTransaction.create({
          data: {
            teamId: highestBid.teamId,
            amount: -highestBid.amount,
            type: 'PURCHASE',
            description: `Purchase of ${lot.player.name}`,
            lotId: lotId
          }
        }),
        prisma.team.update({
          where: { id: highestBid.teamId },
          data: {
            budgetSpent: {
              increment: highestBid.amount
            }
          }
        })
      ])

      // Update state
      state.currentLot.status = 'SOLD'
      state.currentLot.soldTo = {
        id: highestBid.team.id,
        name: highestBid.team.name
      }
      state.currentLot.finalPrice = highestBid.amount
      
      await this.emitEvent(auctionId, {
        type: 'LOT_SOLD',
        data: {
          lotId,
          teamId: highestBid.teamId,
          teamName: highestBid.team.name,
          finalPrice: highestBid.amount,
          player: lot.player.name
        }
      })
    } else {
      // Lot unsold
      await prisma.lot.update({
        where: { id: lotId },
        data: { status: 'UNSOLD' }
      })

      state.currentLot.status = 'UNSOLD'
      
      await this.emitEvent(auctionId, {
        type: 'LOT_UNSOLD',
        data: {
          lotId,
          player: lot.player.name
        }
      })
    }

    this.auctionStates.set(auctionId, state)

    // Clear timer and start next lot after a brief delay
    this.clearTimer(auctionId)
    setTimeout(() => {
      this.startNextLot(auctionId).catch(console.error)
    }, 3000) // 3 second delay between lots
  }

  /**
   * End auction
   */
  private async endAuction(auctionId: string): Promise<void> {
    const state = await this.getAuctionState(auctionId)
    
    await prisma.auction.update({
      where: { id: auctionId },
      data: { 
        status: 'COMPLETED',
        currentLotId: null
      }
    })

    state.status = 'COMPLETED'
    state.currentLotId = undefined
    state.currentLot = undefined
    state.timer = undefined
    this.auctionStates.set(auctionId, state)

    this.clearTimer(auctionId)

    await this.emitEvent(auctionId, {
      type: 'AUCTION_ENDED',
      data: {
        auctionId,
        timestamp: new Date().toISOString()
      }
    })
  }

  /**
   * Timer management
   */
  private startLotTimer(auctionId: string, lotId: string, duration: number): void {
    this.clearTimer(auctionId)
    
    const timer = setTimeout(() => {
      this.endLot(auctionId, lotId).catch(console.error)
    }, duration)
    
    this.timers.set(auctionId, timer)
  }

  private clearTimer(auctionId: string): void {
    const timer = this.timers.get(auctionId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(auctionId)
    }
  }

  /**
   * Event management
   */
  private async emitEvent(auctionId: string, eventData: Omit<AuctionEventType, 'id' | 'sequence' | 'timestamp'>): Promise<void> {
    const sequence = (this.eventSequence.get(auctionId) || 0) + 1
    this.eventSequence.set(auctionId, sequence)

    const event = await prisma.auctionEvent.create({
      data: {
        auctionId,
        lotId: eventData.data.lotId || null,
        type: eventData.type as any,
        data: JSON.stringify(eventData.data),
        sequence
      }
    })

    // Emit to WebSocket listeners
    this.emit('auction:event', {
      auctionId,
      event: {
        id: event.id,
        type: event.type,
        data: eventData.data,
        sequence: event.sequence,
        timestamp: event.createdAt.toISOString()
      }
    })
  }

  /**
   * Utility methods
   */
  private async getAuctionState(auctionId: string): Promise<AuctionState> {
    let state = this.auctionStates.get(auctionId)
    if (!state) {
      state = await this.initializeAuction(auctionId)
    }
    return state
  }

  private async getLastEventSequence(auctionId: string): Promise<number> {
    const lastEvent = await prisma.auctionEvent.findFirst({
      where: { auctionId },
      orderBy: { sequence: 'desc' }
    })
    return lastEvent?.sequence || 0
  }

  private async getAuctionSettings(auctionId: string): Promise<any> {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId }
    })
    
    const defaultSettings = {
      lotDuration: 30000,
      softCloseThreshold: 5000,
      softCloseExtension: 10000,
      maxExtensions: 3,
      incrementBands: [
        { min: 0, max: 2000000, step: 100000 },
        { min: 2000000, max: 10000000, step: 250000 },
        { min: 10000000, max: 50000000, step: 1000000 },
        { min: 50000000, max: 200000000, step: 2500000 },
      ]
    }

    return auction?.settings ? 
      { ...defaultSettings, ...JSON.parse(auction.settings) } : 
      defaultSettings
  }

  private async getSeasonSettings(auctionId: string): Promise<any> {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: { season: true }
    })

    const defaultSettings = {
      maxSquadSize: 20,
      maxOverseasPlayers: 4,
      minWicketKeepers: 1
    }

    return auction?.season.settings ? 
      { ...defaultSettings, ...JSON.parse(auction.season.settings) } : 
      defaultSettings
  }

  /**
   * Get team budgets for auction
   */
  async getTeamBudgets(auctionId: string): Promise<TeamBudget[]> {
    const auction = await prisma.auction.findUnique({
      where: { id: auctionId },
      include: {
        season: {
          include: {
            teams: {
              include: { roster: true }
            }
          }
        }
      }
    })

    if (!auction) return []

    return auction.season.teams.map(team => ({
      teamId: team.id,
      name: team.name,
      budgetTotal: team.budgetTotal,
      budgetSpent: team.budgetSpent,
      budgetRemaining: team.budgetTotal - team.budgetSpent,
      rosterCount: team.roster.length,
      maxSquadSize: 20 // This should come from season settings
    }))
  }

  /**
   * Force sell current lot to highest bidder
   */
  async forceSellLot(auctionId: string, lotId: string): Promise<void> {
    const state = await this.getAuctionState(auctionId)
    
    if (!state.currentLot || state.currentLot.id !== lotId) {
      throw new Error('Lot is not currently active')
    }

    this.clearTimer(auctionId)
    await this.endLot(auctionId, lotId)
  }

  /**
   * Mark current lot as unsold
   */
  async markLotUnsold(auctionId: string, lotId: string): Promise<void> {
    await prisma.lot.update({
      where: { id: lotId },
      data: { status: 'UNSOLD' }
    })

    const state = this.auctionStates.get(auctionId)
    if (state?.currentLot?.id === lotId) {
      state.currentLot.status = 'UNSOLD'
      this.auctionStates.set(auctionId, state)
    }

    this.clearTimer(auctionId)
    
    await this.emitEvent(auctionId, {
      type: 'LOT_UNSOLD',
      data: { lotId, forced: true }
    })

    setTimeout(() => {
      this.startNextLot(auctionId).catch(console.error)
    }, 3000)
  }

  /**
   * Get auction events for delta sync
   */
  async getEventsSince(auctionId: string, sinceEventId?: number): Promise<AuctionEventType[]> {
    const events = await prisma.auctionEvent.findMany({
      where: {
        auctionId,
        ...(sinceEventId && { sequence: { gt: sinceEventId } })
      },
      orderBy: { sequence: 'asc' }
    })

    return events.map(event => ({
      id: event.id,
      type: event.type,
      data: JSON.parse(event.data),
      sequence: event.sequence,
      timestamp: event.createdAt.toISOString()
    }))
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.timers.forEach(timer => clearTimeout(timer))
    this.timers.clear()
    this.auctionStates.clear()
    this.eventSequence.clear()
    this.extensions.clear()
    this.removeAllListeners()
  }
}

// Global auction engine instance
export const auctionEngine = new AuctionEngine()

// Graceful shutdown
process.on('beforeExit', () => {
  auctionEngine.destroy()
})