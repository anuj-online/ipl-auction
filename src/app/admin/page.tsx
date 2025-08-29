'use client'

/**
 * Admin Dashboard - Main Page
 * Comprehensive admin interface for managing the auction system
 */

import { useState, useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { AdminRoute } from '@/components/auth'
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

interface SystemStatus {
  database: {
    status: 'healthy' | 'warning' | 'error'
    responseTime: number
  }
  webSocket: {
    status: 'online' | 'offline' | 'unknown'
    connectedClients: number
  }
  application: {
    status: 'healthy' | 'warning' | 'error'
    uptime: number
    memoryUsage: {
      percentage: number
    }
  }
  activeConnections: {
    teams: number
    viewers: number
    admins: number
  }
  meta: {
    overallStatus: 'healthy' | 'warning' | 'error'
    checkTime: string
  }
}

function AdminDashboardContent() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [recentActivities, setRecentActivities] = useState([
    'IPL 2024 season created',
    '8 teams added to season',
    '25 players imported successfully',
    'Auction lobby prepared',
  ])

  useEffect(() => {
    // Session and role validation is handled by AdminRoute wrapper
    console.log('Admin dashboard - User authenticated as admin')
    fetchDashboardStats()
    fetchSystemStatus()
    
    // Set up periodic refresh for live monitoring
    const interval = setInterval(() => {
      fetchSystemStatus()
    }, 30000) // Refresh system status every 30 seconds
    
    return () => clearInterval(interval)
  }, [])

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/admin/stats')
      const data = await response.json()

      if (data.success) {
        setStats({
          totalSeasons: data.data.totalSeasons,
          activeAuctions: data.data.activeAuctions,
          totalTeams: data.data.totalTeams,
          totalPlayers: data.data.totalPlayers,
          totalBidsProcessed: data.data.totalBidsProcessed,
          totalValue: data.data.totalValue,
        })
        
        // Update recent activities with real data
        if (data.data.recentActivity && data.data.recentActivity.length > 0) {
          const activities = data.data.recentActivity.slice(0, 4).map((activity: any) => activity.description)
          setRecentActivities(activities)
        }
      } else {
        throw new Error(data.error || 'Failed to fetch stats')
      }
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

  const fetchSystemStatus = async () => {
    try {
      const response = await fetch('/api/admin/system-status')
      const data = await response.json()
      
      if (data.success) {
        setSystemStatus(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch system status:', error)
      // Set fallback status
      setSystemStatus({
        database: { status: 'unknown', responseTime: 0 },
        webSocket: { status: 'unknown', connectedClients: 0 },
        application: { status: 'unknown', uptime: 0, memoryUsage: { percentage: 0 } },
        activeConnections: { teams: 0, viewers: 0, admins: 0 },
        meta: { overallStatus: 'unknown', checkTime: new Date().toISOString() }
      } as any)
    }
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': case 'online': return 'text-green-800 bg-green-100'
      case 'warning': return 'text-yellow-800 bg-yellow-100'
      case 'error': case 'offline': return 'text-red-800 bg-red-100'
      default: return 'text-gray-800 bg-gray-100'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    )
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
      name: 'Manage Players',
      description: 'View and manage player database',
      href: '/admin/players',
      icon: TrophyIcon,
      color: 'bg-purple-500',
    },
    {
      name: 'Import Players',
      description: 'Bulk upload player data',
      href: '/admin/players/import',
      icon: TrophyIcon,
      color: 'bg-indigo-500',
    },
    {
      name: 'Create Auction',
      description: 'Set up a new auction',
      href: '/admin/auctions/create',
      icon: PlayCircleIcon,
      color: 'bg-orange-500',
    },
    {
      name: 'Control Auctions',
      description: 'Manage live auctions',
      href: '/admin/auctions',
      icon: CogIcon,
      color: 'bg-red-500',
    },
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
                Welcome, {session?.user?.name || session?.user?.email || 'Admin'}
              </span>
              <button
                onClick={() => {
                  signOut({ callbackUrl: '/auth/signin' })
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
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

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-8 w-8 text-indigo-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Bids</dt>
                  <dd className="text-lg font-medium text-gray-900">{stats?.totalBidsProcessed || 0}</dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyDollarIcon className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Value</dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats?.totalValue ? `₹${(stats.totalValue / 10000000).toFixed(1)}Cr` : '₹0'}
                  </dd>
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
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">System Status</h3>
                  {systemStatus && (
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      getStatusColor(systemStatus.meta.overallStatus)
                    }`}>
                      {systemStatus.meta.overallStatus.charAt(0).toUpperCase() + systemStatus.meta.overallStatus.slice(1)}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 space-y-4">
                {systemStatus ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Database</span>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getStatusColor(systemStatus.database.status)
                        }`}>
                          {systemStatus.database.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {systemStatus.database.responseTime}ms
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">WebSocket Server</span>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getStatusColor(systemStatus.webSocket.status)
                        }`}>
                          {systemStatus.webSocket.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {systemStatus.webSocket.connectedClients} clients
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Application</span>
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getStatusColor(systemStatus.application.status)
                        }`}>
                          {systemStatus.application.status}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatUptime(systemStatus.application.uptime)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Memory Usage</span>
                      <span className="text-sm font-medium text-gray-900">
                        {systemStatus.application.memoryUsage.percentage}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Active Connections</span>
                      <span className="text-sm font-medium text-gray-900">
                        {systemStatus.activeConnections.teams + systemStatus.activeConnections.viewers + systemStatus.activeConnections.admins}
                      </span>
                    </div>
                    
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        Last updated: {new Date(systemStatus.meta.checkTime).toLocaleTimeString()}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading system status...</p>
                  </div>
                )}
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

// Wrap with AdminRoute for protection
export default function AdminDashboard() {
  return (
    <AdminRoute>
      <AdminDashboardContent />
    </AdminRoute>
  )
}