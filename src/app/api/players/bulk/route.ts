/**
 * Players Bulk Operations API Route
 * Bulk management operations for players
 */

import { NextRequest } from 'next/server'
import { withAdmin, createApiResponse, handleApiError, parseJsonBody } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const bulkPlayerSchema = z.object({
  operation: z.enum(['update', 'delete', 'transfer', 'reset']),
  players: z.array(z.object({
    id: z.string(),
    name: z.string().optional(),
    role: z.enum(['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']).optional(),
    country: z.string().optional(),
    basePrice: z.number().min(0).optional(),
    isAvailable: z.boolean().optional(),
    newSeasonId: z.string().optional(), // For transfer operation
    stats: z.record(z.any()).optional()
  })).min(1, 'At least one player is required')
})

/**
 * POST /api/players/bulk - Bulk player operations (Admin only)
 */
export const POST = withAdmin(async (request: NextRequest, user) => {
  try {
    const body = await parseJsonBody(request)
    const validation = bulkPlayerSchema.safeParse(body)

    if (!validation.success) {
      return createApiResponse(
        undefined, 
        validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '), 
        400
      )
    }

    const { operation, players } = validation.data

    let result: any = {}

    switch (operation) {
      case 'update':
        result = await bulkUpdatePlayers(players, user.id)
        break
        
      case 'delete':
        result = await bulkDeletePlayers(players, user.id)
        break
        
      case 'transfer':
        result = await bulkTransferPlayers(players, user.id)
        break
        
      case 'reset':
        result = await bulkResetPlayers(players, user.id)
        break
        
      default:
        return createApiResponse(undefined, 'Invalid operation', 400)
    }

    console.log(`Admin ${user.email} executed bulk ${operation} for ${players.length} players`)

    return createApiResponse(result)

  } catch (error) {
    console.error('Bulk player operation failed:', error)
    return handleApiError(error)
  }
})

async function bulkUpdatePlayers(players: any[], userId: string) {
  const results = {
    updated: 0,
    failed: 0,
    errors: [] as string[]
  }

  for (const player of players) {
    try {
      const updateData: any = {}
      
      if (player.name) updateData.name = player.name.trim()
      if (player.role) updateData.role = player.role
      if (player.country) updateData.country = player.country.trim()
      if (player.basePrice !== undefined) updateData.basePrice = player.basePrice
      if (player.isAvailable !== undefined) updateData.isAvailable = player.isAvailable
      if (player.stats) updateData.stats = player.stats

      if (Object.keys(updateData).length > 0) {
        updateData.updatedBy = userId
        
        await prisma.player.update({
          where: { id: player.id },
          data: updateData
        })
        
        results.updated++
      }
    } catch (error) {
      results.failed++
      results.errors.push(`Failed to update player ${player.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return results
}

async function bulkDeletePlayers(players: any[], userId: string) {
  const playerIds = players.map(player => player.id)
  
  // Check for players that are in active auctions or have roster assignments
  const playersWithConstraints = await prisma.player.findMany({
    where: {
      id: { in: playerIds }
    },
    include: {
      roster: { take: 1 },
      lots: { 
        take: 1,
        where: {
          status: 'IN_PROGRESS'
        }
      },
      _count: {
        select: {
          roster: true,
          lots: true
        }
      }
    }
  })

  const safeToDelete = playersWithConstraints.filter(player => 
    player._count.roster === 0 && player._count.lots === 0
  ).map(player => player.id)

  const cannotDelete = playersWithConstraints.filter(player => 
    player._count.roster > 0 || player._count.lots > 0
  )

  let deleted = 0
  if (safeToDelete.length > 0) {
    const deleteResult = await prisma.player.deleteMany({
      where: {
        id: { in: safeToDelete }
      }
    })
    deleted = deleteResult.count
  }

  return {
    deleted,
    skipped: cannotDelete.length,
    total: playerIds.length,
    errors: cannotDelete.length > 0 ? 
      [`Cannot delete ${cannotDelete.length} players that are assigned to teams or in active auctions`] : []
  }
}

async function bulkTransferPlayers(players: any[], userId: string) {
  const results = {
    transferred: 0,
    failed: 0,
    errors: [] as string[]
  }

  for (const player of players) {
    if (!player.newSeasonId) {
      results.failed++
      results.errors.push(`Player ${player.id}: New season ID is required for transfer`)
      continue
    }

    try {
      // Check if target season exists
      const targetSeason = await prisma.season.findUnique({
        where: { id: player.newSeasonId },
        select: { id: true, name: true }
      })

      if (!targetSeason) {
        results.failed++
        results.errors.push(`Player ${player.id}: Target season not found`)
        continue
      }

      // Check if player is already in target season
      const existingPlayer = await prisma.player.findFirst({
        where: {
          name: player.name || '',
          seasonId: player.newSeasonId
        }
      })

      if (existingPlayer) {
        results.failed++
        results.errors.push(`Player ${player.id}: Already exists in target season`)
        continue
      }

      // Get player data
      const currentPlayer = await prisma.player.findUnique({
        where: { id: player.id },
        include: {
          roster: true,
          lots: {
            where: { status: 'IN_PROGRESS' }
          }
        }
      })

      if (!currentPlayer) {
        results.failed++
        results.errors.push(`Player ${player.id}: Player not found`)
        continue
      }

      // Check if player can be transferred (not in active auction or roster)
      if (currentPlayer.roster.length > 0 || currentPlayer.lots.length > 0) {
        results.failed++
        results.errors.push(`Player ${player.id}: Cannot transfer player in active auction or assigned to team`)
        continue
      }

      // Create new player in target season
      await prisma.player.create({
        data: {
          name: currentPlayer.name,
          role: currentPlayer.role,
          country: currentPlayer.country,
          basePrice: currentPlayer.basePrice,
          stats: currentPlayer.stats,
          isAvailable: true,
          seasonId: player.newSeasonId,
          createdBy: userId
        }
      })

      // Delete from current season
      await prisma.player.delete({
        where: { id: player.id }
      })

      results.transferred++

    } catch (error) {
      results.failed++
      results.errors.push(`Failed to transfer player ${player.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return results
}

async function bulkResetPlayers(players: any[], userId: string) {
  const playerIds = players.map(player => player.id)
  
  // Reset players to available state and remove from any rosters
  const results = {
    reset: 0,
    failed: 0,
    errors: [] as string[]
  }

  try {
    // Remove from rosters first
    await prisma.roster.deleteMany({
      where: {
        playerId: { in: playerIds }
      }
    })

    // Reset player availability
    const updateResult = await prisma.player.updateMany({
      where: {
        id: { in: playerIds }
      },
      data: {
        isAvailable: true,
        updatedBy: userId
      }
    })

    results.reset = updateResult.count

  } catch (error) {
    results.failed = playerIds.length
    results.errors.push(`Failed to reset players: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return results
}