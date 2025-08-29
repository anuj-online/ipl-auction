/**
 * Auction Validation API
 * Validates auction setup requirements before creation
 */

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createApiResponse, handleApiError, getQueryParams } from '@/lib/session'

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  seasonInfo: {
    teams: number
    players: number
    totalBudget: number
    estimatedPlayerValue: number
  }
}

/**
 * GET /api/auctions/validate - Validate auction setup
 */
export async function GET(request: NextRequest) {
  try {
    const params = getQueryParams(request.url)
    const seasonId = params.get('seasonId')

    if (!seasonId) {
      return createApiResponse(undefined, 'Season ID is required', 400)
    }

    // Get season details
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        teams: true,
        players: {
          where: {
            roster: {
              none: {}
            }
          }
        }
      }
    })

    if (!season) {
      return createApiResponse(undefined, 'Season not found', 404)
    }

    // Ensure season has required properties
    if (!season.teams || !Array.isArray(season.teams)) {
      return createApiResponse(undefined, 'Season teams data not found', 500)
    }
    
    if (!season.players || !Array.isArray(season.players)) {
      return createApiResponse(undefined, 'Season players data not found', 500)
    }

    const errors: string[] = []
    const warnings: string[] = []

    // Validate teams
    if (season.teams.length < 2) {
      errors.push('Minimum 2 teams required for auction')
    }

    // Validate players
    if (season.players.length < 20) {
      errors.push('Minimum 20 available players required for auction')
    }

    // Check for existing active auction
    const existingActiveAuction = await prisma.auction.findFirst({
      where: {
        seasonId,
        status: {
          in: ['IN_PROGRESS', 'PAUSED']
        }
      }
    })

    if (existingActiveAuction) {
      errors.push('An active auction already exists for this season')
    }

    // Calculate budget vs player value
    const totalBudget = season.teams.reduce((sum, team) => sum + team.budgetTotal, 0)
    const estimatedPlayerValue = season.players.reduce((sum, player) => sum + player.basePrice, 0)

    if (totalBudget < estimatedPlayerValue * 0.6) {
      warnings.push('Total team budgets may be insufficient for player acquisition')
    }

    // Validate team composition requirements
    const overseasPlayers = season.players.filter(p => p.isOverseas).length
    const localPlayers = season.players.length - overseasPlayers
    
    if (overseasPlayers > season.teams.length * 8) {
      warnings.push('High number of overseas players relative to team slots')
    }

    if (localPlayers < season.teams.length * 15) {
      warnings.push('Consider adding more local players for balanced rosters')
    }

    // Role distribution check
    const roleDistribution = season.players.reduce((acc, player) => {
      acc[player.role] = (acc[player.role] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const minRoleRequirement = Math.ceil(season.teams.length * 2) // At least 2 players per role per team
    
    // Ensure roleDistribution is properly defined before using Object.entries
    if (roleDistribution && typeof roleDistribution === 'object') {
      Object.entries(roleDistribution).forEach(([role, count]) => {
        if (count < minRoleRequirement) {
          warnings.push(`Low availability of ${role.replace('_', ' ')} players (${count} available)`)
        }
      })
    }

    const validation: ValidationResult = {
      isValid: errors.length === 0,
      errors,
      warnings,
      seasonInfo: {
        teams: season.teams.length,
        players: season.players.length,
        totalBudget,
        estimatedPlayerValue
      }
    }

    return createApiResponse(validation)
  } catch (error) {
    return handleApiError(error)
  }
}