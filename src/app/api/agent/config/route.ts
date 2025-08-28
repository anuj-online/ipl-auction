/**
 * Agent Configuration API
 * Manage automated bidding agent settings and performance monitoring
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  AgentConfigSchema, 
  AgentPerformanceMonitor 
} from '@/lib/agent-mode'
import { prisma } from '@/lib/prisma'

const performanceMonitor = new AgentPerformanceMonitor()

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'TEAM' || !session.user.teamId) {
      return NextResponse.json(
        { success: false, error: 'Team access required' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('includeStats') === 'true'

    // Get team agent configuration
    const team = await prisma.team.findUnique({
      where: { id: session.user.teamId },
      select: {
        id: true,
        name: true,
        agentConfig: true,
        budgetRemaining: true
      }
    })

    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      )
    }

    const response: any = {
      teamId: team.id,
      teamName: team.name,
      agentConfig: team.agentConfig || {
        enabled: false,
        maxBudget: team.budgetRemaining,
        maxBidAmount: Math.min(10000000, team.budgetRemaining), // 1 Cr max
        bidStrategy: 'BALANCED',
        targetPositions: [],
        bidDelayMs: 1000,
        maxBidsPerLot: 3
      }
    }

    // Include performance statistics if requested
    if (includeStats && team.agentConfig?.enabled) {
      const stats = await performanceMonitor.getAgentStats(team.id)
      response.performance = stats
    }

    return NextResponse.json({
      success: true,
      data: response
    })

  } catch (error) {
    console.error('Agent config get error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get agent configuration' 
      },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'TEAM' || !session.user.teamId) {
      return NextResponse.json(
        { success: false, error: 'Team access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Validate agent configuration
    const agentConfig = AgentConfigSchema.parse({
      ...body,
      teamId: session.user.teamId
    })

    // Get current team data for validation
    const team = await prisma.team.findUnique({
      where: { id: session.user.teamId },
      select: {
        budgetRemaining: true,
        agentConfig: true
      }
    })

    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      )
    }

    // Validate budget constraints
    if (agentConfig.maxBudget > team.budgetRemaining) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Max budget cannot exceed remaining budget: ₹${team.budgetRemaining.toLocaleString()}` 
        },
        { status: 400 }
      )
    }

    if (agentConfig.maxBidAmount > agentConfig.maxBudget) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Max bid amount cannot exceed max budget' 
        },
        { status: 400 }
      )
    }

    // Update team agent configuration
    const updatedTeam = await prisma.team.update({
      where: { id: session.user.teamId },
      data: {
        agentConfig: agentConfig as any,
        updatedAt: new Date()
      }
    })

    // Log configuration change
    await prisma.auditLog.create({
      data: {
        action: 'AGENT_CONFIG_UPDATE',
        userId: session.user.id,
        teamId: session.user.teamId,
        details: {
          previousConfig: team.agentConfig,
          newConfig: agentConfig,
          enabled: agentConfig.enabled
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        teamId: updatedTeam.id,
        agentConfig: updatedTeam.agentConfig,
        message: agentConfig.enabled ? 'Agent mode enabled' : 'Agent mode disabled'
      }
    })

  } catch (error) {
    console.error('Agent config update error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update agent configuration' 
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'TEAM' || !session.user.teamId) {
      return NextResponse.json(
        { success: false, error: 'Team access required' },
        { status: 403 }
      )
    }

    const { action } = await request.json()

    switch (action) {
      case 'test':
        // Test agent configuration without enabling
        const team = await prisma.team.findUnique({
          where: { id: session.user.teamId },
          select: { agentConfig: true }
        })

        if (!team?.agentConfig) {
          return NextResponse.json(
            { success: false, error: 'No agent configuration found' },
            { status: 400 }
          )
        }

        // Simulate agent behavior
        const testResults = {
          configValid: true,
          budgetCheck: team.agentConfig.maxBudget > 0,
          strategyValid: ['CONSERVATIVE', 'AGGRESSIVE', 'BALANCED'].includes(team.agentConfig.bidStrategy),
          delayValid: team.agentConfig.bidDelayMs >= 100,
          positionsValid: Array.isArray(team.agentConfig.targetPositions)
        }

        return NextResponse.json({
          success: true,
          data: {
            testResults,
            allPassed: Object.values(testResults).every(Boolean),
            config: team.agentConfig
          }
        })

      case 'reset':
        // Reset agent configuration to defaults
        const defaultConfig = {
          enabled: false,
          maxBudget: 0,
          maxBidAmount: 0,
          bidStrategy: 'BALANCED',
          targetPositions: [],
          bidDelayMs: 1000,
          maxBidsPerLot: 3
        }

        await prisma.team.update({
          where: { id: session.user.teamId },
          data: {
            agentConfig: defaultConfig as any,
            updatedAt: new Date()
          }
        })

        return NextResponse.json({
          success: true,
          data: {
            message: 'Agent configuration reset to defaults',
            config: defaultConfig
          }
        })

      case 'performance':
        // Get detailed performance analytics
        const stats = await performanceMonitor.getAgentStats(session.user.teamId)
        
        // Get recent agent activity
        const recentBids = await prisma.bid.findMany({
          where: {
            teamId: session.user.teamId,
            isAutoBid: true
          },
          orderBy: { placedAt: 'desc' },
          take: 10,
          include: {
            lot: {
              select: {
                lotNumber: true,
                player: { select: { name: true } }
              }
            }
          }
        })

        return NextResponse.json({
          success: true,
          data: {
            stats,
            recentActivity: recentBids,
            analysisDate: new Date().toISOString()
          }
        })

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Agent config action error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to execute agent action' 
      },
      { status: 500 }
    )
  }
}