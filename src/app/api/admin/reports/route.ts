/**
 * Auction Reports & Analytics API Route
 * Comprehensive reporting and analytics for auction data
 */

import { NextRequest } from 'next/server'
import { withAdmin, createApiResponse, handleApiError, getQueryParams } from '@/lib/session'
import { prisma } from '@/lib/prisma'

interface ReportFilters {
  seasonId?: string
  auctionId?: string
  teamId?: string
  startDate?: string
  endDate?: string
  reportType: 'summary' | 'detailed' | 'team-performance' | 'player-analysis' | 'bidding-patterns'
}

/**
 * GET /api/admin/reports - Generate auction reports and analytics (Admin only)
 */
export const GET = withAdmin(async (request: NextRequest, user) => {
  try {
    const params = getQueryParams(request.url)
    
    const filters: ReportFilters = {
      seasonId: params.get('seasonId') || undefined,
      auctionId: params.get('auctionId') || undefined,
      teamId: params.get('teamId') || undefined,
      startDate: params.get('startDate') || undefined,
      endDate: params.get('endDate') || undefined,
      reportType: (params.get('reportType') as any) || 'summary'
    }

    let report: any = {}

    switch (filters.reportType) {
      case 'summary':
        report = await generateSummaryReport(filters)
        break
        
      case 'detailed':
        report = await generateDetailedReport(filters)
        break
        
      case 'team-performance':
        report = await generateTeamPerformanceReport(filters)
        break
        
      case 'player-analysis':
        report = await generatePlayerAnalysisReport(filters)
        break
        
      case 'bidding-patterns':
        report = await generateBiddingPatternsReport(filters)
        break
        
      default:
        return createApiResponse(undefined, 'Invalid report type', 400)
    }

    return createApiResponse({
      reportType: filters.reportType,
      filters,
      generatedAt: new Date().toISOString(),
      generatedBy: user.email,
      data: report
    })

  } catch (error) {
    console.error('Failed to generate report:', error)
    return handleApiError(error)
  }
})

async function generateSummaryReport(filters: ReportFilters) {
  const whereClause = buildWhereClause(filters)
  
  const [
    auctionStats,
    playerStats,
    teamStats,
    bidStats,
    topSales,
    recentActivity
  ] = await Promise.all([
    // Auction overview
    prisma.auction.aggregate({
      where: whereClause.auction,
      _count: { id: true }
    }),
    
    // Player statistics
    prisma.lot.aggregate({
      where: {
        ...whereClause.lot,
        status: 'SOLD'
      },
      _count: { id: true },
      _sum: { finalPrice: true },
      _avg: { finalPrice: true },
      _max: { finalPrice: true },
      _min: { finalPrice: true }
    }),
    
    // Team statistics
    prisma.team.aggregate({
      where: whereClause.team,
      _count: { id: true },
      _sum: { budgetTotal: true },
      _avg: { budgetTotal: true }
    }),
    
    // Bidding statistics
    prisma.bid.aggregate({
      where: whereClause.bid,
      _count: { id: true },
      _sum: { amount: true },
      _avg: { amount: true }
    }),
    
    // Top sales
    prisma.lot.findMany({
      where: {
        ...whereClause.lot,
        status: 'SOLD'
      },
      include: {
        player: {
          select: { name: true, role: true, country: true }
        },
        soldToTeam: {
          select: { name: true, displayName: true }
        },
        auction: {
          select: { name: true }
        }
      },
      orderBy: { finalPrice: 'desc' },
      take: 10
    }),
    
    // Recent activity
    prisma.bid.findMany({
      where: whereClause.bid,
      include: {
        team: {
          select: { name: true, displayName: true }
        },
        lot: {
          include: {
            player: {
              select: { name: true }
            },
            auction: {
              select: { name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  ])

  return {
    overview: {
      totalAuctions: auctionStats._count.id,
      totalPlayersSold: playerStats._count.id,
      totalTeams: teamStats._count.id,
      totalBids: bidStats._count.id,
      totalValue: playerStats._sum.finalPrice || 0,
      averagePrice: playerStats._avg.finalPrice || 0,
      highestSale: playerStats._max.finalPrice || 0,
      lowestSale: playerStats._min.finalPrice || 0,
      totalBudgetPool: teamStats._sum.budgetTotal || 0,
      averageTeamBudget: teamStats._avg.budgetTotal || 0
    },
    topSales: topSales.map(lot => ({
      playerName: lot.player.name,
      role: lot.player.role,
      country: lot.player.country,
      finalPrice: lot.finalPrice,
      team: lot.soldToTeam?.displayName || lot.soldToTeam?.name,
      auction: lot.auction.name,
      lotNumber: lot.lotNumber
    })),
    recentActivity: recentActivity.slice(0, 10).map(bid => ({
      playerName: bid.lot.player.name,
      teamName: bid.team.displayName || bid.team.name,
      amount: bid.amount,
      auction: bid.lot.auction.name,
      timestamp: bid.createdAt
    }))
  }
}

async function generateDetailedReport(filters: ReportFilters) {
  const whereClause = buildWhereClause(filters)
  
  const auctions = await prisma.auction.findMany({
    where: whereClause.auction,
    include: {
      season: {
        select: { name: true, year: true }
      },
      lots: {
        include: {
          player: {
            select: { name: true, role: true, country: true, basePrice: true }
          },
          soldToTeam: {
            select: { name: true, displayName: true }
          },
          bids: {
            include: {
              team: {
                select: { name: true, displayName: true }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        },
        orderBy: { lotNumber: 'asc' }
      },
      _count: {
        select: { lots: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return {
    auctions: auctions.map(auction => ({
      id: auction.id,
      name: auction.name,
      season: auction.season.name,
      year: auction.season.year,
      status: auction.status,
      totalLots: auction._count.lots,
      completedLots: auction.lots.filter(lot => lot.status === 'SOLD' || lot.status === 'UNSOLD').length,
      soldLots: auction.lots.filter(lot => lot.status === 'SOLD').length,
      unsoldLots: auction.lots.filter(lot => lot.status === 'UNSOLD').length,
      totalValue: auction.lots.reduce((sum, lot) => sum + (lot.finalPrice || 0), 0),
      averagePrice: auction.lots.filter(lot => lot.finalPrice).length > 0 
        ? auction.lots.reduce((sum, lot) => sum + (lot.finalPrice || 0), 0) / auction.lots.filter(lot => lot.finalPrice).length
        : 0,
      lots: auction.lots.map(lot => ({
        lotNumber: lot.lotNumber,
        player: lot.player,
        finalPrice: lot.finalPrice,
        soldTo: lot.soldToTeam ? (lot.soldToTeam.displayName || lot.soldToTeam.name) : null,
        status: lot.status,
        totalBids: lot.bids.length,
        bidHistory: lot.bids.slice(0, 5).map(bid => ({
          team: bid.team.displayName || bid.team.name,
          amount: bid.amount,
          timestamp: bid.createdAt
        }))
      }))
    }))
  }
}

async function generateTeamPerformanceReport(filters: ReportFilters) {
  const whereClause = buildWhereClause(filters)
  
  const teams = await prisma.team.findMany({
    where: whereClause.team,
    include: {
      season: {
        select: { name: true, year: true }
      },
      roster: {
        include: {
          player: {
            select: { name: true, role: true, country: true }
          },
          lot: {
            select: { finalPrice: true, lotNumber: true }
          }
        }
      },
      bids: {
        include: {
          lot: {
            include: {
              player: {
                select: { name: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      },
      _count: {
        select: { roster: true, bids: true }
      }
    }
  })

  return {
    teams: teams.map(team => {
      const totalSpent = team.roster.reduce((sum, player) => sum + (player.lot?.finalPrice || 0), 0)
      const averagePlayerPrice = team.roster.length > 0 ? totalSpent / team.roster.length : 0
      
      const roleDistribution = team.roster.reduce((acc, player) => {
        acc[player.player.role] = (acc[player.player.role] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      return {
        id: team.id,
        name: team.displayName || team.name,
        season: team.season.name,
        budgetTotal: team.budgetTotal,
        budgetUsed: totalSpent,
        budgetRemaining: team.budgetTotal - totalSpent,
        budgetUtilization: (totalSpent / team.budgetTotal) * 100,
        squadSize: team._count.roster,
        averagePlayerPrice,
        totalBids: team._count.bids,
        successRate: team._count.bids > 0 ? (team._count.roster / team._count.bids) * 100 : 0,
        roleDistribution,
        mostExpensivePurchase: team.roster.length > 0 
          ? Math.max(...team.roster.map(p => p.lot?.finalPrice || 0))
          : 0,
        recentActivity: team.bids.slice(0, 5).map(bid => ({
          playerName: bid.lot.player.name,
          amount: bid.amount,
          timestamp: bid.createdAt
        }))
      }
    })
  }
}

async function generatePlayerAnalysisReport(filters: ReportFilters) {
  const whereClause = buildWhereClause(filters)
  
  const players = await prisma.player.findMany({
    where: whereClause.player,
    include: {
      season: {
        select: { name: true, year: true }
      },
      lots: {
        include: {
          bids: {
            include: {
              team: {
                select: { name: true, displayName: true }
              }
            },
            orderBy: { amount: 'desc' }
          },
          soldToTeam: {
            select: { name: true, displayName: true }
          },
          auction: {
            select: { name: true }
          }
        }
      }
    }
  })

  const soldPlayers = players.filter(player => 
    player.lots.some(lot => lot.status === 'SOLD')
  )

  const unsoldPlayers = players.filter(player => 
    player.lots.some(lot => lot.status === 'UNSOLD')
  )

  return {
    overview: {
      totalPlayers: players.length,
      soldPlayers: soldPlayers.length,
      unsoldPlayers: unsoldPlayers.length,
      sellRate: players.length > 0 ? (soldPlayers.length / players.length) * 100 : 0
    },
    roleAnalysis: ['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'].map(role => {
      const rolePlayers = players.filter(p => p.role === role)
      const roleSold = soldPlayers.filter(p => p.role === role)
      const avgPrice = roleSold.length > 0 
        ? roleSold.reduce((sum, p) => sum + (p.lots.find(l => l.status === 'SOLD')?.finalPrice || 0), 0) / roleSold.length
        : 0

      return {
        role,
        total: rolePlayers.length,
        sold: roleSold.length,
        sellRate: rolePlayers.length > 0 ? (roleSold.length / rolePlayers.length) * 100 : 0,
        averagePrice: avgPrice
      }
    }),
    countryAnalysis: await generateCountryAnalysis(players, soldPlayers),
    priceRanges: generatePriceRangeAnalysis(soldPlayers),
    topPerformers: soldPlayers
      .sort((a, b) => {
        const aPrice = a.lots.find(l => l.status === 'SOLD')?.finalPrice || 0
        const bPrice = b.lots.find(l => l.status === 'SOLD')?.finalPrice || 0
        return bPrice - aPrice
      })
      .slice(0, 20)
      .map(player => {
        const soldLot = player.lots.find(l => l.status === 'SOLD')
        return {
          name: player.name,
          role: player.role,
          country: player.country,
          basePrice: player.basePrice,
          finalPrice: soldLot?.finalPrice || 0,
          team: soldLot?.soldToTeam?.displayName || soldLot?.soldToTeam?.name,
          multiplier: soldLot?.finalPrice ? (soldLot.finalPrice / player.basePrice) : 0,
          totalBids: soldLot?.bids.length || 0
        }
      })
  }
}

async function generateBiddingPatternsReport(filters: ReportFilters) {
  const whereClause = buildWhereClause(filters)
  
  const bids = await prisma.bid.findMany({
    where: whereClause.bid,
    include: {
      team: {
        select: { name: true, displayName: true }
      },
      lot: {
        include: {
          player: {
            select: { name: true, role: true, basePrice: true }
          },
          auction: {
            select: { name: true }
          }
        }
      }
    },
    orderBy: { createdAt: 'asc' }
  })

  // Analyze bidding patterns
  const hourlyPattern = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    bids: bids.filter(bid => new Date(bid.createdAt).getHours() === hour).length
  }))

  const teamBiddingStats = bids.reduce((acc, bid) => {
    const teamName = bid.team.displayName || bid.team.name
    if (!acc[teamName]) {
      acc[teamName] = {
        totalBids: 0,
        totalAmount: 0,
        averageBid: 0,
        wins: 0,
        participatedLots: new Set()
      }
    }
    
    acc[teamName].totalBids++
    acc[teamName].totalAmount += bid.amount
    acc[teamName].participatedLots.add(bid.lot.id)
    
    // Check if this was a winning bid
    if (bid.lot.status === 'SOLD' && bid.lot.finalPrice === bid.amount) {
      acc[teamName].wins++
    }
    
    return acc
  }, {} as Record<string, any>)

  // Calculate averages and success rates
  Object.values(teamBiddingStats).forEach((stats: any) => {
    stats.averageBid = stats.totalBids > 0 ? stats.totalAmount / stats.totalBids : 0
    stats.successRate = stats.totalBids > 0 ? (stats.wins / stats.totalBids) * 100 : 0
    stats.participatedLots = stats.participatedLots.size
  })

  return {
    overview: {
      totalBids: bids.length,
      uniqueTeams: Object.keys(teamBiddingStats).length,
      averageBidAmount: bids.length > 0 ? bids.reduce((sum, bid) => sum + bid.amount, 0) / bids.length : 0,
      biddingIntensity: bids.length > 0 ? bids.length / Object.keys(teamBiddingStats).length : 0
    },
    hourlyPattern,
    teamStatistics: Object.entries(teamBiddingStats).map(([teamName, stats]) => ({
      teamName,
      ...stats
    })).sort((a, b) => b.totalBids - a.totalBids),
    biddingTrends: generateBiddingTrends(bids)
  }
}

function buildWhereClause(filters: ReportFilters) {
  const dateFilter = filters.startDate || filters.endDate ? {
    createdAt: {
      ...(filters.startDate && { gte: new Date(filters.startDate) }),
      ...(filters.endDate && { lte: new Date(filters.endDate) })
    }
  } : {}

  return {
    auction: {
      ...(filters.seasonId && { seasonId: filters.seasonId }),
      ...(filters.auctionId && { id: filters.auctionId }),
      ...dateFilter
    },
    team: {
      ...(filters.seasonId && { seasonId: filters.seasonId }),
      ...(filters.teamId && { id: filters.teamId })
    },
    player: {
      ...(filters.seasonId && { seasonId: filters.seasonId })
    },
    lot: {
      ...(filters.auctionId && { auctionId: filters.auctionId }),
      ...(filters.seasonId && { auction: { seasonId: filters.seasonId } })
    },
    bid: {
      ...(filters.teamId && { teamId: filters.teamId }),
      ...(filters.auctionId && { lot: { auctionId: filters.auctionId } }),
      ...(filters.seasonId && { lot: { auction: { seasonId: filters.seasonId } } }),
      ...dateFilter
    }
  }
}

async function generateCountryAnalysis(players: any[], soldPlayers: any[]) {
  const countries = [...new Set(players.map(p => p.country))]
  
  return countries.map(country => {
    const countryPlayers = players.filter(p => p.country === country)
    const countrySold = soldPlayers.filter(p => p.country === country)
    const avgPrice = countrySold.length > 0 
      ? countrySold.reduce((sum, p) => sum + (p.lots.find((l: any) => l.status === 'SOLD')?.finalPrice || 0), 0) / countrySold.length
      : 0

    return {
      country,
      total: countryPlayers.length,
      sold: countrySold.length,
      sellRate: countryPlayers.length > 0 ? (countrySold.length / countryPlayers.length) * 100 : 0,
      averagePrice: avgPrice
    }
  }).sort((a, b) => b.total - a.total)
}

function generatePriceRangeAnalysis(soldPlayers: any[]) {
  const ranges = [
    { min: 0, max: 5000000, label: 'Under ₹50L' },
    { min: 5000000, max: 10000000, label: '₹50L - ₹1Cr' },
    { min: 10000000, max: 20000000, label: '₹1Cr - ₹2Cr' },
    { min: 20000000, max: 50000000, label: '₹2Cr - ₹5Cr' },
    { min: 50000000, max: 100000000, label: '₹5Cr - ₹10Cr' },
    { min: 100000000, max: Infinity, label: 'Above ₹10Cr' }
  ]

  return ranges.map(range => {
    const playersInRange = soldPlayers.filter(player => {
      const price = player.lots.find((l: any) => l.status === 'SOLD')?.finalPrice || 0
      return price >= range.min && price < range.max
    })

    return {
      range: range.label,
      count: playersInRange.length,
      percentage: soldPlayers.length > 0 ? (playersInRange.length / soldPlayers.length) * 100 : 0
    }
  })
}

function generateBiddingTrends(bids: any[]) {
  // Group by day and calculate daily statistics
  const dailyStats = bids.reduce((acc, bid) => {
    const date = bid.createdAt.toISOString().split('T')[0]
    
    if (!acc[date]) {
      acc[date] = {
        date,
        totalBids: 0,
        totalAmount: 0,
        uniqueTeams: new Set(),
        uniqueLots: new Set()
      }
    }
    
    acc[date].totalBids++
    acc[date].totalAmount += bid.amount
    acc[date].uniqueTeams.add(bid.teamId)
    acc[date].uniqueLots.add(bid.lotId)
    
    return acc
  }, {} as Record<string, any>)

  return Object.values(dailyStats).map((day: any) => ({
    date: day.date,
    totalBids: day.totalBids,
    totalAmount: day.totalAmount,
    averageBid: day.totalBids > 0 ? day.totalAmount / day.totalBids : 0,
    activeTeams: day.uniqueTeams.size,
    activeLots: day.uniqueLots.size
  })).sort((a, b) => a.date.localeCompare(b.date))
}