/**
 * Dashboard Statistics API Route
 * Comprehensive analytics for admin dashboard
 */

import { NextRequest } from 'next/server'
import { withAdmin, createApiResponse, handleApiError } from '@/lib/session'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/admin/stats - Get comprehensive dashboard statistics (Admin only)
 */
export const GET = withAdmin(async (request: NextRequest, user) => {
  try {
    const url = new URL(request.url)
    const seasonId = url.searchParams.get('seasonId')

    // Build where clause for filtering
    const seasonFilter = seasonId ? { seasonId } : {}

    // Run all queries in parallel for better performance
    const [
      seasonsCount,
      activeAuctionsCount,
      teamsCount,
      playersCount,
      totalBidsCount,
      auctionStats,
      teamStats,
      recentActivity
    ] = await Promise.all([
      // Total seasons
      prisma.season.count(),
      
      // Active auctions
      prisma.auction.count({
        where: {
          status: {
            in: ['IN_PROGRESS', 'PAUSED']
          }
        }
      }),
      
      // Total teams
      prisma.team.count(seasonId ? { where: seasonFilter } : undefined),
      
      // Total players
      prisma.player.count(seasonId ? { where: seasonFilter } : undefined),
      
      // Total bids processed
      prisma.bid.count(seasonId ? {
        where: {
          lot: {
            auction: {
              seasonId: seasonId
            }
          }
        }
      } : undefined),
      
      // Auction value statistics
      prisma.lot.aggregate({
        where: {
          status: 'SOLD',
          ...(seasonId && {
            auction: {
              seasonId: seasonId
            }
          })
        },
        _sum: {
          finalPrice: true
        },
        _avg: {
          finalPrice: true
        },
        _max: {
          finalPrice: true
        },
        _count: {
          id: true
        }
      }),
      
      // Team spending statistics
      prisma.team.aggregate({
        ...(seasonId && { where: seasonFilter }),
        _sum: {
          budgetTotal: true
        },
        _avg: {
          budgetTotal: true
        }
      }),
      
      // Recent activity (last 10 significant events)
      prisma.bid.findMany({
        take: 10,
        orderBy: {
          createdAt: 'desc'
        },
        where: seasonId ? {
          lot: {
            auction: {
              seasonId: seasonId
            }
          }
        } : {},
        include: {
          team: {
            select: {
              name: true,
              displayName: true
            }
          },
          lot: {
            select: {
              order: true,
              player: {
                select: {
                  name: true
                }
              },
              auction: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      })
    ])

    // Calculate derived statistics
    const totalValue = auctionStats._sum.finalPrice || 0
    const averagePrice = auctionStats._avg.finalPrice || 0
    const highestSale = auctionStats._max.finalPrice || 0
    const soldLots = auctionStats._count.id || 0
    
    const totalBudgetPool = teamStats._sum.budgetTotal || 0
    const averageTeamBudget = teamStats._avg.budgetTotal || 0
    
    // Calculate budget utilization (spent vs total available)
    const budgetUtilization = totalBudgetPool > 0 ? ((totalValue / totalBudgetPool) * 100) : 0

    // Format recent activity
    const formattedRecentActivity = recentActivity.map(bid => ({
      id: bid.id,
      type: 'bid',
      description: `${bid.team.displayName || bid.team.name} bid ₹${(bid.amount / 100000).toFixed(1)}L for ${bid.lot.player.name}`,
      amount: bid.amount,
      timestamp: bid.createdAt.toISOString(),
      auction: bid.lot.auction.name,
      lotNumber: bid.lot.order
    }))

    // Get live auction metrics if there's an active auction
    let liveMetrics = null
    const activeAuction = await prisma.auction.findFirst({
      where: {
        status: 'IN_PROGRESS',
        ...(seasonId && { seasonId })
      },
      include: {
        currentLot: {
          include: {
            player: true,
            bids: {
              take: 1,
              orderBy: {
                createdAt: 'desc'
              },
              include: {
                team: true
              }
            }
          }
        },
        _count: {
          select: {
            lots: true
          }
        }
      }
    })

    if (activeAuction) {
      const completedLots = await prisma.lot.count({
        where: {
          auctionId: activeAuction.id,
          status: {
            in: ['SOLD', 'UNSOLD']
          }
        }
      })

      liveMetrics = {
        auctionId: activeAuction.id,
        auctionName: activeAuction.name,
        totalLots: activeAuction._count.lots,
        completedLots,
        progress: (completedLots / activeAuction._count.lots) * 100,
        currentLot: activeAuction.currentLot ? {
          lotNumber: activeAuction.currentLot.order,
          playerName: activeAuction.currentLot.player.name,
          currentBid: activeAuction.currentLot.bids[0]?.amount || activeAuction.currentLot.player.basePrice,
          currentBidder: activeAuction.currentLot.bids[0]?.team.displayName || null
        } : null
      }
    }

    const dashboardStats = {
      // Basic counts
      totalSeasons: seasonsCount,
      activeAuctions: activeAuctionsCount,
      totalTeams: teamsCount,
      totalPlayers: playersCount,
      totalBidsProcessed: totalBidsCount,
      
      // Financial metrics
      totalValue,
      averagePrice: Math.round(averagePrice),
      highestSale,
      soldLots,
      totalBudgetPool,
      averageTeamBudget: Math.round(averageTeamBudget),
      budgetUtilization: Math.round(budgetUtilization * 100) / 100,
      
      // Activity metrics
      recentActivity: formattedRecentActivity,
      liveMetrics,
      
      // Meta information
      lastUpdated: new Date().toISOString(),
      seasonFilter: seasonId || null
    }

    return createApiResponse(dashboardStats)

  } catch (error) {
    console.error('Failed to fetch dashboard statistics:', error)
    return handleApiError(error)
  }
})