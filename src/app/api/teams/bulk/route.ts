/**
 * Teams Bulk Operations API Route
 * Bulk management operations for teams
 */

import { NextRequest } from 'next/server'
import { withAdmin, createApiResponse, handleApiError, parseJsonBody } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const bulkTeamSchema = z.object({
  operation: z.enum(['create', 'update', 'delete']),
  teams: z.array(z.object({
    id: z.string().optional(), // Required for update/delete
    name: z.string().min(1).optional(),
    displayName: z.string().optional(),
    budgetTotal: z.number().min(0).optional(),
    seasonId: z.string().optional(),
  })).min(1, 'At least one team is required')
})

/**
 * POST /api/teams/bulk - Bulk team operations (Admin only)
 */
export const POST = withAdmin(async (request: NextRequest, user) => {
  try {
    const body = await parseJsonBody(request)
    const validation = bulkTeamSchema.safeParse(body)

    if (!validation.success) {
      return createApiResponse(
        undefined, 
        validation.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', '), 
        400
      )
    }

    const { operation, teams } = validation.data

    let result: any = {}

    switch (operation) {
      case 'create':
        result = await bulkCreateTeams(teams, user.id)
        break
        
      case 'update':
        result = await bulkUpdateTeams(teams, user.id)
        break
        
      case 'delete':
        result = await bulkDeleteTeams(teams, user.id)
        break
        
      default:
        return createApiResponse(undefined, 'Invalid operation', 400)
    }

    console.log(`Admin ${user.email} executed bulk ${operation} for ${teams.length} teams`)

    return createApiResponse(result)

  } catch (error) {
    console.error('Bulk team operation failed:', error)
    return handleApiError(error)
  }
})

async function bulkCreateTeams(teams: any[], userId: string) {
  const validTeams = teams.filter(team => team.name && team.seasonId)
  
  if (validTeams.length === 0) {
    throw new Error('No valid teams to create')
  }

  // Check for existing teams with same names in the seasons
  const existingTeams = await prisma.team.findMany({
    where: {
      OR: validTeams.map(team => ({
        name: team.name,
        seasonId: team.seasonId
      }))
    },
    select: { name: true, seasonId: true }
  })

  const existingKeys = new Set(
    existingTeams.map(team => `${team.name}-${team.seasonId}`)
  )

  const newTeams = validTeams.filter(team => 
    !existingKeys.has(`${team.name}-${team.seasonId}`)
  )

  if (newTeams.length === 0) {
    return {
      created: 0,
      skipped: validTeams.length,
      errors: [`All teams already exist`]
    }
  }

  const insertData = newTeams.map(team => ({
    name: team.name.trim(),
    displayName: team.displayName?.trim() || team.name.trim(),
    budgetTotal: team.budgetTotal || 100000000, // Default 10 Cr
    budgetRemaining: team.budgetTotal || 100000000,
    seasonId: team.seasonId,
    createdBy: userId
  }))

  const createResult = await prisma.team.createMany({
    data: insertData,
    skipDuplicates: true
  })

  return {
    created: createResult.count,
    skipped: validTeams.length - newTeams.length,
    total: teams.length,
    errors: teams.length > validTeams.length ? ['Some teams had missing required fields'] : []
  }
}

async function bulkUpdateTeams(teams: any[], userId: string) {
  const validTeams = teams.filter(team => team.id)
  
  if (validTeams.length === 0) {
    throw new Error('No valid team IDs provided for update')
  }

  const results = {
    updated: 0,
    failed: 0,
    errors: [] as string[]
  }

  for (const team of validTeams) {
    try {
      const updateData: any = {}
      
      if (team.name) updateData.name = team.name.trim()
      if (team.displayName) updateData.displayName = team.displayName.trim()
      if (team.budgetTotal !== undefined) {
        updateData.budgetTotal = team.budgetTotal
        // Update remaining budget proportionally if it was at max
        const existingTeam = await prisma.team.findUnique({
          where: { id: team.id },
          select: { budgetTotal: true, budgetRemaining: true }
        })
        
        if (existingTeam && existingTeam.budgetRemaining === existingTeam.budgetTotal) {
          updateData.budgetRemaining = team.budgetTotal
        }
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updatedBy = userId
        
        await prisma.team.update({
          where: { id: team.id },
          data: updateData
        })
        
        results.updated++
      }
    } catch (error) {
      results.failed++
      results.errors.push(`Failed to update team ${team.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  return results
}

async function bulkDeleteTeams(teams: any[], userId: string) {
  const teamIds = teams.map(team => team.id).filter(Boolean)
  
  if (teamIds.length === 0) {
    throw new Error('No valid team IDs provided for deletion')
  }

  // Check for teams that have players or are in active auctions
  const teamsWithConstraints = await prisma.team.findMany({
    where: {
      id: { in: teamIds }
    },
    include: {
      roster: { take: 1 },
      bids: { take: 1 },
      _count: {
        select: {
          roster: true,
          bids: true
        }
      }
    }
  })

  const safeToDelete = teamsWithConstraints.filter(team => 
    team._count.roster === 0 && team._count.bids === 0
  ).map(team => team.id)

  const cannotDelete = teamsWithConstraints.filter(team => 
    team._count.roster > 0 || team._count.bids > 0
  )

  let deleted = 0
  if (safeToDelete.length > 0) {
    const deleteResult = await prisma.team.deleteMany({
      where: {
        id: { in: safeToDelete }
      }
    })
    deleted = deleteResult.count
  }

  return {
    deleted,
    skipped: cannotDelete.length,
    total: teamIds.length,
    errors: cannotDelete.length > 0 ? 
      [`Cannot delete ${cannotDelete.length} teams that have players or bid history`] : []
  }
}