'use client'

/**
 * Viewer Interface - Read-only auction viewing for spectators
 * Features: Live auction updates, leaderboard, statistics, no bidding controls
 * Mobile-first responsive design with optimized viewing experience
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AuthenticatedRoute } from '@/components/auth'
import { 
  TrophyIcon, 
  UserGroupIcon, 
  ClockIcon, 
  ChartBarIcon,
  EyeIcon,
  StarIcon,
  CurrencyRupeeIcon
} from '@heroicons/react/24/outline'
import {
  MobileHeader,
  MobileCard,
  MobileStatsGrid,
  MobilePlayerCard,
  MobileTabs,
  MobileTimer
} from '../../components/mobile'

interface Player {
  id: string
  name: string
  position: string
  nationality: string
  basePrice: number
  totalIPLRuns?: number
  totalIPLWickets?: number
  imageUrl?: string
}

interface Lot {
  id: string
  lotNumber: number
  player: Player
  currentPrice: number
  winningTeam?: {
    id: string
    name: string
    logo?: string
  }
  bidCount: number
  status: 'UPCOMING' | 'ACTIVE' | 'SOLD' | 'UNSOLD'
}

interface Team {
  id: string
  name: string
  logo?: string
  remainingBudget: number
  playersCount: number
  maxPlayers: number
}

interface AuctionState {
  id: string
  name: string
  status: 'UPCOMING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
  currentLot?: Lot
  nextLot?: Lot
  timeRemaining?: number
  totalLots: number
  soldLots: number
  unsoldLots: number
}

function ViewerInterfaceContent() {
  const { data: session } = useSession()
  const router = useRouter()
  
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [recentSales, setRecentSales] = useState<Lot[]>([])
  const [upcomingLots, setUpcomingLots] = useState<Lot[]>([])
  const [wsConnected, setWsConnected] = useState(false)
  const [viewerCount, setViewerCount] = useState(0)

  // Initialize viewer interface
  useEffect(() => {
    console.log('Viewer interface - User authenticated')
    // WebSocket and data fetching initialization will happen here
  }, [])

  // WebSocket connection for live updates
  useEffect(() => {
    if (!session?.user?.id) return

    const ws = new WebSocket(`ws://localhost:8080`)

    ws.onopen = () => {
      setWsConnected(true)
      ws.send(JSON.stringify({
        type: 'join_auction',
        payload: { userId: session.user.id, role: 'VIEWER' }
      }))
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      
      switch (message.type) {
        case 'auction_state':
          setAuctionState(message.payload)
          break
        case 'lot_update':
          setAuctionState(prev => prev ? { ...prev, currentLot: message.payload } : null)
          break
        case 'bid_placed':
          setAuctionState(prev => {
            if (!prev?.currentLot) return prev
            return {
              ...prev,
              currentLot: {
                ...prev.currentLot,
                currentPrice: message.payload.amount,
                winningTeam: message.payload.team,
                bidCount: prev.currentLot.bidCount + 1
              }
            }
          })
          break
        case 'lot_sold':
          setRecentSales(prev => [message.payload, ...prev.slice(0, 9)])
          break
        case 'teams_update':
          setTeams(message.payload)
          break
        case 'viewer_count':
          setViewerCount(message.payload.count)
          break
      }
    }

    ws.onclose = () => setWsConnected(false)

    return () => ws.close()
  }, [session?.user?.id])

  // Fetch initial data
  useEffect(() => {
    if (!session?.user?.id) return

    Promise.all([
      fetch('/api/auctions/current').then(r => r.json()),
      fetch('/api/teams').then(r => r.json()),
      fetch('/api/lots/recent?limit=10').then(r => r.json()),
      fetch('/api/lots/upcoming?limit=5').then(r => r.json())
    ]).then(([auction, teamsData, recent, upcoming]) => {
      if (auction.success) setAuctionState(auction.data)
      if (teamsData.success) setTeams(teamsData.data)
      if (recent.success) setRecentSales(recent.data)
      if (upcoming.success) setUpcomingLots(upcoming.data)
    }).catch(console.error)
  }, [session?.user?.id])

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <TrophyIcon className="h-8 w-8 text-indigo-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  {auctionState?.name || 'IPL Auction'}
                </h1>
                <p className="text-sm text-gray-500">Live Auction Viewer</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600">
                  {wsConnected ? 'Live' : 'Disconnected'}
                </span>
              </div>
              
              {/* Viewer Count */}
              <div className="flex items-center space-x-1 text-sm text-gray-600">
                <EyeIcon className="h-4 w-4" />
                <span>{viewerCount.toLocaleString()} watching</span>
              </div>

              <button
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Auction View */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Lot */}
            {auctionState?.currentLot && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Current Lot #{auctionState.currentLot.lotNumber}
                  </h2>
                  {auctionState.timeRemaining && (
                    <div className="flex items-center space-x-2 text-red-600">
                      <ClockIcon className="h-5 w-5" />
                      <span className="font-mono text-lg">
                        {Math.floor(auctionState.timeRemaining / 60)}:
                        {(auctionState.timeRemaining % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Player Info */}
                  <div>
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                        {auctionState.currentLot.player.imageUrl ? (
                          <img 
                            src={auctionState.currentLot.player.imageUrl} 
                            alt={auctionState.currentLot.player.name}
                            className="w-16 h-16 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-xl font-bold text-gray-500">
                            {auctionState.currentLot.player.name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {auctionState.currentLot.player.name}
                        </h3>
                        <p className="text-gray-600">
                          {auctionState.currentLot.player.position} • {auctionState.currentLot.player.nationality}
                        </p>
                      </div>
                    </div>
                    
                    {/* Player Stats */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Base Price</span>
                        <p className="font-semibold">₹{auctionState.currentLot.player.basePrice.toLocaleString()}</p>
                      </div>
                      {auctionState.currentLot.player.totalIPLRuns && (
                        <div>
                          <span className="text-gray-500">IPL Runs</span>
                          <p className="font-semibold">{auctionState.currentLot.player.totalIPLRuns.toLocaleString()}</p>
                        </div>
                      )}
                      {auctionState.currentLot.player.totalIPLWickets && (
                        <div>
                          <span className="text-gray-500">IPL Wickets</span>
                          <p className="font-semibold">{auctionState.currentLot.player.totalIPLWickets}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bidding Info */}
                  <div className="text-center">
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-1">Current Price</p>
                      <p className="text-4xl font-bold text-green-600">
                        ₹{auctionState.currentLot.currentPrice.toLocaleString()}
                      </p>
                    </div>
                    
                    {auctionState.currentLot.winningTeam && (
                      <div className="mb-4">
                        <p className="text-sm text-gray-500 mb-1">Leading Team</p>
                        <div className="flex items-center justify-center space-x-2">
                          {auctionState.currentLot.winningTeam.logo && (
                            <img 
                              src={auctionState.currentLot.winningTeam.logo} 
                              alt={auctionState.currentLot.winningTeam.name}
                              className="w-8 h-8 rounded"
                            />
                          )}
                          <span className="font-semibold text-lg">
                            {auctionState.currentLot.winningTeam.name}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <p className="text-sm text-gray-500">
                      {auctionState.currentLot.bidCount} bids placed
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Auction Stats */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Auction Progress</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <ChartBarIcon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{auctionState?.totalLots || 0}</p>
                  <p className="text-sm text-gray-500">Total Lots</p>
                </div>
                <div className="text-center">
                  <TrophyIcon className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">{auctionState?.soldLots || 0}</p>
                  <p className="text-sm text-gray-500">Sold</p>
                </div>
                <div className="text-center">
                  <div className="h-8 w-8 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                    <span className="text-red-600 font-bold">×</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{auctionState?.unsoldLots || 0}</p>
                  <p className="text-sm text-gray-500">Unsold</p>
                </div>
                <div className="text-center">
                  <ClockIcon className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-gray-900">
                    {auctionState ? auctionState.totalLots - auctionState.soldLots - auctionState.unsoldLots : 0}
                  </p>
                  <p className="text-sm text-gray-500">Remaining</p>
                </div>
              </div>
            </div>

            {/* Recent Sales */}
            {recentSales.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Sales</h3>
                <div className="space-y-3">
                  {recentSales.slice(0, 5).map((lot) => (
                    <div key={lot.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-sm font-medium text-gray-500">#{lot.lotNumber}</span>
                        <span className="font-medium text-gray-900">{lot.player.name}</span>
                        <span className="text-sm text-gray-500">({lot.player.position})</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        {lot.winningTeam && (
                          <span className="text-sm font-medium text-gray-700">
                            {lot.winningTeam.name}
                          </span>
                        )}
                        <span className="font-bold text-green-600">
                          ₹{lot.currentPrice.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Teams Leaderboard */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Teams</h3>
              <div className="space-y-3">
                {teams.map((team, index) => (
                  <div key={team.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                      {team.logo && (
                        <img src={team.logo} alt={team.name} className="w-6 h-6 rounded" />
                      )}
                      <span className="font-medium text-gray-900">{team.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        ₹{team.remainingBudget.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {team.playersCount}/{team.maxPlayers} players
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Upcoming Lots */}
            {upcomingLots.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Coming Up</h3>
                <div className="space-y-3">
                  {upcomingLots.map((lot) => (
                    <div key={lot.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{lot.player.name}</p>
                        <p className="text-sm text-gray-500">
                          {lot.player.position} • Lot #{lot.lotNumber}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          ₹{lot.player.basePrice.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">Base Price</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Lot Preview */}
            {auctionState?.nextLot && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-indigo-900 mb-4">Next Lot</h3>
                <div className="text-center">
                  <p className="text-xl font-bold text-indigo-900 mb-1">
                    {auctionState.nextLot.player.name}
                  </p>
                  <p className="text-indigo-700 mb-2">
                    {auctionState.nextLot.player.position} • {auctionState.nextLot.player.nationality}
                  </p>
                  <p className="text-lg font-semibold text-indigo-600">
                    ₹{auctionState.nextLot.player.basePrice.toLocaleString()}
                  </p>
                  <p className="text-sm text-indigo-600">Base Price</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Wrap with AuthenticatedRoute for protection (allows any authenticated user)
export default function ViewerInterface() {
  return (
    <AuthenticatedRoute>
      <ViewerInterfaceContent />
    </AuthenticatedRoute>
  )
}