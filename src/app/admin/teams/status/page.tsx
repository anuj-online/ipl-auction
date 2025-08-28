'use client'

/**
 * Teams Status Monitoring Page
 * Real-time team status dashboard for admin monitoring during auctions
 */

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  TrophyIcon,
  ClockIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  WifiIcon,
} from '@heroicons/react/24/outline'

interface TeamStatus {
  id: string
  name: string
  displayName: string
  budgetTotal: number
  budgetSpent: number
  budgetRemaining: number
  rosterCount: number
  maxRosterSize: number
  lastActivity: string
  isConnected: boolean
  connectionStatus: 'online' | 'offline' | 'idle'
  currentBid?: {
    amount: number
    playerName: string
    timestamp: string
  }
  recentActivity: Array<{
    type: 'bid' | 'win' | 'outbid'
    description: string
    timestamp: string
    amount?: number
  }>
}

interface Season {
  id: string
  name: string
  year: number
}

export default function TeamsStatusPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const wsRef = useRef<WebSocket | null>(null)
  
  const [teams, setTeams] = useState<TeamStatus[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/login')
      return
    }

    initializeStatusMonitor()
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [session, status, router])

  useEffect(() => {
    if (selectedSeasonId) {
      fetchTeamStatuses()
    }
  }, [selectedSeasonId])

  useEffect(() => {
    let interval: NodeJS.Timeout
    
    if (autoRefresh && selectedSeasonId) {
      interval = setInterval(() => {
        fetchTeamStatuses()
      }, 30000) // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh, selectedSeasonId])

  const initializeStatusMonitor = async () => {
    try {
      // Fetch seasons
      const seasonsRes = await fetch('/api/seasons')
      const seasonsData = await seasonsRes.json()
      
      if (seasonsData.success) {
        setSeasons(seasonsData.data.seasons || [])
        if (seasonsData.data.seasons.length > 0) {
          setSelectedSeasonId(seasonsData.data.seasons[0].id)
        }
      }

      // Connect to WebSocket for real-time updates
      connectWebSocket()
      
    } catch (error) {
      console.error('Failed to initialize status monitor:', error)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const connectWebSocket = () => {
    try {
      const wsUrl = `ws://localhost:8080`
      const ws = new WebSocket(wsUrl)
      
      ws.onopen = () => {
        setWsConnected(true)
        console.log('Connected to WebSocket for team status updates')
        
        // Subscribe to team status updates
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'admin:team-status'
        }))
      }
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleWebSocketMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }
      
      ws.onclose = () => {
        setWsConnected(false)
        console.log('WebSocket connection closed')
        
        // Reconnect after 5 seconds
        setTimeout(connectWebSocket, 5000)
      }
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setWsConnected(false)
      }
      
      wsRef.current = ws
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error)
      setWsConnected(false)
    }
  }

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'team:status':
        setTeams(prev => 
          prev.map(team => 
            team.id === message.payload.teamId 
              ? { ...team, ...message.payload.status }
              : team
          )
        )
        setLastUpdated(new Date())
        break
        
      case 'team:activity':
        setTeams(prev => 
          prev.map(team => 
            team.id === message.payload.teamId 
              ? {
                  ...team,
                  lastActivity: message.payload.timestamp,
                  recentActivity: [
                    message.payload.activity,
                    ...team.recentActivity.slice(0, 4)
                  ]
                }
              : team
          )
        )
        break
        
      case 'teams:connection':
        setTeams(prev => 
          prev.map(team => ({
            ...team,
            isConnected: message.payload.connectedTeams.includes(team.id),
            connectionStatus: message.payload.connectedTeams.includes(team.id) ? 'online' : 'offline'
          }))
        )
        break
    }
  }

  const fetchTeamStatuses = async () => {
    if (!selectedSeasonId) return
    
    try {
      const response = await fetch(`/api/teams/status?seasonId=${selectedSeasonId}`)
      const data = await response.json()
      
      if (data.success) {
        const teamStatuses: TeamStatus[] = data.data.teams.map((team: any) => ({
          id: team.id,
          name: team.name,
          displayName: team.displayName || team.name,
          budgetTotal: team.budgetTotal,
          budgetSpent: team.budgetSpent || 0,
          budgetRemaining: team.budgetRemaining || team.budgetTotal,
          rosterCount: team.rosterCount || 0,
          maxRosterSize: 25, // Default from season settings
          lastActivity: team.lastActivity || new Date().toISOString(),
          isConnected: team.isConnected || false,
          connectionStatus: team.isConnected ? 'online' : 'offline',
          recentActivity: team.recentActivity || []
        }))
        
        setTeams(teamStatuses)
        setLastUpdated(new Date())
      } else {
        throw new Error(data.error || 'Failed to fetch team statuses')
      }
    } catch (error) {
      console.error('Failed to fetch team statuses:', error)
      setError('Failed to load team statuses')
    }
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`
    } else {
      return `₹${(amount / 100000).toFixed(1)}L`
    }
  }

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-100'
      case 'offline': return 'text-red-600 bg-red-100'
      case 'idle': return 'text-yellow-600 bg-yellow-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getBudgetUtilizationColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-yellow-500'
    if (percentage >= 50) return 'bg-blue-500'
    return 'bg-green-500'
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Link href="/admin" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">IPL</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Auction Pro</span>
              </Link>
              <span className="text-gray-400">|</span>
              <nav className="flex items-center space-x-2">
                <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <span className="text-gray-400">/</span>
                <Link href="/admin/teams" className="text-gray-600 hover:text-gray-900">
                  Teams
                </Link>
                <span className="text-gray-400">/</span>
                <span className="text-orange-600 font-medium">Status Monitor</span>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                wsConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                <WifiIcon className="w-4 h-4" />
                <span>{wsConnected ? 'Live' : 'Offline'}</span>
              </div>
              
              <Link
                href="/admin/teams"
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span>Back to Teams</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Team Status Monitor</h1>
            <p className="mt-2 text-gray-600">
              Real-time monitoring of team budgets, rosters, and activity during auctions.
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <select
              value={selectedSeasonId}
              onChange={(e) => setSelectedSeasonId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            >
              <option value="">Select Season</option>
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name} ({season.year})
                </option>
              ))}
            </select>

            <button
              onClick={() => fetchTeamStatuses()}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <ArrowPathIcon className="w-4 h-4" />
              <span>Refresh</span>
            </button>

            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <span className="text-sm text-gray-700">Auto refresh</span>
            </label>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {lastUpdated && (
          <div className="mb-6 text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}

        {/* Teams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {teams.map((team) => (
            <div key={team.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* Team Header */}
              <div className="px-6 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-semibold">{team.displayName}</h3>
                    <p className="text-orange-100 text-sm">{team.name}</p>
                  </div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${getConnectionStatusColor(team.connectionStatus)}`}>
                    {team.connectionStatus}
                  </div>
                </div>
              </div>

              {/* Budget Section */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Budget Utilization</span>
                  <span className="text-sm text-gray-600">
                    {((team.budgetSpent / team.budgetTotal) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div 
                    className={`h-2 rounded-full ${getBudgetUtilizationColor((team.budgetSpent / team.budgetTotal) * 100)}`}
                    style={{ width: `${Math.min((team.budgetSpent / team.budgetTotal) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Spent</p>
                    <p className="font-semibold text-red-600">{formatCurrency(team.budgetSpent)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Remaining</p>
                    <p className="font-semibold text-green-600">{formatCurrency(team.budgetRemaining)}</p>
                  </div>
                </div>
              </div>

              {/* Roster Section */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Squad</span>
                  <span className="text-sm text-gray-600">
                    {team.rosterCount}/{team.maxRosterSize}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 bg-blue-500 rounded-full"
                    style={{ width: `${Math.min((team.rosterCount / team.maxRosterSize) * 100, 100)}%` }}
                  ></div>
                </div>
              </div>

              {/* Activity Section */}
              <div className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Recent Activity</span>
                  <ClockIcon className="w-4 h-4 text-gray-400" />
                </div>
                
                {team.recentActivity.length > 0 ? (
                  <div className="space-y-2">
                    {team.recentActivity.slice(0, 3).map((activity, index) => (
                      <div key={index} className="text-xs">
                        <div className="flex justify-between items-start">
                          <span className="text-gray-700 flex-1 pr-2">{activity.description}</span>
                          {activity.amount && (
                            <span className="font-medium text-green-600">
                              {formatCurrency(activity.amount)}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-400 mt-1">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No recent activity</p>
                )}
              </div>

              {/* Current Bid (if any) */}
              {team.currentBid && (
                <div className="px-6 py-3 bg-yellow-50 border-t">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-yellow-800">
                        Bidding on {team.currentBid.playerName}
                      </p>
                      <p className="text-xs text-yellow-600">
                        Current: {formatCurrency(team.currentBid.amount)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {teams.length === 0 && selectedSeasonId && (
          <div className="text-center py-12">
            <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No teams found</h3>
            <p className="mt-1 text-sm text-gray-500">
              No teams are registered for the selected season.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}