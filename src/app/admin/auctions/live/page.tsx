'use client'

/**
 * Live Auction Control Interface
 * Real-time auction management dashboard for administrators
 * Features: Start/pause/resume auctions, manage lot flow, monitor bidding activity
 * Updated to use backend-mediated SSE connections instead of direct WebSocket
 */

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { auctionConnection, AuctionEvent, ConnectionStatus } from '@/lib/auction-connection'
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  ForwardIcon,
  ClockIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

interface CurrentLot {
  id: string
  lotNumber: number
  player: {
    id: string
    name: string
    role: string
    country: string
    basePrice: number
    stats: any
  }
  currentPrice: number
  currentBidder?: {
    teamId: string
    teamName: string
  }
  timeRemaining: number
  bidHistory: Array<{
    teamId: string
    teamName: string
    amount: number
    timestamp: string
  }>
  status: 'IN_PROGRESS' | 'SOLD' | 'UNSOLD'
}

interface AuctionState {
  id: string
  name: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED'
  currentLot?: CurrentLot
  nextLot?: {
    id: string
    player: {
      name: string
      role: string
      basePrice: number
    }
  }
  stats: {
    totalLots: number
    completedLots: number
    soldLots: number
    unsoldLots: number
    totalValue: number
    averagePrice: number
  }
  connectedTeams: number
  connectedViewers: number
}

interface Team {
  id: string
  name: string
  budgetRemaining: number
  rosterCount: number
  isActive: boolean
  lastActivity: string
}

export default function LiveAuctionControl() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const connectionStatusRef = useRef<ConnectionStatus | null>(null)
  
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    connected: false,
    connectionId: null,
    reconnectAttempts: 0
  })
  const [reconnectAttempt, setReconnectAttempt] = useState(0)

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/signin')
      return
    }

    initializeLiveControl()
    
    return () => {
      auctionConnection.disconnect()
    }
  }, [session, status, router])

  const initializeLiveControl = async () => {
    try {
      // Fetch current auction state
      const auctionRes = await fetch('/api/auctions/current')
      const auctionData = await auctionRes.json()
      
      if (auctionData.success) {
        setAuctionState(auctionData.data)
      }

      // Fetch team statuses
      const teamsRes = await fetch('/api/teams/status')
      const teamsData = await teamsRes.json()
      
      if (teamsData.success) {
        setTeams(teamsData.data)
      }

      // Connect to auction using new SSE-based service
      await connectToAuction()
      
    } catch (error) {
      console.error('Failed to initialize live control:', error)
      setError('Failed to load auction data')
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
        auctionId: 'current',
        onEvent: handleAuctionEvent,
        onError: (error) => {
          console.error('❌ Auction connection error:', error)
          setError(`Connection error: ${error}`)
          setConnectionStatus(auctionConnection.getConnectionStatus())
        },
        onConnect: () => {
          console.log('✅ Admin connected to auction stream')
          setError('')
          setReconnectAttempt(0)
          setConnectionStatus(auctionConnection.getConnectionStatus())
        },
        onDisconnect: () => {
          console.log('🔌 Admin disconnected from auction stream')
          setConnectionStatus(auctionConnection.getConnectionStatus())
        },
        onReconnect: (attempt) => {
          console.log(`🔄 Reconnection attempt ${attempt}`)
          setReconnectAttempt(attempt)
          setConnectionStatus(auctionConnection.getConnectionStatus())
        }
      })
      
      if (!connected) {
        setError('Failed to establish connection to auction')
      }
    } catch (error) {
      console.error('❌ Failed to connect to auction:', error)
      setError('Failed to initialize auction connection')
    }
  }

  const handleAuctionEvent = (event: AuctionEvent) => {
    switch (event.type) {
      case 'auction:state':
        setAuctionState(event.payload)
        break
        
      case 'bid:placed':
        setAuctionState(prev => {
          if (!prev?.currentLot) return prev
          return {
            ...prev,
            currentLot: {
              ...prev.currentLot,
              currentPrice: event.payload.amount,
              currentBidder: {
                teamId: event.payload.teamId,
                teamName: event.payload.teamName
              },
              bidHistory: [
                {
                  teamId: event.payload.teamId,
                  teamName: event.payload.teamName,
                  amount: event.payload.amount,
                  timestamp: event.timestamp || new Date().toISOString()
                },
                ...prev.currentLot.bidHistory.slice(0, 9)
              ]
            }
          }
        })
        break
        
      case 'teams:status':
        setTeams(event.payload)
        break
        
      case 'connection:count':
        setAuctionState(prev => prev ? {
          ...prev,
          connectedTeams: event.payload.teams,
          connectedViewers: event.payload.viewers
        } : null)
        break
        
      case 'auction:started':
      case 'auction:paused':
      case 'auction:resumed':
      case 'lot:started':
      case 'lot:ended':
        // Refresh auction state for major events
        refreshAuctionState()
        break
        
      case 'connection:established':
        console.log('🔗 Connection established:', event.payload)
        break
        
      case 'heartbeat':
        // Connection health check
        connectionStatusRef.current = auctionConnection.getConnectionStatus()
        break
    }
  }

  const refreshAuctionState = async () => {
    try {
      const response = await fetch('/api/auctions/current')
      const data = await response.json()
      if (data.success) {
        setAuctionState(data.data)
      }
    } catch (error) {
      console.error('Failed to refresh auction state:', error)
    }
  }

  const executeAuctionAction = async (action: string, data?: any) => {
    if (!auctionState?.id) return
    
    setActionLoading(action)
    setError('')
    setSuccess('')
    
    try {
      // Use the new admin control method through connection service
      const result = await auctionConnection.sendAdminControl(action, {
        auctionId: auctionState.id,
        ...data
      })
      
      if (!result.success) {
        throw new Error(result.error || 'Action failed')
      }
      
      setSuccess(`${action.replace('_', ' ')} executed successfully`)
      
      // Refresh auction state after successful action
      setTimeout(refreshAuctionState, 500)
      
    } catch (error) {
      console.error('❌ Action failed:', error)
      setError(error instanceof Error ? error.message : 'Action failed')
    } finally {
      setActionLoading('')
    }
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`
    } else {
      return `₹${(amount / 100000).toFixed(1)}L`
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!auctionState) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <TrophyIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Auction</h3>
          <p className="text-gray-600 mb-6">There are no auctions currently running.</p>
          <Link
            href="/admin/auctions"
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium"
          >
            Manage Auctions
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">IPL</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Auction Pro</span>
              </Link>
              <span className="text-gray-400">|</span>
              <nav className="flex space-x-4">
                <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <Link href="/admin/auctions" className="text-gray-600 hover:text-gray-900">
                  Auctions
                </Link>
                <span className="text-orange-600 font-medium">Live Control</span>
              </nav>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                connectionStatus.connected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`} />
                <span>
                  {connectionStatus.connected ? 'Live Connected' : 
                   reconnectAttempt > 0 ? `Reconnecting (${reconnectAttempt})` : 'Disconnected'}
                </span>
              </div>
              
              {!connectionStatus.connected && (
                <button
                  onClick={connectToAuction}
                  className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-full transition-colors"
                >
                  Reconnect
                </button>
              )}
              
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                auctionState.status === 'IN_PROGRESS' ? 'bg-green-100 text-green-800' :
                auctionState.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {auctionState.status.replace('_', ' ')}
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
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-2">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <p className="text-green-600">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Current Lot & Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Auction Controls */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Auction Controls</h2>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                  onClick={() => executeAuctionAction('start')}
                  disabled={auctionState.status !== 'NOT_STARTED' || actionLoading === 'start'}
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                >
                  <PlayIcon className="w-4 h-4" />
                  <span>Start</span>
                </button>
                
                <button
                  onClick={() => executeAuctionAction('pause')}
                  disabled={auctionState.status !== 'IN_PROGRESS' || actionLoading === 'pause'}
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                >
                  <PauseIcon className="w-4 h-4" />
                  <span>Pause</span>
                </button>
                
                <button
                  onClick={() => executeAuctionAction('resume')}
                  disabled={auctionState.status !== 'PAUSED' || actionLoading === 'resume'}
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                >
                  <PlayIcon className="w-4 h-4" />
                  <span>Resume</span>
                </button>
                
                <button
                  onClick={() => executeAuctionAction('next_lot')}
                  disabled={!auctionState.currentLot || actionLoading === 'next_lot'}
                  className="flex items-center justify-center space-x-2 px-4 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                >
                  <ForwardIcon className="w-4 h-4" />
                  <span>Next</span>
                </button>
              </div>
            </div>

            {/* Current Lot */}
            {auctionState.currentLot && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Current Lot #{auctionState.currentLot.lotNumber}
                  </h2>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Time Remaining</p>
                    <p className={`text-2xl font-bold font-mono ${
                      auctionState.currentLot.timeRemaining <= 10 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {formatTime(auctionState.currentLot.timeRemaining)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">
                      {auctionState.currentLot.player.name}
                    </h3>
                    <div className="space-y-1 text-sm text-gray-600 mb-4">
                      <p>{auctionState.currentLot.player.role} • {auctionState.currentLot.player.country}</p>
                      <p>Base Price: {formatCurrency(auctionState.currentLot.player.basePrice)}</p>
                    </div>
                    
                    <div className="flex space-x-3">
                      <button
                        onClick={() => executeAuctionAction('force_sell')}
                        disabled={actionLoading === 'force_sell'}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Force Sell
                      </button>
                      
                      <button
                        onClick={() => executeAuctionAction('mark_unsold')}
                        disabled={actionLoading === 'mark_unsold'}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        Mark Unsold
                      </button>
                    </div>
                  </div>

                  <div>
                    <div className="text-center mb-4">
                      <p className="text-sm text-gray-600">Current Highest Bid</p>
                      <p className="text-3xl font-bold text-green-600">
                        {formatCurrency(auctionState.currentLot.currentPrice)}
                      </p>
                      {auctionState.currentLot.currentBidder && (
                        <p className="text-sm text-gray-600 mt-1">
                          by {auctionState.currentLot.currentBidder.teamName}
                        </p>
                      )}
                    </div>

                    {/* Recent Bids */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Bids</h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {auctionState.currentLot.bidHistory.map((bid, index) => (
                          <div key={index} className="flex justify-between text-xs">
                            <span className="text-gray-600">{bid.teamName}</span>
                            <span className="font-medium">{formatCurrency(bid.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Next Lot Preview */}
            {auctionState.nextLot && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Next Lot</h2>
                <div className="flex items-center space-x-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{auctionState.nextLot.player.name}</h3>
                    <p className="text-sm text-gray-600">
                      {auctionState.nextLot.player.role} • Base: {formatCurrency(auctionState.nextLot.player.basePrice)}
                    </p>
                  </div>
                  <button
                    onClick={() => executeAuctionAction('skip_to_lot', { lotId: auctionState.nextLot!.id })}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium"
                  >
                    Skip to This
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Monitoring & Stats */}
          <div className="space-y-6">
            {/* Connection Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Live Connections</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Teams</span>
                  <span className="font-semibold text-blue-600">{auctionState.connectedTeams || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Viewers</span>
                  <span className="font-semibold text-indigo-600">{auctionState.connectedViewers || 0}</span>
                </div>
              </div>
            </div>

            {/* Auction Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Auction Progress</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Progress</span>
                    <span className="font-medium">
                      {auctionState.stats.completedLots}/{auctionState.stats.totalLots}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${(auctionState.stats.completedLots / auctionState.stats.totalLots) * 100}%` 
                      }}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{auctionState.stats.soldLots}</p>
                    <p className="text-xs text-gray-600">Sold</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{auctionState.stats.unsoldLots}</p>
                    <p className="text-xs text-gray-600">Unsold</p>
                  </div>
                </div>
                
                <div className="pt-3 border-t">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">
                      {formatCurrency(auctionState.stats.totalValue)}
                    </p>
                    <p className="text-xs text-gray-600">Total Value</p>
                  </div>
                  <div className="text-center mt-2">
                    <p className="text-sm font-semibold text-gray-700">
                      {formatCurrency(auctionState.stats.averagePrice)}
                    </p>
                    <p className="text-xs text-gray-600">Average Price</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Status */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Team Status</h2>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {teams.map((team) => (
                  <div key={team.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${team.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="text-sm font-medium text-gray-900">{team.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-green-600">
                        {formatCurrency(team.budgetRemaining)}
                      </p>
                      <p className="text-xs text-gray-500">{team.rosterCount}/25</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}