/**
 * Delta Sync API for Agent Mode
 * Efficient state synchronization with minimal data transfer
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { 
  DeltaSyncManager, 
  DeltaSyncRequestSchema 
} from '@/lib/agent-mode'
import { prisma } from '@/lib/prisma'

// Global delta sync manager instance
const deltaSyncManager = new DeltaSyncManager()

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const syncRequest = DeltaSyncRequestSchema.parse(body)

    // Register agent if first time
    if (!deltaSyncManager['subscriptions'].has(syncRequest.agentId)) {
      deltaSyncManager.registerAgent(syncRequest.agentId, syncRequest.subscriptions)
    }

    // Get delta changes
    const deltaResponse = await deltaSyncManager.getDeltaChanges(syncRequest)

    return NextResponse.json({
      success: true,
      data: deltaResponse
    })

  } catch (error) {
    console.error('Delta sync error:', error)
    
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
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId') || session.user.id
    const subscriptions = searchParams.getAll('subscriptions')

    // Get current state snapshot for initial sync
    const snapshot: any = {}

    if (subscriptions.includes('auction') || subscriptions.length === 0) {
      snapshot.auction = await prisma.auction.findFirst({
        where: { status: { in: ['ACTIVE', 'PAUSED'] } },
        include: {
          currentLot: {
            include: {
              player: true,
              bids: {
                orderBy: { placedAt: 'desc' },
                take: 5,
                include: { team: { select: { name: true } } }
              }
            }
          },
          season: { select: { name: true } }
        }
      })
    }

    if (subscriptions.includes('lots') || subscriptions.length === 0) {
      snapshot.lots = await prisma.lot.findMany({
        where: {
          status: { in: ['UPCOMING', 'ACTIVE', 'SOLD'] }
        },
        include: {
          player: true,
          winningBid: { include: { team: true } },
          _count: { select: { bids: true } }
        },
        orderBy: { lotNumber: 'asc' },
        take: 20
      })
    }

    if (subscriptions.includes('teams') || subscriptions.length === 0) {
      snapshot.teams = await prisma.team.findMany({
        select: {
          id: true,
          name: true,
          logo: true,
          budgetRemaining: true,
          _count: { select: { players: true } }
        }
      })
    }

    if (subscriptions.includes('bids') || subscriptions.length === 0) {
      snapshot.recentBids = await prisma.bid.findMany({
        orderBy: { placedAt: 'desc' },
        take: 50,
        include: {
          team: { select: { name: true } },
          lot: { 
            select: { 
              lotNumber: true, 
              player: { select: { name: true } } 
            } 
          }
        }
      })
    }

    // Register agent for future delta syncs
    deltaSyncManager.registerAgent(agentId, subscriptions.length > 0 ? subscriptions : ['auction', 'lots', 'teams', 'bids'])

    return NextResponse.json({
      success: true,
      data: {
        snapshot,
        timestamp: Date.now(),
        agentId,
        subscriptions: subscriptions.length > 0 ? subscriptions : ['auction', 'lots', 'teams', 'bids']
      }
    })

  } catch (error) {
    console.error('Delta sync snapshot error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get initial snapshot' 
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId') || session.user.id

    // Unregister agent from delta sync
    deltaSyncManager['subscriptions'].delete(agentId)
    deltaSyncManager['lastSyncTimes'].delete(agentId)

    return NextResponse.json({
      success: true,
      message: 'Agent unregistered from delta sync'
    })

  } catch (error) {
    console.error('Delta sync unregister error:', error)
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to unregister agent' 
      },
      { status: 500 }
    )
  }
}