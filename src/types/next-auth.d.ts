/**
 * NextAuth Type Extensions
 * Extend NextAuth types to include custom user properties
 */

import 'next-auth'
import 'next-auth/jwt'
import { UserRole } from '@/lib/validations'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string
      role: UserRole
      teamId?: string
      teamName?: string
    }
  }

  interface User {
    id: string
    email: string
    name?: string
    role: UserRole
    teamId?: string
    teamName?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole
    teamId?: string
    teamName?: string
  }
}

/**
 * Custom auction-related types
 */
export interface AuctionState {
  id: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED'
  currentLotId?: string
  currentLot?: {
    id: string
    player: {
      id: string
      name: string
      role: string
      country: string
      basePrice: number
    }
    status: 'QUEUED' | 'IN_PROGRESS' | 'SOLD' | 'UNSOLD' | 'PAUSED'
    currentPrice?: number
    endsAt?: string
    soldTo?: {
      id: string
      name: string
    }
    finalPrice?: number
  }
  timer?: {
    remaining: number
    endsAt: string
    extensions: number
  }
}

export interface TeamBudget {
  teamId: string
  name: string
  budgetTotal: number
  budgetSpent: number
  budgetRemaining: number
  rosterCount: number
  maxSquadSize: number
}

export interface BidRequest {
  lotId: string
  teamId: string
  amount: number
  batchId?: string
}

export interface BidResult {
  success: boolean
  bid?: {
    id: string
    amount: number
    timestamp: string
  }
  reason?: string
  error?: string
  newPrice?: number
  lot?: {
    id: string
    currentPrice: number
    status: string
  }
}

export interface WatchlistItem {
  id: string
  playerId: string
  player: {
    name: string
    role: string
    country: string
    basePrice: number
  }
  maxBid?: number
  priority?: number
}

export interface AuctionEvent {
  id: string
  type: string
  data: any
  sequence: number
  timestamp: string
}

export interface WebSocketMessage {
  type: string
  payload: any
  timestamp: string
  sequence?: number
}

export interface IncrementBand {
  min: number
  max: number
  step: number
}

export interface AuctionSettings {
  lotDuration: number
  softCloseThreshold: number
  softCloseExtension: number
  maxExtensions: number
  incrementBands: IncrementBand[]
  allowAutoBidding: boolean
}

export interface SeasonSettings {
  maxTeams: number
  maxBudget: number
  maxSquadSize: number
  maxOverseasPlayers: number
  minWicketKeepers: number
  auctionRules: AuctionSettings
}

export interface PlayerStats {
  matches?: number
  runs?: number
  wickets?: number
  average?: number
  strikeRate?: number
  economy?: number
  [key: string]: any
}

export interface RosterConstraints {
  maxSquadSize: number
  maxOverseasPlayers: number
  minWicketKeepers: number
  roleDistribution?: {
    [role: string]: { min: number; max: number }
  }
}

export interface ValidationResult {
  valid: boolean
  reason?: string
  constraints?: {
    budget: boolean
    squad: boolean
    role: boolean
    overseas: boolean
  }
}

export interface AgentAction {
  type: string
  payload: any
  batchId?: string
  sequence?: number
}

export interface BatchRequest {
  batchId: string
  actions: AgentAction[]
}

export interface DeltaSync {
  sinceEventId?: number
  events: AuctionEvent[]
  currentState: AuctionState
}

export interface AdminControls {
  canStart: boolean
  canPause: boolean
  canResume: boolean
  canEnd: boolean
  canNextLot: boolean
  canForceSell: boolean
  canMarkUnsold: boolean
}

export interface AuctionMetrics {
  totalLots: number
  completedLots: number
  soldLots: number
  unsoldLots: number
  totalValue: number
  averagePrice: number
  highestBid: number
  activeBidders: number
}

export interface LeaderboardEntry {
  teamId: string
  teamName: string
  budgetSpent: number
  budgetRemaining: number
  playersAcquired: number
  averagePrice: number
  lastActivity: string
}"