/**
 * Agent Mode Optimization
 * Batch operations, delta sync, and minimal request patterns for automated bidding agents
 */

import { z } from 'zod'
import { prisma } from './prisma'
import { UserRole } from './validations'

// Agent Configuration Schema
export const AgentConfigSchema = z.object({
  teamId: z.string(),
  enabled: z.boolean().default(false),
  maxBudget: z.number().positive(),
  maxBidAmount: z.number().positive(),
  bidStrategy: z.enum(['CONSERVATIVE', 'AGGRESSIVE', 'BALANCED']).default('BALANCED'),
  targetPositions: z.array(z.string()).default([]),
  bidDelayMs: z.number().min(100).max(5000).default(1000),
  maxBidsPerLot: z.number().min(1).max(10).default(3)
})

export type AgentConfig = z.infer<typeof AgentConfigSchema>

// Batch Operation Schemas
export const BatchBidSchema = z.object({
  lotId: z.string(),
  amount: z.number().positive(),
  maxAmount: z.number().positive().optional(),
  conditions: z.object({
    timeRemaining: z.number().optional(),
    maxCompetitors: z.number().optional(),
    positionRequired: z.string().optional()
  }).optional()
})

export const BatchOperationSchema = z.object({
  bids: z.array(BatchBidSchema).max(10),
  timestamp: z.number(),
  agentId: z.string()
})

// Delta Sync Schema for efficient state updates
export const DeltaSyncRequestSchema = z.object({
  lastSync: z.number(),
  subscriptions: z.array(z.enum(['auction', 'lots', 'bids', 'teams'])),
  agentId: z.string()
})

export const DeltaSyncResponseSchema = z.object({
  timestamp: z.number(),
  changes: z.object({
    auction: z.any().optional(),
    lots: z.array(z.any()).optional(),
    bids: z.array(z.any()).optional(),
    teams: z.array(z.any()).optional()
  }),
  hasMore: z.boolean()
})

// Agent Bidding Engine
export class AgentBiddingEngine {
  private config: AgentConfig
  private lastBidTime: number = 0
  private bidCount: number = 0
  private deltaCache: Map<string, any> = new Map()

  constructor(config: AgentConfig) {
    this.config = AgentConfigSchema.parse(config)
  }

  /**
   * Process batch bid operations
   */
  async processBatchBids(operations: z.infer<typeof BatchOperationSchema>) {
    const validatedOps = BatchOperationSchema.parse(operations)
    const results = []

    for (const bid of validatedOps.bids) {
      try {
        const result = await this.processSingleBid(bid)
        results.push(result)
      } catch (error) {
        results.push({
          lotId: bid.lotId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return {
      processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    }
  }

  /**
   * Process individual bid with agent rules
   */
  private async processSingleBid(bid: z.infer<typeof BatchBidSchema>) {
    // Rate limiting
    const now = Date.now()
    if (now - this.lastBidTime < this.config.bidDelayMs) {
      throw new Error('Rate limit exceeded')
    }

    // Check bid count limit per lot
    if (this.bidCount >= this.config.maxBidsPerLot) {
      throw new Error('Max bids per lot exceeded')
    }

    // Validate bid conditions
    if (bid.conditions) {
      const conditionsMet = await this.checkBidConditions(bid.lotId, bid.conditions)
      if (!conditionsMet) {
        throw new Error('Bid conditions not met')
      }
    }

    // Get current lot state
    const lot = await prisma.lot.findUnique({
      where: { id: bid.lotId },
      include: {
        player: true,
        auction: true,
        _count: { select: { bids: true } }
      }
    })

    if (!lot || lot.status !== 'ACTIVE') {
      throw new Error('Lot not available for bidding')
    }

    // Calculate strategic bid amount
    const strategicAmount = this.calculateStrategicBid(
      lot.currentPrice,
      bid.amount,
      bid.maxAmount || bid.amount,
      lot._count.bids
    )

    // Place bid
    const placedBid = await prisma.bid.create({
      data: {
        lotId: bid.lotId,
        teamId: this.config.teamId,
        amount: strategicAmount,
        isAutoBid: true,
        placedAt: new Date(),
        agentConfig: JSON.stringify(this.config)
      }
    })

    // Update lot current price
    await prisma.lot.update({
      where: { id: bid.lotId },
      data: { currentPrice: strategicAmount }
    })

    this.lastBidTime = now
    this.bidCount++

    return {
      lotId: bid.lotId,
      success: true,
      bidId: placedBid.id,
      amount: strategicAmount,
      timestamp: now
    }
  }

  /**
   * Calculate strategic bid amount based on configuration
   */
  private calculateStrategicBid(
    currentPrice: number,
    requestedAmount: number,
    maxAmount: number,
    competitorCount: number
  ): number {
    const baseIncrement = Math.max(currentPrice * 0.05, 500000) // 5% or 5L minimum

    switch (this.config.bidStrategy) {
      case 'CONSERVATIVE':
        return Math.min(currentPrice + baseIncrement, maxAmount)
      
      case 'AGGRESSIVE':
        const aggressiveIncrement = baseIncrement * (1 + competitorCount * 0.1)
        return Math.min(currentPrice + aggressiveIncrement, maxAmount)
      
      case 'BALANCED':
      default:
        const balancedIncrement = baseIncrement * (1 + competitorCount * 0.05)
        return Math.min(
          Math.max(requestedAmount, currentPrice + balancedIncrement),
          maxAmount
        )
    }
  }

  /**
   * Check if bid conditions are met
   */
  private async checkBidConditions(
    lotId: string,
    conditions: NonNullable<z.infer<typeof BatchBidSchema>['conditions']>
  ): Promise<boolean> {
    const lot = await prisma.lot.findUnique({
      where: { id: lotId },
      include: { player: true, auction: true }
    })

    if (!lot) return false

    // Check time remaining
    if (conditions.timeRemaining) {
      const timeLeft = new Date(lot.endsAt).getTime() - Date.now()
      if (timeLeft < conditions.timeRemaining) return false
    }

    // Check max competitors
    if (conditions.maxCompetitors) {
      const bidCount = await prisma.bid.count({
        where: { lotId },
        distinct: ['teamId']
      })
      if (bidCount > conditions.maxCompetitors) return false
    }

    // Check position requirement
    if (conditions.positionRequired) {
      if (lot.player.position !== conditions.positionRequired) return false
    }

    return true
  }
}

/**
 * Delta Sync Manager for efficient state updates
 */
export class DeltaSyncManager {
  private lastSyncTimes: Map<string, number> = new Map()
  private subscriptions: Map<string, Set<string>> = new Map()

  /**
   * Register agent for delta sync
   */
  registerAgent(agentId: string, subscriptions: string[]) {
    this.subscriptions.set(agentId, new Set(subscriptions))
    this.lastSyncTimes.set(agentId, Date.now())
  }

  /**
   * Get delta changes since last sync
   */
  async getDeltaChanges(request: z.infer<typeof DeltaSyncRequestSchema>) {
    const validatedRequest = DeltaSyncRequestSchema.parse(request)
    const { lastSync, subscriptions, agentId } = validatedRequest

    const changes: any = {}

    // Get auction changes
    if (subscriptions.includes('auction')) {
      const auction = await prisma.auction.findFirst({
        where: {
          status: { in: ['ACTIVE', 'PAUSED'] },
          updatedAt: { gt: new Date(lastSync) }
        },
        include: {
          currentLot: {
            include: { player: true }
          }
        }
      })
      if (auction) changes.auction = auction
    }

    // Get lot changes
    if (subscriptions.includes('lots')) {
      const lots = await prisma.lot.findMany({
        where: {
          updatedAt: { gt: new Date(lastSync) },
          status: { in: ['UPCOMING', 'ACTIVE', 'SOLD'] }
        },
        include: {
          player: true,
          winningBid: { include: { team: true } },
          _count: { select: { bids: true } }
        },
        orderBy: { lotNumber: 'asc' },
        take: 50
      })
      if (lots.length > 0) changes.lots = lots
    }

    // Get bid changes
    if (subscriptions.includes('bids')) {
      const bids = await prisma.bid.findMany({
        where: {
          placedAt: { gt: new Date(lastSync) }
        },
        include: {
          team: { select: { id: true, name: true } },
          lot: { select: { id: true, lotNumber: true } }
        },
        orderBy: { placedAt: 'desc' },
        take: 100
      })
      if (bids.length > 0) changes.bids = bids
    }

    // Get team changes
    if (subscriptions.includes('teams')) {
      const teams = await prisma.team.findMany({
        where: {
          updatedAt: { gt: new Date(lastSync) }
        },
        include: {
          _count: { select: { players: true } }
        }
      })
      if (teams.length > 0) changes.teams = teams
    }

    // Update last sync time
    this.lastSyncTimes.set(agentId, Date.now())

    return {
      timestamp: Date.now(),
      changes,
      hasMore: false // Could implement pagination if needed
    }
  }
}

/**
 * Agent Performance Monitor
 */
export class AgentPerformanceMonitor {
  async getAgentStats(teamId: string, since?: Date) {
    const sinceDate = since || new Date(Date.now() - 24 * 60 * 60 * 1000) // 24h ago

    const stats = await prisma.bid.aggregate({
      where: {
        teamId,
        isAutoBid: true,
        placedAt: { gte: sinceDate }
      },
      _count: { id: true },
      _avg: { amount: true },
      _max: { amount: true },
      _min: { amount: true }
    })

    const winningBids = await prisma.bid.count({
      where: {
        teamId,
        isAutoBid: true,
        placedAt: { gte: sinceDate },
        lot: { status: 'SOLD', winningBidId: { not: null } }
      }
    })

    const totalSpent = await prisma.bid.aggregate({
      where: {
        teamId,
        isAutoBid: true,
        placedAt: { gte: sinceDate },
        lot: { status: 'SOLD', winningBidId: { not: null } }
      },
      _sum: { amount: true }
    })

    return {
      totalBids: stats._count.id,
      averageBid: stats._avg.amount || 0,
      highestBid: stats._max.amount || 0,
      lowestBid: stats._min.amount || 0,
      winningBids,
      totalSpent: totalSpent._sum.amount || 0,
      winRate: stats._count.id > 0 ? (winningBids / stats._count.id) * 100 : 0
    }
  }
}

/**
 * Batch API Utilities
 */
export const batchApiUtils = {
  /**
   * Compress multiple API requests into single batch
   */
  createBatchRequest: (operations: any[]) => ({
    operations,
    timestamp: Date.now(),
    compressed: true
  }),

  /**
   * Process batch response with error handling
   */
  processBatchResponse: (response: any) => {
    if (!response.results) return { success: false, error: 'Invalid batch response' }
    
    const successful = response.results.filter((r: any) => r.success)
    const failed = response.results.filter((r: any) => !r.success)
    
    return {
      success: true,
      total: response.results.length,
      successful: successful.length,
      failed: failed.length,
      results: response.results
    }
  },

  /**
   * Rate limit handler for agent requests
   */
  rateLimitHandler: (lastRequest: number, minInterval: number = 1000) => {
    const now = Date.now()
    const elapsed = now - lastRequest
    
    if (elapsed < minInterval) {
      const delay = minInterval - elapsed
      return { shouldDelay: true, delay }
    }
    
    return { shouldDelay: false, delay: 0 }
  }
}

/**
 * WebSocket Agent Adapter
 */
export class WebSocketAgentAdapter {
  private ws: WebSocket | null = null
  private messageQueue: any[] = []
  private isConnected = false

  constructor(private agentId: string, private config: AgentConfig) {}

  connect(url: string) {
    this.ws = new WebSocket(`${url}?agentId=${this.agentId}&mode=agent`)
    
    this.ws.onopen = () => {
      this.isConnected = true
      this.flushMessageQueue()
    }

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      this.handleMessage(message)
    }

    this.ws.onclose = () => {
      this.isConnected = false
      // Implement reconnection logic
      setTimeout(() => this.connect(url), 5000)
    }
  }

  private handleMessage(message: any) {
    // Process incoming auction updates for agent
    switch (message.type) {
      case 'lot_update':
        this.onLotUpdate(message.payload)
        break
      case 'bid_placed':
        this.onBidPlaced(message.payload)
        break
      case 'auction_state':
        this.onAuctionState(message.payload)
        break
    }
  }

  private onLotUpdate(lot: any) {
    // Agent-specific lot update logic
  }

  private onBidPlaced(bid: any) {
    // Agent-specific bid response logic
  }

  private onAuctionState(state: any) {
    // Agent-specific auction state logic
  }

  sendBatchBids(bids: any[]) {
    const message = {
      type: 'batch_bids',
      payload: { bids, agentId: this.agentId },
      timestamp: Date.now()
    }

    if (this.isConnected && this.ws) {
      this.ws.send(JSON.stringify(message))
    } else {
      this.messageQueue.push(message)
    }
  }

  private flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      if (this.ws) {
        this.ws.send(JSON.stringify(message))
      }
    }
  }
}

export {
  DeltaSyncRequestSchema,
  DeltaSyncResponseSchema,
  BatchOperationSchema,
  BatchBidSchema
}