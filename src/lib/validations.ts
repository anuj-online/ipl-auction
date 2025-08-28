/**
 * Validation Schemas
 * Comprehensive Zod schemas for all auction system entities
 */

import { z } from 'zod'

// ============================================================================
// AUTHENTICATION & USER SCHEMAS
// ============================================================================

export const userRoleSchema = z.enum(['ADMIN', 'TEAM', 'VIEWER'])

export const userSchema = z.object({
  id: z.string().cuid().optional(),
  email: z.string().email(),
  passwordHash: z.string().optional(),
  name: z.string().min(1).max(100).optional(),
  role: userRoleSchema.default('VIEWER'),
  teamId: z.string().cuid().optional(),
})

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
})

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(100),
  role: userRoleSchema.optional(),
})

// ============================================================================
// SEASON & TOURNAMENT SCHEMAS
// ============================================================================

export const seasonStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])

export const seasonSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1).max(100),
  year: z.number().int().min(2020).max(2030),
  description: z.string().max(500).optional(),
  status: seasonStatusSchema.default('DRAFT'),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  settings: z.object({
    maxTeams: z.number().int().min(2).max(16).default(8),
    maxBudget: z.number().int().min(1000000).default(100000000), // 10 Cr default
    maxSquadSize: z.number().int().min(15).max(25).default(20),
    maxOverseasPlayers: z.number().int().min(0).max(8).default(4),
    minWicketKeepers: z.number().int().min(1).max(3).default(1),
    auctionRules: z.object({
      defaultLotDuration: z.number().int().min(10000).max(300000).default(30000),
      softCloseThreshold: z.number().int().min(1000).max(30000).default(5000),
      softCloseExtension: z.number().int().min(5000).max(60000).default(10000),
      maxExtensions: z.number().int().min(1).max(10).default(3),
      incrementBands: z.array(z.object({
        min: z.number().int().min(0),
        max: z.number().int().min(0),
        step: z.number().int().min(10000),
      })).default([
        { min: 0, max: 2000000, step: 100000 },
        { min: 2000000, max: 10000000, step: 250000 },
        { min: 10000000, max: 50000000, step: 1000000 },
        { min: 50000000, max: 200000000, step: 2500000 },
      ]),
    }).default({}),
  }).default({}),
})

// ============================================================================
// TEAM & BUDGET SCHEMAS
// ============================================================================

export const transactionTypeSchema = z.enum(['INITIAL_BUDGET', 'TOP_UP', 'PENALTY', 'PURCHASE', 'REFUND'])

export const teamSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1).max(50),
  displayName: z.string().min(1).max(50).optional(),
  budgetTotal: z.number().int().min(0),
  budgetSpent: z.number().int().min(0).default(0),
  seasonId: z.string().cuid(),
})

export const budgetTransactionSchema = z.object({
  id: z.string().cuid().optional(),
  teamId: z.string().cuid(),
  amount: z.number().int(),
  type: transactionTypeSchema,
  description: z.string().max(255).optional(),
  lotId: z.string().cuid().optional(),
})

// ============================================================================
// PLAYER & AUCTION SCHEMAS
// ============================================================================

export const playerRoleSchema = z.enum(['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'])

export const playerSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1).max(100),
  country: z.string().min(2).max(50),
  role: playerRoleSchema,
  basePrice: z.number().int().min(100000).max(50000000), // 1L to 5Cr
  seasonId: z.string().cuid(),
  stats: z.record(z.any()).optional(),
  tags: z.string().max(255).optional(),
  isOverseas: z.boolean().default(false),
})

export const auctionStatusSchema = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED'])

export const auctionSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1).max(100),
  seasonId: z.string().cuid(),
  status: auctionStatusSchema.default('NOT_STARTED'),
  currentLotId: z.string().cuid().optional(),
  settings: z.object({
    lotDuration: z.number().int().min(10000).max(300000).default(30000),
    softCloseThreshold: z.number().int().min(1000).max(30000).default(5000),
    softCloseExtension: z.number().int().min(5000).max(60000).default(10000),
    maxExtensions: z.number().int().min(1).max(10).default(3),
    allowAutoBidding: z.boolean().default(true),
  }).default({}),
})

// ============================================================================
// BIDDING & LOT SCHEMAS
// ============================================================================

export const lotStatusSchema = z.enum(['QUEUED', 'IN_PROGRESS', 'SOLD', 'UNSOLD', 'PAUSED'])

export const lotSchema = z.object({
  id: z.string().cuid().optional(),
  auctionId: z.string().cuid(),
  playerId: z.string().cuid(),
  status: lotStatusSchema.default('QUEUED'),
  currentPrice: z.number().int().min(0).optional(),
  soldToId: z.string().cuid().optional(),
  finalPrice: z.number().int().min(0).optional(),
  order: z.number().int().min(1),
  startedAt: z.date().optional(),
  endsAt: z.date().optional(),
})

export const bidSchema = z.object({
  id: z.string().cuid().optional(),
  lotId: z.string().cuid(),
  teamId: z.string().cuid(),
  amount: z.number().int().min(0),
  isValid: z.boolean().default(true),
})

// ============================================================================
// REAL-TIME EVENT SCHEMAS
// ============================================================================

export const eventTypeSchema = z.enum([
  'AUCTION_STARTED',
  'AUCTION_PAUSED',
  'AUCTION_RESUMED',
  'AUCTION_ENDED',
  'LOT_STARTED',
  'BID_PLACED',
  'LOT_SOLD',
  'LOT_UNSOLD',
  'LOT_EXTENDED',
])

export const auctionEventSchema = z.object({
  id: z.string().cuid().optional(),
  auctionId: z.string().cuid(),
  lotId: z.string().cuid().optional(),
  type: eventTypeSchema,
  data: z.record(z.any()).default({}),
  sequence: z.number().int().min(0),
})

// ============================================================================
// API RESPONSE SCHEMAS
// ============================================================================

export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
})

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate and parse data with a Zod schema
 */
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): 
  { success: true; data: T } | { success: false; error: string } {
  try {
    const parsed = schema.parse(data)
    return { success: true, data: parsed }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Validation failed'
    }
  }
}

/**
 * Safe parse with default error handling
 */
export function safeParseData<T>(schema: z.ZodSchema<T>, data: unknown, defaultValue: T): T {
  const result = validateData(schema, data)
  return result.success ? result.data : defaultValue
}

export type UserRole = z.infer<typeof userRoleSchema>
export type SeasonStatus = z.infer<typeof seasonStatusSchema>
export type PlayerRole = z.infer<typeof playerRoleSchema>
export type AuctionStatus = z.infer<typeof auctionStatusSchema>
export type LotStatus = z.infer<typeof lotStatusSchema>
export type EventType = z.infer<typeof eventTypeSchema>
export type TransactionType = z.infer<typeof transactionTypeSchema>

// ============================================================================\n// SEASON & TOURNAMENT SCHEMAS\n// ============================================================================\n\nexport const seasonStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED'])\n\nexport const seasonSchema = z.object({\n  id: z.string().cuid().optional(),\n  name: z.string().min(1).max(100),\n  year: z.number().int().min(2020).max(2030),\n  description: z.string().max(500).optional(),\n  status: seasonStatusSchema.default('DRAFT'),\n  startDate: z.date().optional(),\n  endDate: z.date().optional(),\n  settings: z.object({\n    maxTeams: z.number().int().min(2).max(16).default(8),\n    maxBudget: z.number().int().min(1000000).default(100000000), // 10 Cr default\n    maxSquadSize: z.number().int().min(15).max(25).default(20),\n    maxOverseasPlayers: z.number().int().min(0).max(8).default(4),\n    minWicketKeepers: z.number().int().min(1).max(3).default(1),\n    auctionRules: z.object({\n      defaultLotDuration: z.number().int().min(10000).max(300000).default(30000),\n      softCloseThreshold: z.number().int().min(1000).max(30000).default(5000),\n      softCloseExtension: z.number().int().min(5000).max(60000).default(10000),\n      maxExtensions: z.number().int().min(1).max(10).default(3),\n      incrementBands: z.array(z.object({\n        min: z.number().int().min(0),\n        max: z.number().int().min(0),\n        step: z.number().int().min(10000),\n      })).default([\n        { min: 0, max: 2000000, step: 100000 },\n        { min: 2000000, max: 10000000, step: 250000 },\n        { min: 10000000, max: 50000000, step: 1000000 },\n        { min: 50000000, max: 200000000, step: 2500000 },\n      ]),\n    }).default({}),\n  }).default({}),\n})\n\n// ============================================================================\n// TEAM & BUDGET SCHEMAS\n// ============================================================================\n\nexport const transactionTypeSchema = z.enum(['INITIAL_BUDGET', 'TOP_UP', 'PENALTY', 'PURCHASE', 'REFUND'])\n\nexport const teamSchema = z.object({\n  id: z.string().cuid().optional(),\n  name: z.string().min(1).max(50),\n  displayName: z.string().min(1).max(50).optional(),\n  budgetTotal: z.number().int().min(0),\n  budgetSpent: z.number().int().min(0).default(0),\n  seasonId: z.string().cuid(),\n})\n\nexport const budgetTransactionSchema = z.object({\n  id: z.string().cuid().optional(),\n  teamId: z.string().cuid(),\n  amount: z.number().int(),\n  type: transactionTypeSchema,\n  description: z.string().max(255).optional(),\n  lotId: z.string().cuid().optional(),\n})\n\n// ============================================================================\n// PLAYER & AUCTION SCHEMAS\n// ============================================================================\n\nexport const playerRoleSchema = z.enum(['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'])\n\nexport const playerSchema = z.object({\n  id: z.string().cuid().optional(),\n  name: z.string().min(1).max(100),\n  country: z.string().min(2).max(50),\n  role: playerRoleSchema,\n  basePrice: z.number().int().min(100000).max(50000000), // 1L to 5Cr\n  seasonId: z.string().cuid(),\n  stats: z.record(z.any()).optional(),\n  tags: z.string().max(255).optional(),\n  isOverseas: z.boolean().default(false),\n})\n\nexport const auctionStatusSchema = z.enum(['NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'COMPLETED'])\n\nexport const auctionSchema = z.object({\n  id: z.string().cuid().optional(),\n  name: z.string().min(1).max(100),\n  seasonId: z.string().cuid(),\n  status: auctionStatusSchema.default('NOT_STARTED'),\n  currentLotId: z.string().cuid().optional(),\n  settings: z.object({\n    lotDuration: z.number().int().min(10000).max(300000).default(30000),\n    softCloseThreshold: z.number().int().min(1000).max(30000).default(5000),\n    softCloseExtension: z.number().int().min(5000).max(60000).default(10000),\n    maxExtensions: z.number().int().min(1).max(10).default(3),\n    allowAutoBidding: z.boolean().default(true),\n  }).default({}),\n})\n\n// ============================================================================\n// BIDDING & LOT SCHEMAS\n// ============================================================================\n\nexport const lotStatusSchema = z.enum(['QUEUED', 'IN_PROGRESS', 'SOLD', 'UNSOLD', 'PAUSED'])\n\nexport const lotSchema = z.object({\n  id: z.string().cuid().optional(),\n  auctionId: z.string().cuid(),\n  playerId: z.string().cuid(),\n  status: lotStatusSchema.default('QUEUED'),\n  currentPrice: z.number().int().min(0).optional(),\n  soldToId: z.string().cuid().optional(),\n  finalPrice: z.number().int().min(0).optional(),\n  order: z.number().int().min(1),\n  startedAt: z.date().optional(),\n  endsAt: z.date().optional(),\n})\n\nexport const bidSchema = z.object({\n  id: z.string().cuid().optional(),\n  lotId: z.string().cuid(),\n  teamId: z.string().cuid(),\n  amount: z.number().int().min(0),\n  isValid: z.boolean().default(true),\n})\n\n// ============================================================================\n// REAL-TIME EVENT SCHEMAS\n// ============================================================================\n\nexport const eventTypeSchema = z.enum([\n  'AUCTION_STARTED',\n  'AUCTION_PAUSED',\n  'AUCTION_RESUMED',\n  'AUCTION_ENDED',\n  'LOT_STARTED',\n  'BID_PLACED',\n  'LOT_SOLD',\n  'LOT_UNSOLD',\n  'LOT_EXTENDED',\n])\n\nexport const auctionEventSchema = z.object({\n  id: z.string().cuid().optional(),\n  auctionId: z.string().cuid(),\n  lotId: z.string().cuid().optional(),\n  type: eventTypeSchema,\n  data: z.record(z.any()).default({}),\n  sequence: z.number().int().min(0),\n})\n\n// ============================================================================\n// WEBSOCKET ACTION SCHEMAS\n// ============================================================================\n\nexport const wsActionSchema = z.discriminatedUnion('type', [\n  z.object({\n    type: z.literal('bid.place'),\n    payload: z.object({\n      lotId: z.string().cuid(),\n      amount: z.number().int().min(0),\n      batchId: z.string().optional(),\n    }),\n  }),\n  z.object({\n    type: z.literal('bid.cancel'),\n    payload: z.object({\n      lotId: z.string().cuid(),\n      batchId: z.string().optional(),\n    }),\n  }),\n  z.object({\n    type: z.literal('watchlist.add'),\n    payload: z.object({\n      playerId: z.string().cuid(),\n      maxBid: z.number().int().min(0).optional(),\n    }),\n  }),\n  z.object({\n    type: z.literal('watchlist.remove'),\n    payload: z.object({\n      playerId: z.string().cuid(),\n    }),\n  }),\n])\n\nexport const batchActionSchema = z.object({\n  batchId: z.string(),\n  actions: z.array(wsActionSchema),\n})\n\n// ============================================================================\n// ADMIN CONTROL SCHEMAS\n// ============================================================================\n\nexport const auctionControlSchema = z.object({\n  action: z.enum(['start', 'pause', 'resume', 'end', 'nextLot', 'forceSell', 'markUnsold']),\n  data: z.record(z.any()).optional(),\n})\n\nexport const bulkPlayerImportSchema = z.object({\n  players: z.array(playerSchema.omit({ id: true })),\n  seasonId: z.string().cuid(),\n})\n\n// ============================================================================\n// API RESPONSE SCHEMAS\n// ============================================================================\n\nexport const apiResponseSchema = z.object({\n  success: z.boolean(),\n  data: z.any().optional(),\n  error: z.string().optional(),\n  message: z.string().optional(),\n})\n\nexport const paginationSchema = z.object({\n  page: z.number().int().min(1).default(1),\n  limit: z.number().int().min(1).max(100).default(20),\n  sortBy: z.string().optional(),\n  sortOrder: z.enum(['asc', 'desc']).default('desc'),\n})\n\n// ============================================================================\n// UTILITY FUNCTIONS\n// ============================================================================\n\n/**\n * Validate and parse data with a Zod schema\n */\nexport function validateData<T>(schema: z.ZodSchema<T>, data: unknown): \n  { success: true; data: T } | { success: false; error: string } {\n  try {\n    const parsed = schema.parse(data)\n    return { success: true, data: parsed }\n  } catch (error) {\n    if (error instanceof z.ZodError) {\n      return {\n        success: false,\n        error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')\n      }\n    }\n    return {\n      success: false,\n      error: error instanceof Error ? error.message : 'Validation failed'\n    }\n  }\n}\n\n/**\n * Safe parse with default error handling\n */\nexport function safeParseData<T>(schema: z.ZodSchema<T>, data: unknown, defaultValue: T): T {\n  const result = validateData(schema, data)\n  return result.success ? result.data : defaultValue\n}\n\nexport type UserRole = z.infer<typeof userRoleSchema>\nexport type SeasonStatus = z.infer<typeof seasonStatusSchema>\nexport type PlayerRole = z.infer<typeof playerRoleSchema>\nexport type AuctionStatus = z.infer<typeof auctionStatusSchema>\nexport type LotStatus = z.infer<typeof lotStatusSchema>\nexport type EventType = z.infer<typeof eventTypeSchema>\nexport type TransactionType = z.infer<typeof transactionTypeSchema>\nexport type WSAction = z.infer<typeof wsActionSchema>\nexport type BatchAction = z.infer<typeof batchActionSchema>\nexport type AuctionControl = z.infer<typeof auctionControlSchema>