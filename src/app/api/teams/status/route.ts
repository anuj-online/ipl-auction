/**
 * Team Status API Route
 * Real-time team status monitoring for admin dashboard
 */

import { NextRequest } from 'next/server'
import { withAdmin, createApiResponse, handleApiError } from '@/lib/session'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/teams/status - Get real-time team status (Admin only)
 */
export const GET = withAdmin(async (request: NextRequest, user) => {
  try {
    const url = new URL(request.url)
    const seasonId = url.searchParams.get('seasonId')
    
    // Build where clause for filtering
    const whereClause: any = {}
    if (seasonId) {
      whereClause.seasonId = seasonId
    }

    const teams = await prisma.team.findMany({
      where: whereClause,
      include: {
        season: {
          select: {
            id: true,
            name: true,
            year: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            roster: true,
            bids: true,
          },
        },
        bids: {
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            createdAt: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Calculate team statuses
    const teamStatuses = teams.map(team => {
      const lastBid = team.bids[0]
      const lastActivity = lastBid?.createdAt || team.createdAt
      const minutesSinceActivity = Math.floor(
        (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60)
      )
      
      return {
        id: team.id,
        name: team.name,
        displayName: team.displayName,
        budgetTotal: team.budgetTotal,
        budgetSpent: team.budgetSpent,
        budgetRemaining: team.budgetTotal - team.budgetSpent,
        rosterCount: team._count.roster,
        bidCount: team._count.bids,
        lastActivity: lastActivity,
        minutesSinceActivity,
        isActive: minutesSinceActivity < 5, // Active if bid within last 5 minutes
        users: team.users,
        season: team.season,
        budgetUtilization: ((team.budgetSpent / team.budgetTotal) * 100).toFixed(1),
      }
    })

    // Calculate summary statistics
    const totalBudget = teamStatuses.reduce((sum, team) => sum + team.budgetTotal, 0)
    const totalSpent = teamStatuses.reduce((sum, team) => sum + team.budgetSpent, 0)
    const totalRoster = teamStatuses.reduce((sum, team) => sum + team.rosterCount, 0)
    const activeTeams = teamStatuses.filter(team => team.isActive).length

    return createApiResponse({
      teams: teamStatuses,
      summary: {
        totalTeams: teamStatuses.length,
        activeTeams,
        totalBudget,
        totalSpent,
        totalRemaining: totalBudget - totalSpent,
        totalRoster,
        averageSpend: teamStatuses.length > 0 ? Math.round(totalSpent / teamStatuses.length) : 0,
        utilizationRate: totalBudget > 0 ? ((totalSpent / totalBudget) * 100).toFixed(1) : '0',
      },
    })
  } catch (error) {
    console.error('Failed to fetch team status:', error)
    return handleApiError(error)
  }
})

/**
 * POST /api/teams/status - Force refresh team status (Admin only)
 * This can be used to trigger recalculation of team statuses
 */
export const POST = withAdmin(async (request: NextRequest, user) => {
  try {
    // This endpoint can be used to trigger status refresh
    // For now, it just returns the current status
    const getResponse = await GET(request, user)
    return getResponse
  } catch (error) {
    console.error('Failed to refresh team status:', error)
    return handleApiError(error)
  }
})