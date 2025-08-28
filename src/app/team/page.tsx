'use client'

/**
 * Team Dashboard - Bidding Interface
 * Real-time bidding interface for team users with budget tracking
 * Mobile-first responsive design with touch-optimized controls
 * Updated to use backend-mediated SSE connections instead of direct WebSocket
 */

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { TeamRoute } from '@/components/auth'
import { auctionConnection, AuctionEvent, ConnectionStatus } from '@/lib/auction-connection'
import {
  CurrencyDollarIcon,
  ClockIcon,
  TrophyIcon,
  UserGroupIcon,
  HeartIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PlayIcon,
  Bars3Icon,
  BellIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import {
  MobileHeader,
  MobileCard,
  MobileStatsGrid,
  MobilePlayerCard,
  MobileBottomSheet,
  MobileTabs,
  MobileBidButton,
  MobileTimer
} from '../../components/mobile'

interface CurrentLot {
  id: string
  player: {
    id: string
    name: string
    role: string
    country: string
    basePrice: number
    isOverseas: boolean
    stats: any
  }
  currentPrice: number
  endsAt: string
  status: string
}

interface TeamBudget {
  teamId: string
  name: string
  budgetTotal: number
  budgetSpent: number
  budgetRemaining: number
  rosterCount: number
  maxSquadSize: number
}

interface AuctionState {
  id: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED'
  currentLot?: CurrentLot
  timer?: {
    remaining: number
    endsAt: string
    extensions: number
  }
}

function TeamDashboardContent() {
  const { data: session } = useSession()
  const connectionStatusRef = useRef<ConnectionStatus | null>(null)
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null)
  const [teamBudget, setTeamBudget] = useState<TeamBudget | null>(null)
  const [bidAmount, setBidAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [bidding, setBidding] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connectionId: null,
    reconnectAttempts: 0
  })
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  
  // Mobile-specific state
  const [showBidSheet, setShowBidSheet] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [activeTab, setActiveTab] = useState('auction')
  const [customBidAmount, setCustomBidAmount] = useState('')

  useEffect(() => {
    // Session and role validation is handled by TeamRoute wrapper
    console.log('Team dashboard - User authenticated as team member')
    initializeTeamDashboard()
    
    return () => {
      auctionConnection.disconnect()
    }
  }, [])

  // Timer countdown effect
  useEffect(() => {
    if (!auctionState?.timer) return

    const interval = setInterval(() => {
      const now = Date.now()
      const endsAt = new Date(auctionState.timer!.endsAt).getTime()
      const remaining = Math.max(0, endsAt - now)
      
      setTimeRemaining(remaining)
      
      if (remaining === 0) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [auctionState?.timer])

  const handleAuctionEvent = (event: AuctionEvent) => {
    console.log('Received auction event:', event.type)
    
    switch (event.type) {
      case 'connection:established':
        console.log('✅ Auction connection established')
        break
        
      case 'auction:state':
        setAuctionState(event.payload)
        if (event.payload.timer) {
          setTimeRemaining(event.payload.timer.remaining)
        }
        break
        
      case 'bid:placed':
        if (event.payload.teamId === session?.user.teamId) {
          setSuccess(`Bid placed: ₹${(event.payload.amount / 100000).toFixed(1)}L`)
        }
        // Update current price if this is for the current lot
        setAuctionState(prev => {
          if (prev?.currentLot?.id === event.payload.lotId) {
            return {
              ...prev,
              currentLot: {
                ...prev.currentLot,
                currentPrice: event.payload.amount
              }
            }
          }
          return prev
        })
        break
        
      case 'bid:cancelled':
        setSuccess('Bid cancelled successfully')
        break
        
      case 'bid:error':
        setError(event.payload.message || 'Bid failed')
        setBidding(false)
        break
        
      case 'heartbeat':
        // Connection health check
        connectionStatusRef.current = auctionConnection.getConnectionStatus()
        break
        
      default:
        console.log('Unknown auction event type:', event.type)
    }
  }

  const initializeTeamDashboard = async () => {
    try {
      // Fetch team info and current auction
      // In production, this would make actual API calls
      setTeamBudget({
        teamId: session!.user.teamId!,
        name: session!.user.teamName || 'Your Team',
        budgetTotal: 100000000, // 10 Cr
        budgetSpent: 0,
        budgetRemaining: 100000000,
        rosterCount: 0,
        maxSquadSize: 25,
      })

      // Connect to auction using new SSE-based service
      await connectToAuction()
      
    } catch (error) {
      console.error('Failed to initialize dashboard:', error)
      setError('Failed to load team data')
    } finally {
      setLoading(false)
    }
  }

  const connectToAuction = async () => {
    if (!session?.user?.id) return
    
    try {
      setError('')
      setReconnectAttempt(0)
      
      const connected = await auctionConnection.connect({
        auctionId: 'auction_1',
        onEvent: handleAuctionEvent,
        onError: (error) => {
          console.error('❌ Team auction connection error:', error)
          setError(`Connection error: ${error}`)
          setConnectionStatus(auctionConnection.getConnectionStatus())
        },
        onConnect: () => {
          console.log('✅ Team connected to auction stream')
          setError('')
          setReconnectAttempt(0)
          setConnectionStatus(auctionConnection.getConnectionStatus())
        },
        onDisconnect: () => {
          console.log('🔌 Team disconnected from auction stream')
          setConnectionStatus(auctionConnection.getConnectionStatus())
        },
        onReconnect: (attempt) => {
          console.log(`🔄 Team reconnection attempt ${attempt}`)
          setReconnectAttempt(attempt)
          setConnectionStatus(auctionConnection.getConnectionStatus())
        }
      })
      
      if (!connected) {
        // Fallback to mock data for development
        console.log('📱 Using fallback mock data')
        setAuctionState({
          id: 'auction_1',
          status: 'IN_PROGRESS',
          currentLot: {
            id: 'lot_1',
            player: {
              id: 'player_1',
              name: 'Virat Kohli',
              role: 'BATSMAN',
              country: 'India',
              basePrice: 15000000,
              isOverseas: false,
              stats: {
                matches: 200,
                runs: 6000,
                average: '45.2',
                strikeRate: '131.5'
              }
            },
            currentPrice: 85000000,
            endsAt: new Date(Date.now() + 25000).toISOString(),
            status: 'IN_PROGRESS'
          },
          timer: {
            remaining: 25000,
            endsAt: new Date(Date.now() + 25000).toISOString(),
            extensions: 0
          }
        })
      }
    } catch (error) {
      console.error('❌ Failed to connect to auction:', error)
      setError('Failed to initialize auction connection')
    }
  }

  const placeBid = async () => {
    if (!auctionState?.currentLot || !bidAmount || bidding) return
    
    const amount = parseInt(bidAmount.replace(/[^\d]/g, '')) * 100000 // Convert to actual amount
    
    if (amount <= auctionState.currentLot.currentPrice) {
      setError('Bid amount must be higher than current price')
      return
    }
    
    if (amount > (teamBudget?.budgetRemaining || 0)) {
      setError('Insufficient budget remaining')
      return
    }
    
    setBidding(true)
    setError('')
    
    try {
      // Use the new auction connection service for bidding
      const result = await auctionConnection.sendBid({
        lotId: auctionState.currentLot.id,
        amount: amount,
        metadata: {
          timestamp: new Date().toISOString(),
          batchId: Date.now().toString()
        }
      })
      
      if (result.success) {
        setSuccess(`Bid placed: ₹${(amount / 100000).toFixed(1)}L`)
        setBidAmount('')
        
        // Update current price optimistically
        setAuctionState(prev => prev ? {
          ...prev,
          currentLot: prev.currentLot ? {
            ...prev.currentLot,
            currentPrice: amount
          } : undefined
        } : null)
      } else {
        throw new Error(result.error || 'Failed to place bid')
      }
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to place bid')
    } finally {
      setBidding(false)
    }
  }

  const toggleWatchlist = (playerId: string) => {
    setWatchlist(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    )
  }

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`
    } else {
      return `₹${(amount / 100000).toFixed(1)}L`
    }
  }

  const getQuickBidAmounts = () => {
    if (!auctionState?.currentLot) return []
    
    const current = auctionState.currentLot.currentPrice
    const increments = [500000, 1000000, 2500000, 5000000] // 5L, 10L, 25L, 50L
    
    return increments
      .map(inc => current + inc)
      .filter(amount => amount <= (teamBudget?.budgetRemaining || 0))
      .slice(0, 4)
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!session || session.user.role !== 'TEAM') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <MobileHeader
        title={teamBudget?.name || 'Your Team'}
        subtitle="Live Auction"
        actions={
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              auctionState?.status === 'IN_PROGRESS' ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-sm text-gray-600">
              {auctionState?.status === 'IN_PROGRESS' ? 'Live' : 'Offline'}
            </span>
          </div>
        }
      />

      {/* Content */}
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {/* Status Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center space-x-2">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {/* Budget Stats */}
        <MobileCard>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <CurrencyDollarIcon className="h-6 w-6 text-green-600 mx-auto mb-1" />
              <p className="text-lg font-bold">{formatCurrency(teamBudget?.budgetRemaining || 0)}</p>
              <p className="text-xs text-gray-500">Remaining</p>
            </div>
            <div>
              <UserGroupIcon className="h-6 w-6 text-blue-600 mx-auto mb-1" />
              <p className="text-lg font-bold">{teamBudget?.rosterCount || 0}/{teamBudget?.maxSquadSize || 25}</p>
              <p className="text-xs text-gray-500">Squad</p>
            </div>
            <div>
              <TrophyIcon className="h-6 w-6 text-indigo-600 mx-auto mb-1" />
              <p className="text-lg font-bold">{formatCurrency(teamBudget?.budgetSpent || 0)}</p>
              <p className="text-xs text-gray-500">Spent</p>
            </div>
            <div>
              <ClockIcon className="h-6 w-6 text-yellow-600 mx-auto mb-1" />
              <p className={`text-lg font-bold font-mono ${timeRemaining < 10000 ? 'text-red-600' : 'text-yellow-600'}`}>
                {formatTime(timeRemaining)}
              </p>
              <p className="text-xs text-gray-500">Time</p>
            </div>
          </div>
        </MobileCard>

        {/* Current Player */}
        {auctionState?.currentLot && auctionState.status === 'IN_PROGRESS' && (
          <>
            <MobileCard>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Current Player</h2>
                  <button
                    onClick={() => auctionState.currentLot && toggleWatchlist(auctionState.currentLot.player.id)}
                    className="p-2 rounded-full hover:bg-gray-100"
                  >
                    {auctionState.currentLot && watchlist.includes(auctionState.currentLot.player.id) ? (
                      <HeartSolidIcon className="w-5 h-5 text-red-500" />
                    ) : (
                      <HeartIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </button>
                </div>

                {auctionState.currentLot && (
                  <MobilePlayerCard
                    player={{
                      name: auctionState.currentLot.player.name,
                      position: auctionState.currentLot.player.role,
                      nationality: auctionState.currentLot.player.country,
                    }}
                    price={auctionState.currentLot.currentPrice}
                  />
                )}

                {/* Player Stats */}
                {auctionState.currentLot?.player.stats && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="text-center bg-gray-50 rounded-lg p-2">
                      <p className="font-semibold text-gray-900">{auctionState.currentLot.player.stats.matches}</p>
                      <p className="text-gray-600">Matches</p>
                    </div>
                    <div className="text-center bg-gray-50 rounded-lg p-2">
                      <p className="font-semibold text-gray-900">{auctionState.currentLot.player.stats.runs}</p>
                      <p className="text-gray-600">Runs</p>
                    </div>
                    <div className="text-center bg-gray-50 rounded-lg p-2">
                      <p className="font-semibold text-gray-900">{auctionState.currentLot.player.stats.average}</p>
                      <p className="text-gray-600">Average</p>
                    </div>
                    <div className="text-center bg-gray-50 rounded-lg p-2">
                      <p className="font-semibold text-gray-900">{auctionState.currentLot.player.stats.strikeRate}</p>
                      <p className="text-gray-600">Strike Rate</p>
                    </div>
                  </div>
                )}

                {/* Bidding Section */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {getQuickBidAmounts().slice(0, 4).map((amount) => (
                      <button
                        key={amount}
                        onClick={() => {
                          setBidAmount(String(amount / 100000))
                          placeBid()
                        }}
                        disabled={bidding || timeRemaining < 1000}
                        className="px-3 py-2 bg-indigo-100 hover:bg-indigo-200 disabled:bg-gray-200 text-indigo-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
                      >
                        {formatCurrency(amount)}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder="Custom (Lakhs)"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-center"
                      min={auctionState.currentLot ? ((auctionState.currentLot.currentPrice || 0) / 100000) + 0.5 : 0.5}
                      step="0.5"
                    />
                    <button
                      onClick={placeBid}
                      disabled={bidding || !bidAmount || timeRemaining < 1000}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg font-semibold transition-colors"
                    >
                      {bidding ? 'Bidding...' : 'Bid'}
                    </button>
                  </div>
                </div>
              </div>
            </MobileCard>
          </>
        )}

        {/* Desktop sidebar content for larger screens */}
        <div className="hidden lg:block">
          {/* Team Navigation */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Team Management</h2>
            <div className="space-y-2">
              <Link
                href="/team/roster"
                className="flex items-center space-x-3 p-3 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
              >
                <UserGroupIcon className="w-5 h-5" />
                <span>My Roster</span>
              </Link>
              
              <Link
                href="/team/watchlist"
                className="flex items-center space-x-3 p-3 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
              >
                <HeartIcon className="w-5 h-5" />
                <span>Watchlist</span>
              </Link>
              
              <Link
                href="/team/strategy"
                className="flex items-center space-x-3 p-3 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
              >
                <ClipboardDocumentListIcon className="w-5 h-5" />
                <span>Strategy Planner</span>
              </Link>
            </div>
          </div>
          
          {/* Bidding Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button
                onClick={() => setShowBidSheet(true)}
                disabled={!auctionState?.currentLot || timeRemaining < 1000}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
              >
                <CurrencyDollarIcon className="w-5 h-5" />
                <span>Quick Bid</span>
              </button>
              
              <Link
                href="/team/watchlist"
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                <HeartIcon className="w-5 h-5" />
                <span>Manage Watchlist</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">IPL</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Auction Pro</span>
              </Link>
              <span className="text-gray-400">|</span>
              <span className="text-lg font-medium text-blue-600">{teamBudget?.name}</span>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="text-right">
                <p className="text-sm text-gray-600">Budget Remaining</p>
                <p className="text-lg font-bold text-green-600">
                  {formatCurrency(teamBudget?.budgetRemaining || 0)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Squad Size</p>
                <p className="text-lg font-bold text-blue-600">
                  {teamBudget?.rosterCount || 0}/{teamBudget?.maxSquadSize || 25}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Status Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-2">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {auctionState?.status === 'NOT_STARTED' && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <ClockIcon className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-blue-900 mb-2">Auction Not Started</h3>
            <p className="text-blue-700">The auction will begin shortly. Please wait for the admin to start.</p>
          </div>
        )}

        {auctionState?.status === 'PAUSED' && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <ExclamationTriangleIcon className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-yellow-900 mb-2">Auction Paused</h3>
            <p className="text-yellow-700">The auction has been temporarily paused by the admin.</p>
          </div>
        )}

        {auctionState?.status === 'COMPLETED' && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <TrophyIcon className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-green-900 mb-2">Auction Completed</h3>
            <p className="text-green-700">All players have been auctioned. Thank you for participating!</p>
          </div>
        )}

        {auctionState?.currentLot && auctionState.status === 'IN_PROGRESS' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Current Player */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Current Player</h2>
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Time Remaining</p>
                      <p className={`text-2xl font-bold font-mono ${timeRemaining < 10000 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatTime(timeRemaining)}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleWatchlist(auctionState.currentLot!.player.id)}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      {watchlist.includes(auctionState.currentLot.player.id) ? (
                        <HeartSolidIcon className="w-6 h-6 text-red-500" />
                      ) : (
                        <HeartIcon className="w-6 h-6 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                        {auctionState.currentLot.player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {auctionState.currentLot.player.name}
                        </h3>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <span>{auctionState.currentLot.player.role}</span>
                          <span>•</span>
                          <span>{auctionState.currentLot.player.country}</span>
                          {auctionState.currentLot.player.isOverseas && (
                            <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs">
                              Overseas
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Base Price:</span>
                        <span className="font-medium">{formatCurrency(auctionState.currentLot.player.basePrice)}</span>
                      </div>
                      {auctionState.currentLot.player.stats && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Matches:</span>
                            <span className="font-medium">{auctionState.currentLot.player.stats.matches}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Runs:</span>
                            <span className="font-medium">{auctionState.currentLot.player.stats.runs}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Average:</span>
                            <span className="font-medium">{auctionState.currentLot.player.stats.average}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Strike Rate:</span>
                            <span className="font-medium">{auctionState.currentLot.player.stats.strikeRate}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">Current Highest Bid</p>
                    <p className="text-4xl font-bold text-green-600 mb-6">
                      {formatCurrency(auctionState.currentLot.currentPrice)}
                    </p>

                    <div className="space-y-3">
                      <input
                        type="text"
                        value={bidAmount}
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^\d]/g, '')
                          setBidAmount(value)
                        }}
                        placeholder="Enter bid amount (in Lakhs)"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg"
                      />

                      <button
                        onClick={placeBid}
                        disabled={bidding || !bidAmount || timeRemaining < 1000}
                        className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 px-6 rounded-lg font-semibold text-lg transition-colors"
                      >
                        {bidding ? 'Placing Bid...' : `Bid ₹${bidAmount || '0'}L`}
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        {getQuickBidAmounts().map((amount) => (
                          <button
                            key={amount}
                            onClick={() => setBidAmount(String(amount / 100000))}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                          >
                            {formatCurrency(amount)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Stats Sidebar */}
            <div className="space-y-6">
              {/* Budget Overview */}
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Budget Overview</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Budget Used</span>
                      <span>{((teamBudget?.budgetSpent || 0) / (teamBudget?.budgetTotal || 1) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ 
                          width: `${((teamBudget?.budgetSpent || 0) / (teamBudget?.budgetTotal || 1)) * 100}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Budget:</span>
                      <span className="font-medium">{formatCurrency(teamBudget?.budgetTotal || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Spent:</span>
                      <span className="font-medium">{formatCurrency(teamBudget?.budgetSpent || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Remaining:</span>
                      <span className="font-medium text-green-600">{formatCurrency(teamBudget?.budgetRemaining || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Squad Status */}
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Squad Status</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-1">
                      <span>Squad Size</span>
                      <span>{teamBudget?.rosterCount || 0}/{teamBudget?.maxSquadSize || 25}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ 
                          width: `${((teamBudget?.rosterCount || 0) / (teamBudget?.maxSquadSize || 25)) * 100}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{teamBudget?.rosterCount || 0}</p>
                    <p className="text-sm text-gray-600">Players Acquired</p>
                  </div>
                  
                  <Link
                    href="/team/roster"
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-medium transition-colors text-center block"
                  >
                    View Full Roster
                  </Link>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Link
                    href="/team/watchlist"
                    className="w-full bg-red-50 hover:bg-red-100 text-red-700 py-3 px-4 rounded-lg font-medium transition-colors text-center block flex items-center justify-center space-x-2"
                  >
                    <HeartIcon className="w-4 h-4" />
                    <span>Manage Watchlist</span>
                  </Link>
                  
                  <Link
                    href="/team/strategy"
                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-3 px-4 rounded-lg font-medium transition-colors text-center block flex items-center justify-center space-x-2"
                  >
                    <TrophyIcon className="w-4 h-4" />
                    <span>Strategy Planner</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// Wrap with TeamRoute for protection
export default function TeamDashboard() {
  return (
    <TeamRoute>
      <TeamDashboardContent />
    </TeamRoute>
  )
}