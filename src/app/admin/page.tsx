'use client'

/**
 * Admin Dashboard - Main Page
 * Comprehensive admin interface for managing the auction system
 */

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChartBarIcon,
  UserGroupIcon,
  PlayCircleIcon,
  CogIcon,
  PlusIcon,
  EyeIcon,
  ClockIcon,
  CurrencyDollarIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline'

interface DashboardStats {
  totalSeasons: number
  activeAuctions: number
  totalTeams: number
  totalPlayers: number
  totalBidsProcessed: number
  totalValue: number
}

export default function AdminDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/login')
      return
    }

    fetchDashboardStats()
  }, [session, status, router])

  const fetchDashboardStats = async () => {
    try {
      const [seasonsRes, auctionsRes, teamsRes, playersRes] = await Promise.all([
        fetch('/api/seasons'),
        fetch('/api/auctions'),
        fetch('/api/teams'),
        fetch('/api/players')
      ])

      const [seasonsData, auctionsData, teamsData, playersData] = await Promise.all([
        seasonsRes.json(),
        auctionsRes.json(),
        teamsRes.json(),
        playersRes.json()
      ])

      const activeAuctions = auctionsData.success 
        ? auctionsData.data.auctions.filter((a: any) => a.status === 'IN_PROGRESS').length
        : 0

      setStats({
        totalSeasons: seasonsData.success ? seasonsData.data.seasons.length : 0,
        activeAuctions,
        totalTeams: teamsData.success ? teamsData.data.teams.length : 0,
        totalPlayers: playersData.success ? playersData.data.players.length : 0,
        totalBidsProcessed: 0, // TODO: Implement bid count API
        totalValue: 0, // TODO: Calculate from team spending
      })
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
      // Fallback to default values
      setStats({
        totalSeasons: 1,
        activeAuctions: 1,
        totalTeams: 8,
        totalPlayers: 25,
        totalBidsProcessed: 0,
        totalValue: 0,
      })
    } finally {
      setLoading(false)
    }
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

  const quickActions = [
    {
      name: 'Create Season',
      description: 'Set up a new auction season',
      href: '/admin/seasons/create',
      icon: PlusIcon,
      color: 'bg-blue-500',
    },
    {
      name: 'Manage Teams',
      description: 'Add and configure teams',
      href: '/admin/teams',
      icon: UserGroupIcon,
      color: 'bg-green-500',
    },
    {
      name: 'Import Players',
      description: 'Bulk upload player data',
      href: '/admin/players/import',
      icon: TrophyIcon,
      color: 'bg-purple-500',
    },
    {
      name: 'Start Auction',
      description: 'Begin live bidding session',
      href: '/admin/auctions',
      icon: PlayCircleIcon,
      color: 'bg-red-500',
    },
  ]

  const recentActivities = [
    'IPL 2024 season created',
    '8 teams added to season',
    '25 players imported successfully',
    'Auction lobby prepared',
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">IPL</span>
                </div>
                <span className="text-xl font-bold text-gray-900">Auction Pro</span>
              </Link>
              <span className="text-gray-400">|</span>
              <span className="text-lg font-medium text-gray-700">Admin Dashboard</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, {session.user.name || session.user.email}
              </span>
              <button
                onClick={() => {
                  signOut({ callbackUrl: '/auth/login' })
                }}
                className="bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Seasons</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats?.totalSeasons || 0}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <PlayCircleIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Active Auctions</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats?.activeAuctions || 0}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Teams</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats?.totalTeams || 0}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrophyIcon className="h-8 w-8 text-orange-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Players</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats?.totalPlayers || 0}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {quickActions.map((action) => (
                    <Link
                      key={action.name}
                      href={action.href}
                      className="relative group bg-white p-6 focus-within:ring-2 focus-within:ring-inset focus-within:ring-orange-500 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-md transition-all"
                    >
                      <div>
                        <span className={`rounded-lg inline-flex p-3 ${action.color} text-white`}>
                          <action.icon className="h-6 w-6" aria-hidden="true" />
                        </span>
                      </div>
                      <div className="mt-4">
                        <h3 className="text-lg font-medium text-gray-900 group-hover:text-orange-600">
                          {action.name}
                        </h3>
                        <p className="mt-2 text-sm text-gray-500">{action.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Admin Controls */}
            <div className="mt-8 bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Live Auction Controls</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Link
                    href="/admin/auctions/live"
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
                  >
                    <PlayCircleIcon className="w-5 h-5" />
                    <span>Live Control</span>
                  </Link>
                  
                  <Link
                    href="/admin/auctions"
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                  >
                    <CogIcon className="w-5 h-5" />
                    <span>Manage</span>
                  </Link>
                  
                  <Link
                    href="/admin/teams/status"
                    className="flex items-center justify-center space-x-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                  >
                    <EyeIcon className="w-5 h-5" />
                    <span>Monitor</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {recentActivities.map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-600">{activity}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {index === 0 ? 'Just now' : `${index + 1} hours ago`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* System Status */}
            <div className="bg-white rounded-lg shadow mt-6">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">System Status</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Database</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Healthy
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">WebSocket Server</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Online
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Active Connections</span>
                  <span className="text-sm font-medium text-gray-900">0</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="mt-8 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Management Sections</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/admin/seasons"
                className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all"
              >
                <ChartBarIcon className="h-6 w-6 text-blue-600 mb-2" />
                <h4 className="font-medium text-gray-900">Seasons</h4>
                <p className="text-sm text-gray-500 mt-1">Manage auction seasons</p>
              </Link>
              
              <Link
                href="/admin/teams"
                className="p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-md transition-all"
              >
                <UserGroupIcon className="h-6 w-6 text-green-600 mb-2" />
                <h4 className="font-medium text-gray-900">Teams</h4>
                <p className="text-sm text-gray-500 mt-1">Team configuration</p>
              </Link>
              
              <Link
                href="/admin/players"
                className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:shadow-md transition-all"
              >
                <TrophyIcon className="h-6 w-6 text-purple-600 mb-2" />
                <h4 className="font-medium text-gray-900">Players</h4>
                <p className="text-sm text-gray-500 mt-1">Player database</p>
              </Link>
              
              <Link
                href="/admin/auctions"
                className="p-4 border border-gray-200 rounded-lg hover:border-red-300 hover:shadow-md transition-all"
              >
                <PlayCircleIcon className="h-6 w-6 text-red-600 mb-2" />
                <h4 className="font-medium text-gray-900">Auctions</h4>
                <p className="text-sm text-gray-500 mt-1">Live auction control</p>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}