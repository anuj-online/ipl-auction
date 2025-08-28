'use client'

/**
 * Team Roster Page
 * Display team's acquired players with mobile-first design
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  TrophyIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ChevronLeftIcon,
  StarIcon,
  MapPinIcon
} from '@heroicons/react/24/outline'
import { MobileHeader, MobileCard } from '@/components/mobile'

interface RosterPlayer {
  id: string
  player: {
    id: string
    name: string
    country: string
    role: string
    isOverseas: boolean
    stats?: any
  }
  price: number
  createdAt: string
}

interface TeamStats {
  totalSpent: number
  budgetRemaining: number
  playerCount: number
  overseasCount: number
  roleDistribution: {
    BATSMAN: number
    BOWLER: number
    ALL_ROUNDER: number
    WICKET_KEEPER: number
  }
}

export default function TeamRosterPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [stats, setStats] = useState<TeamStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || session.user.role !== 'TEAM') {
      router.push('/auth/signin')
      return
    }

    fetchRoster()
  }, [session, status, router])

  const fetchRoster = async () => {
    try {
      const response = await fetch(`/api/teams/${session!.user.teamId}/roster`)
      const data = await response.json()
      
      if (data.success) {
        setRoster(data.data.roster || [])
        setStats(data.data.stats || null)
      } else {
        throw new Error(data.error || 'Failed to fetch roster')
      }
    } catch (error) {
      console.error('Failed to fetch roster:', error)
      setError('Failed to load roster')
    } finally {
      setLoading(false)
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

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'WICKET_KEEPER': return <StarIcon className="h-4 w-4" />
      default: return null
    }
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
        title="Team Roster"
        subtitle={`${roster.length}/25 Players`}
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

      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Team Statistics */}
        {stats && (
          <MobileCard>
            <h2 className="text-lg font-semibold mb-4">Squad Overview</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <CurrencyDollarIcon className="h-6 w-6 text-green-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-green-600">{formatCurrency(stats.totalSpent)}</p>
                <p className="text-xs text-gray-500">Total Spent</p>
              </div>
              <div className="text-center">
                <CurrencyDollarIcon className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-blue-600">{formatCurrency(stats.budgetRemaining)}</p>
                <p className="text-xs text-gray-500">Remaining</p>
              </div>
              <div className="text-center">
                <UserGroupIcon className="h-6 w-6 text-indigo-600 mx-auto mb-1" />
                <p className="text-lg font-bold">{stats.playerCount}</p>
                <p className="text-xs text-gray-500">Players</p>
              </div>
              <div className="text-center">
                <MapPinIcon className="h-6 w-6 text-orange-600 mx-auto mb-1" />
                <p className="text-lg font-bold">{stats.overseasCount}</p>
                <p className="text-xs text-gray-500">Overseas</p>
              </div>
            </div>

            {/* Role Distribution */}
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Role Distribution</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.roleDistribution).map(([role, count]) => (
                  <span 
                    key={role}
                    className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getRoleColor(role)}`}
                  >
                    {role.replace('_', ' ')}: {count}
                  </span>
                ))}
              </div>
            </div>
          </MobileCard>
        )}

        {/* Player List */}
        <div className="space-y-3">
          {roster.length === 0 ? (
            <MobileCard className="text-center py-8">
              <TrophyIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Players Yet</h3>
              <p className="text-gray-600 mb-4">You haven't acquired any players yet</p>
              <Link
                href="/team"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Join Auction
              </Link>
            </MobileCard>
          ) : (
            roster
              .sort((a, b) => b.price - a.price) // Sort by price descending
              .map((rosterEntry) => (
                <MobileCard key={rosterEntry.id} padding="sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0 relative">
                      <span className="text-lg font-bold text-gray-600">
                        {rosterEntry.player.name.charAt(0)}
                      </span>
                      {rosterEntry.player.role === 'WICKET_KEEPER' && (
                        <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-1">
                          <StarIcon className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          {rosterEntry.player.name}
                        </h3>
                        {rosterEntry.player.isOverseas && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                            OS
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2 text-sm">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(rosterEntry.player.role)}`}>
                          {rosterEntry.player.role.replace('_', ' ')}
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-600">{rosterEntry.player.country}</span>
                      </div>
                      
                      {rosterEntry.player.stats && (
                        <div className="flex space-x-4 mt-2 text-xs text-gray-500">
                          {rosterEntry.player.stats.matches && (
                            <span>{rosterEntry.player.stats.matches} matches</span>
                          )}
                          {rosterEntry.player.stats.runs && (
                            <span>{rosterEntry.player.stats.runs} runs</span>
                          )}
                          {rosterEntry.player.stats.average && (
                            <span>Avg: {rosterEntry.player.stats.average}</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-bold text-green-600">
                        {formatCurrency(rosterEntry.price)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(rosterEntry.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </MobileCard>
              ))
          )}
        </div>

        {/* Squad Building Tips */}
        {roster.length > 0 && roster.length < 11 && (
          <MobileCard className="bg-blue-50 border-blue-200">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Squad Building Tips</h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• You need at least 11 players to field a team</li>
              <li>• Maximum 4 overseas players allowed</li>
              <li>• At least 1 wicket-keeper required</li>
              <li>• Consider role balance for team composition</li>
            </ul>
          </MobileCard>
        )}
      </div>
    </div>
  )
}