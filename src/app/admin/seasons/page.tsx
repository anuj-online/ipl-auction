'use client'

/**
 * Admin Seasons Management
 * Create, view, and manage auction seasons
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
  EyeIcon,
  CalendarIcon,
  UserGroupIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline'

interface Season {
  id: string
  name: string
  year: number
  description?: string
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  startDate?: string
  endDate?: string
  _count: {
    teams: number
    players: number
    auctions: number
  }
}

export default function SeasonsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/signin')
      return
    }

    fetchSeasons()
  }, [session, status, router])

  const fetchSeasons = async () => {
    try {
      const response = await fetch('/api/seasons')
      if (!response.ok) throw new Error('Failed to fetch seasons')
      
      const data = await response.json()
      setSeasons(data.data.seasons || [])
    } catch (error) {
      console.error('Failed to fetch seasons:', error)
      setError('Failed to load seasons')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800'
      case 'ARCHIVED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
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
                <span className="text-orange-600 font-medium">Seasons</span>
              </nav>
            </div>
            
            <Link
              href="/admin/seasons/create"
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Create Season</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Seasons Management</h1>
          <p className="mt-2 text-gray-600">
            Create and manage auction seasons, configure teams and player pools.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {/* Seasons List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">All Seasons</h2>
          </div>
          
          {seasons.length === 0 ? (
            <div className="p-12 text-center">
              <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No seasons found</h3>
              <p className="text-gray-600 mb-6">
                Get started by creating your first auction season.
              </p>
              <Link
                href="/admin/seasons/create"
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-flex items-center space-x-2"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Create Your First Season</span>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {seasons.map((season) => (
                <div key={season.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">{season.name}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(season.status)}`}>
                          {season.status}
                        </span>
                      </div>
                      
                      {season.description && (
                        <p className="text-gray-600 mb-3">{season.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <CalendarIcon className="w-4 h-4" />
                          <span>Year {season.year}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <UserGroupIcon className="w-4 h-4" />
                          <span>{season._count.teams} Teams</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <TrophyIcon className="w-4 h-4" />
                          <span>{season._count.players} Players</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <PlayIcon className="w-4 h-4" />
                          <span>{season._count.auctions} Auctions</span>
                        </div>
                      </div>
                      
                      {(season.startDate || season.endDate) && (
                        <div className="mt-2 text-sm text-gray-500">
                          {season.startDate && (
                            <span>Starts: {new Date(season.startDate).toLocaleDateString()}</span>
                          )}
                          {season.startDate && season.endDate && <span> • </span>}
                          {season.endDate && (
                            <span>Ends: {new Date(season.endDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Link
                        href={`/admin/seasons/${season.id}`}
                        className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                        title="View Details"
                      >
                        <EyeIcon className="w-5 h-5" />
                      </Link>
                      
                      <Link
                        href={`/admin/seasons/${season.id}/edit`}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Edit Season"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </Link>
                      
                      {season.status === 'DRAFT' && (
                        <button
                          onClick={() => {
                            // Add delete functionality
                            console.log('Delete season:', season.id)
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete Season"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      )}
                      
                      <Link
                        href={`/admin/seasons/${season.id}/manage`}
                        className="ml-3 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                      >
                        Manage
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        {seasons.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Total Seasons</h3>
              <p className="text-3xl font-bold text-orange-600">{seasons.length}</p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Active Seasons</h3>
              <p className="text-3xl font-bold text-green-600">
                {seasons.filter(s => s.status === 'ACTIVE').length}
              </p>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Total Teams</h3>
              <p className="text-3xl font-bold text-blue-600">
                {seasons.reduce((acc, season) => acc + season._count.teams, 0)}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}