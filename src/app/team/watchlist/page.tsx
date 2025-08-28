'use client'

/**
 * Team Watchlist Page
 * Manage and track favorite players with mobile-first design
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  HeartIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  ChevronLeftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid'
import { MobileHeader, MobileCard, MobileTabs } from '@/components/mobile'

interface WatchlistEntry {
  id: string
  playerId: string
  maxBid?: number
  priority?: number
  createdAt: string
  player: {
    id: string
    name: string
    country: string
    role: string
    basePrice: number
    isOverseas: boolean
    stats?: any
  }
}

interface Player {
  id: string
  name: string
  country: string
  role: string
  basePrice: number
  isOverseas: boolean
  stats?: any
  isInWatchlist: boolean
}

export default function TeamWatchlistPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([])
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('watchlist')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [maxBid, setMaxBid] = useState('')
  const [priority, setPriority] = useState('5')

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || session.user.role !== 'TEAM') {
      router.push('/auth/signin')
      return
    }

    fetchWatchlist()
    if (activeTab === 'add') {
      fetchAvailablePlayers()
    }
  }, [session, status, router, activeTab])

  const fetchWatchlist = async () => {
    try {
      const response = await fetch(`/api/teams/${session!.user.teamId}/watchlist`)
      const data = await response.json()
      
      if (data.success) {
        setWatchlist(data.data.watchlist || [])
      } else {
        throw new Error(data.error || 'Failed to fetch watchlist')
      }
    } catch (error) {
      console.error('Failed to fetch watchlist:', error)
      setError('Failed to load watchlist')
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailablePlayers = async () => {
    try {
      const response = await fetch('/api/players?available=true')
      const data = await response.json()
      
      if (data.success) {
        const watchlistPlayerIds = watchlist.map(w => w.playerId)
        const playersWithWatchlistStatus = (data.data.players || []).map((player: Player) => ({
          ...player,
          isInWatchlist: watchlistPlayerIds.includes(player.id)
        }))
        setAvailablePlayers(playersWithWatchlistStatus)
      }
    } catch (error) {
      console.error('Failed to fetch available players:', error)
    }
  }

  const addToWatchlist = async (playerId: string, maxBidAmount?: number, priorityLevel?: number) => {
    try {
      const response = await fetch(`/api/teams/${session!.user.teamId}/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          maxBid: maxBidAmount,
          priority: priorityLevel
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSuccess('Player added to watchlist')
        fetchWatchlist()
        fetchAvailablePlayers()
        setShowAddForm(false)
        setSelectedPlayer(null)
        setMaxBid('')
        setPriority('5')
      } else {
        throw new Error(data.error || 'Failed to add player to watchlist')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add to watchlist')
    }
  }

  const removeFromWatchlist = async (watchlistId: string) => {
    try {
      const response = await fetch(`/api/teams/${session!.user.teamId}/watchlist/${watchlistId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSuccess('Player removed from watchlist')
        fetchWatchlist()
        fetchAvailablePlayers()
      } else {
        throw new Error(data.error || 'Failed to remove from watchlist')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to remove from watchlist')
    }
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`
    } else {
      return `₹${(amount / 100000).toFixed(1)}L`
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'BATSMAN': return 'bg-blue-100 text-blue-800'
      case 'BOWLER': return 'bg-red-100 text-red-800'
      case 'ALL_ROUNDER': return 'bg-green-100 text-green-800'
      case 'WICKET_KEEPER': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return 'text-red-600'
    if (priority >= 5) return 'text-yellow-600'
    return 'text-gray-600'
  }

  const filteredPlayers = availablePlayers.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         player.country.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = !filterRole || player.role === filterRole
    return matchesSearch && matchesRole && !player.isInWatchlist
  })

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

  const tabs = [
    { id: 'watchlist', label: 'Watchlist', count: watchlist.length },
    { id: 'add', label: 'Add Players' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <MobileHeader
        title="Watchlist"
        subtitle="Track your target players"
        onBack={() => router.push('/team')}
        actions={
          <Link 
            href="/team"
            className="text-indigo-600 hover:text-indigo-800 font-medium text-sm"
          >
            Back
          </Link>
        }
      />

      {/* Status Messages */}
      <div className="p-4 space-y-2">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
            <p className="text-red-700 text-sm">{error}</p>
            <button onClick={() => setError('')} className="ml-auto text-red-500">×</button>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center space-x-2">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <p className="text-green-700 text-sm">{success}</p>
            <button onClick={() => setSuccess('')} className="ml-auto text-green-500">×</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <MobileTabs
        tabs={tabs}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {activeTab === 'watchlist' && (
          <>
            {watchlist.length === 0 ? (
              <MobileCard className="text-center py-8">
                <HeartIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Empty Watchlist</h3>
                <p className="text-gray-600 mb-4">Add players you're interested in to track them</p>
                <button
                  onClick={() => setActiveTab('add')}
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Players
                </button>
              </MobileCard>
            ) : (
              <div className="space-y-3">
                {watchlist
                  .sort((a, b) => (b.priority || 0) - (a.priority || 0))
                  .map((entry) => (
                    <MobileCard key={entry.id} padding="sm">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-lg font-bold text-gray-600">
                            {entry.player.name.charAt(0)}
                          </span>
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="text-base font-semibold text-gray-900 truncate">
                              {entry.player.name}
                            </h3>
                            {entry.player.isOverseas && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                                OS
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-2 text-sm mb-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(entry.player.role)}`}>
                              {entry.player.role.replace('_', ' ')}
                            </span>
                            <span className="text-gray-500">•</span>
                            <span className="text-gray-600">{entry.player.country}</span>
                          </div>
                          
                          <div className="flex items-center space-x-3 text-xs text-gray-500">
                            <span>Base: {formatCurrency(entry.player.basePrice)}</span>
                            {entry.maxBid && (
                              <span>Max: {formatCurrency(entry.maxBid)}</span>
                            )}
                            {entry.priority && (
                              <span className={getPriorityColor(entry.priority)}>
                                Priority: {entry.priority}/10
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <HeartSolidIcon className="h-5 w-5 text-red-500" />
                          <button
                            onClick={() => removeFromWatchlist(entry.id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </MobileCard>
                  ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'add' && (
          <>
            {/* Search and Filter */}
            <MobileCard>
              <div className="space-y-3">
                <div className="relative">
                  <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    placeholder="Search players..."
                  />
                </div>
                
                <select
                  value={filterRole}
                  onChange={(e) => setFilterRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Roles</option>
                  <option value="BATSMAN">Batsman</option>
                  <option value="BOWLER">Bowler</option>
                  <option value="ALL_ROUNDER">All Rounder</option>
                  <option value="WICKET_KEEPER">Wicket Keeper</option>
                </select>
              </div>
            </MobileCard>

            {/* Available Players */}
            <div className="space-y-3">
              {filteredPlayers.map((player) => (
                <MobileCard key={player.id} padding="sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-gray-600">
                        {player.name.charAt(0)}
                      </span>
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          {player.name}
                        </h3>
                        {player.isOverseas && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                            OS
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(player.role)}`}>
                          {player.role.replace('_', ' ')}
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-600">{player.country}</span>
                        <span className="text-gray-500">•</span>
                        <span className="font-medium">{formatCurrency(player.basePrice)}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => {
                        setSelectedPlayer(player)
                        setShowAddForm(true)
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50"
                    >
                      <HeartIcon className="h-5 w-5" />
                    </button>
                  </div>
                </MobileCard>
              ))}

              {filteredPlayers.length === 0 && (
                <MobileCard className="text-center py-8">
                  <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Players Found</h3>
                  <p className="text-gray-600">Try adjusting your search filters</p>
                </MobileCard>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add to Watchlist Modal */}
      {showAddForm && selectedPlayer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Add to Watchlist
            </h2>
            
            <div className="mb-4">
              <h3 className="font-medium text-gray-900">{selectedPlayer.name}</h3>
              <p className="text-sm text-gray-600">
                {selectedPlayer.role.replace('_', ' ')} • {selectedPlayer.country}
              </p>
              <p className="text-sm font-medium">
                Base Price: {formatCurrency(selectedPlayer.basePrice)}
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maximum Bid (₹ Lakhs) - Optional
                </label>
                <input
                  type="number"
                  value={maxBid}
                  onChange={(e) => setMaxBid(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., 150"
                  min={selectedPlayer.basePrice / 100000}
                  step="0.5"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority (1-10)
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  {[...Array(10)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1} {i + 1 >= 8 ? '(High)' : i + 1 >= 5 ? '(Medium)' : '(Low)'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex space-x-3 pt-6">
              <button
                onClick={() => {
                  setShowAddForm(false)
                  setSelectedPlayer(null)
                  setMaxBid('')
                  setPriority('5')
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => addToWatchlist(
                  selectedPlayer.id,
                  maxBid ? parseInt(maxBid) * 100000 : undefined,
                  parseInt(priority)
                )}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg"
              >
                Add to Watchlist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}