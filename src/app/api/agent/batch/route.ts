/**
 * Batch Operations API for Agent Mode
 * Handle multiple operations in single request for efficiency
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  AgentBiddingEngine, 
  AgentConfigSchema, 
  BatchOperationSchema 
} from '@/lib/agent-mode'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/utils'

// Rate limiting for batch operations
const rateLimiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
})

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    await rateLimiter.check(request, 10, 'AGENT_BATCH') // 10 requests per minute

    const session = await getServerSession(authOptions)
    if (!session?.user || !session.user.teamId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const operations = BatchOperationSchema.parse(body)

    // Get team's agent configuration
    const team = await prisma.team.findUnique({
      where: { id: session.user.teamId },
      include: {
        season: true,
        players: true
      }
    })

    if (!team) {
      return NextResponse.json(
        { success: false, error: 'Team not found' },
        { status: 404 }
      )
    }

    // Check if agent mode is enabled for team
    const agentConfig = team.agentConfig as any
    if (!agentConfig?.enabled) {
      return NextResponse.json(
        { success: false, error: 'Agent mode not enabled' },
        { status: 403 }
      )
    }

    // Validate agent configuration
    const validatedConfig = AgentConfigSchema.parse({
      ...agentConfig,
      teamId: session.user.teamId
    })

    // Initialize bidding engine
    const biddingEngine = new AgentBiddingEngine(validatedConfig)

    // Process batch operations
    const results = await biddingEngine.processBatchBids(operations)

    // Log batch operation
    await prisma.auditLog.create({
      data: {
        action: 'BATCH_BID',
        userId: session.user.id,
        teamId: session.user.teamId,
        details: {
          operationCount: operations.bids.length,
          successCount: results.successful,
          failedCount: results.failed,
          agentConfig: validatedConfig
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: Date.now()
    })

  } catch (error) {
    console.error('Batch operation error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || !session.user.teamId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const operations = searchParams.getAll('operations')
    const format = searchParams.get('format') || 'json'

    // Get batch operation templates
    const templates = {
      quickBid: {
        type: 'bid',
        description: 'Quick bid on current lot',
        schema: {
          lotId: 'string',
          amount: 'number',
          maxAmount: 'number (optional)'
        }
      },
      conditionalBid: {
        type: 'bid',
        description: 'Bid with conditions',
        schema: {
          lotId: 'string',
          amount: 'number',
          conditions: {
            timeRemaining: 'number (optional)',
            maxCompetitors: 'number (optional)',
            positionRequired: 'string (optional)'
          }
        }
      },
      bulkBid: {
        type: 'bulk',
        description: 'Bid on multiple lots',
        schema: {
          bids: 'array of bid objects'
        }
      }
    }

    // Filter templates based on requested operations
    const filteredTemplates = operations.length > 0 
      ? Object.fromEntries(
          Object.entries(templates).filter(([key]) => operations.includes(key))
        )
      : templates

    return NextResponse.json({
      success: true,
      data: {
        templates: filteredTemplates,
        limits: {
          maxBidsPerBatch: 10,
          rateLimitPerMinute: 10,
          maxBidAmount: 100000000 // 10 Cr
        },
        currentTime: Date.now()
      }
    })

  } catch (error) {
    console.error('Batch templates error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get batch templates' 
      },
      { status: 500 }
    )
  }
}