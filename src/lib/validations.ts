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
// ADMIN CONTROL SCHEMAS
// ============================================================================

export const auctionControlSchema = z.object({
  action: z.enum(['start', 'pause', 'resume', 'end', 'nextLot', 'forceSell', 'markUnsold']),
  data: z.record(z.any()).optional(),
})

export const bulkPlayerImportSchema = z.object({
  players: z.array(playerSchema.omit({ id: true })),
  seasonId: z.string().cuid(),
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
export type WSAction = z.infer<typeof wsActionSchema>
export type BatchAction = z.infer<typeof batchActionSchema>
export type AuctionControl = z.infer<typeof auctionControlSchema>