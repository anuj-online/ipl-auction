'use client'

/**
 * Admin Team Status Monitoring
 * Real-time monitoring of all team activities, budgets, and roster status
 * Admin-only interface for comprehensive team oversight
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  UserGroupIcon,
  CurrencyDollarIcon,
  TrophyIcon,
  ClockIcon,
  EyeIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

interface TeamStatus {
  id: string
  name: string
  displayName?: string
  budgetTotal: number
  budgetSpent: number
  budgetRemaining: number
  rosterCount: number
  bidCount: number
  lastActivity: string
  minutesSinceActivity: number
  isActive: boolean
  users: Array<{
    id: string
    name?: string
    email: string
  }>
  season: {
    name: string
    year: number
  }
  budgetUtilization: string
}

interface StatusSummary {
  totalTeams: number
  activeTeams: number
  totalBudget: number
  totalSpent: number
  totalRemaining: number
  totalRoster: number
  averageSpend: number
  utilizationRate: string
}

export default function AdminTeamStatusPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [teams, setTeams] = useState<TeamStatus[]>([])
  const [summary, setSummary] = useState<StatusSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/login')
      return
    }

    fetchTeamStatus()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchTeamStatus, 30000)
    return () => clearInterval(interval)
  }, [session, status, router])

  const fetchTeamStatus = async () => {
    if (!refreshing) setRefreshing(true)
    setError('')
    
    try {
      const response = await fetch('/api/teams/status')
      const data = await response.json()
      
      if (data.success) {
        setTeams(data.data.teams)
        setSummary(data.data.summary)
        setLastRefresh(new Date())
      } else {
        throw new Error(data.error || 'Failed to fetch team status')
      }
    } catch (error) {
      console.error('Failed to fetch team status:', error)
      setError('Failed to load team status')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`
    } else {
      return `₹${(amount / 100000).toFixed(1)}L`
    }
  }

  const getActivityStatus = (minutesSinceActivity: number) => {
    if (minutesSinceActivity < 5) {
      return { color: 'bg-green-100 text-green-800', text: 'Active' }
    } else if (minutesSinceActivity < 30) {
      return { color: 'bg-yellow-100 text-yellow-800', text: 'Recent' }
    } else {
      return { color: 'bg-gray-100 text-gray-800', text: 'Idle' }
    }
  }

  const getBudgetWarning = (utilization: number) => {
    if (utilization > 90) return 'text-red-600'
    if (utilization > 75) return 'text-yellow-600'
    return 'text-green-600'
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    )
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
              <nav className="flex space-x-4">
                <Link href="/admin" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <Link href="/admin/teams" className="text-gray-600 hover:text-gray-900">
                  Teams
                </Link>
                <span className="text-orange-600 font-medium">Team Status</span>
              </nav>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchTeamStatus}
                disabled={refreshing}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  refreshing 
                    ? 'bg-gray-300 text-gray-500' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Team Status Monitor</h1>
          <p className="mt-2 text-gray-600">
            Real-time monitoring of team activities, budgets, and roster status
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Summary Statistics */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <UserGroupIcon className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Active Teams</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {summary.activeTeams}/{summary.totalTeams}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CurrencyDollarIcon className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Spent</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {formatCurrency(summary.totalSpent)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrophyIcon className="h-8 w-8 text-purple-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Players Signed</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {summary.totalRoster}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <EyeIcon className="h-8 w-8 text-orange-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Budget Used</dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {summary.utilizationRate}%
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Team Status Table */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Team Details</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Roster
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teams.map((team) => {
                  const activityStatus = getActivityStatus(team.minutesSinceActivity)
                  const utilizationPercent = parseFloat(team.budgetUtilization)
                  
                  return (
                    <tr key={team.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {team.name}
                          </div>
                          {team.displayName && (
                            <div className="text-sm text-gray-500">{team.displayName}</div>
                          )}
                          <div className="text-xs text-gray-400">
                            {team.season.name} {team.season.year}
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          <div className="flex items-center space-x-2">
                            <span className={getBudgetWarning(utilizationPercent)}>
                              {formatCurrency(team.budgetSpent)}
                            </span>
                            <span className="text-gray-400">/</span>
                            <span>{formatCurrency(team.budgetTotal)}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            {team.budgetUtilization}% used
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div 
                              className={`h-1.5 rounded-full ${
                                utilizationPercent > 90 ? 'bg-red-500' :
                                utilizationPercent > 75 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {team.rosterCount}/25 players
                        </div>
                        <div className="text-xs text-gray-500">
                          {team.bidCount} bids placed
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${activityStatus.color}`}>
                          {activityStatus.text}
                        </span>
                        <div className="text-xs text-gray-500 mt-1">
                          {team.minutesSinceActivity < 60 
                            ? `${team.minutesSinceActivity}m ago`
                            : `${Math.floor(team.minutesSinceActivity / 60)}h ago`
                          }
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {team.users.length} user(s)
                        </div>
                        <div className="text-xs text-gray-500">
                          {team.users.map(user => user.name || user.email.split('@')[0]).join(', ')}
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <Link
                            href={`/admin/teams/${team.id}`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </Link>
                          <span className="text-gray-300">|</span>
                          <Link
                            href={`/admin/teams/${team.id}/roster`}
                            className="text-green-600 hover:text-green-900"
                          >
                            Roster
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
          {teams.length === 0 && (
            <div className="text-center py-12">
              <UserGroupIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No teams found</h3>
              <p className="text-gray-600">Teams will appear here once they are created.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}