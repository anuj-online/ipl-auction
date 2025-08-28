/**
 * Players Import API Route
 * Bulk import players from uploaded data
 */

import { NextRequest } from 'next/server'
import { withAdmin, createApiResponse, handleApiError, parseJsonBody } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const playerImportSchema = z.object({
  seasonId: z.string().min(1, 'Season ID is required'),
  players: z.array(z.object({
    name: z.string().min(1, 'Player name is required'),
    role: z.enum(['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'], {
      errorMap: () => ({ message: 'Role must be BATSMAN, BOWLER, ALL_ROUNDER, or WICKET_KEEPER' })
    }),
    country: z.string().min(1, 'Country is required'),
    basePrice: z.number().min(2000000, 'Base price must be at least ₹20L'),
    stats: z.record(z.any()).optional()
  })).min(1, 'At least one player is required')
})

/**
 * POST /api/players/import - Bulk import players (Admin only)
 */
export const POST = withAdmin(async (request: NextRequest, user) => {
  try {
    const body = await parseJsonBody(request)
    const validation = playerImportSchema.safeParse(body)

    if (!validation.success) {
      return createApiResponse(
        undefined, 
        validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '), 
        400
      )
    }

    const { seasonId, players } = validation.data

    // Verify season exists
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      select: { id: true, name: true }
    })

    if (!season) {
      return createApiResponse(undefined, 'Season not found', 404)
    }

    // Get existing players in this season to avoid duplicates
    const existingPlayers = await prisma.player.findMany({
      where: { 
        seasonId,
        name: { 
          in: players.map(p => p.name) 
        }
      },
      select: { name: true }
    })

    const existingPlayerNames = new Set(existingPlayers.map(p => p.name.toLowerCase()))
    
    // Filter out duplicates
    const newPlayers = players.filter(p => !existingPlayerNames.has(p.name.toLowerCase()))
    const duplicateCount = players.length - newPlayers.length

    if (newPlayers.length === 0) {
      return createApiResponse(
        { imported: 0, skipped: duplicateCount },
        'All players already exist in this season',
        200
      )
    }

    // Batch insert new players
    const insertData = newPlayers.map(player => ({
      name: player.name.trim(),
      role: player.role,
      country: player.country.trim(),
      basePrice: player.basePrice,
      seasonId,
      stats: player.stats || {},
      isAvailable: true,
      createdBy: user.id
    }))

    const result = await prisma.player.createMany({
      data: insertData,
      skipDuplicates: true
    })

    console.log(`Admin ${user.email} imported ${result.count} players to season ${season.name}`)

    return createApiResponse({
      imported: result.count,
      skipped: duplicateCount,
      total: players.length,
      message: `Successfully imported ${result.count} players. ${duplicateCount} duplicates were skipped.`
    })

  } catch (error) {
    console.error('Failed to import players:', error)
    return handleApiError(error)
  }
})