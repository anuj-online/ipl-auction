'use client'

/**
 * Admin Teams Management Page
 * Comprehensive team management interface for administrators
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  UserGroupIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CurrencyDollarIcon,
  TrophyIcon,
  ChevronLeftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'

interface Team {
  id: string
  name: string
  displayName?: string
  budgetTotal: number
  budgetSpent: number
  seasonId: string
  season: {
    name: string
    year: number
  }
  rosterCount: number
  users: Array<{
    id: string
    name?: string
    email: string
  }>
  createdAt: string
}

interface TeamFormData {
  name: string
  displayName: string
  budgetTotal: number
  seasonId: string
}

export default function AdminTeamsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [teams, setTeams] = useState<Team[]>([])
  const [seasons, setSeasons] = useState<Array<{ id: string; name: string; year: number }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [formData, setFormData] = useState<TeamFormData>({
    name: '',
    displayName: '',
    budgetTotal: 100000000, // 10 Cr default
    seasonId: ''
  })

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/signin')
      return
    }

    fetchTeams()
    fetchSeasons()
  }, [session, status, router])

  const fetchTeams = async () => {
    try {
      const response = await fetch('/api/teams')
      const data = await response.json()
      
      if (data.success) {
        setTeams(data.data.teams || [])
      } else {
        throw new Error(data.error || 'Failed to fetch teams')
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error)
      setError('Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  const fetchSeasons = async () => {
    try {
      const response = await fetch('/api/seasons')
      const data = await response.json()
      
      if (data.success) {
        setSeasons(data.data.seasons || [])
        if (data.data.seasons?.length > 0 && !formData.seasonId) {
          setFormData(prev => ({ ...prev, seasonId: data.data.seasons[0].id }))
        }
      }
    } catch (error) {
      console.error('Failed to fetch seasons:', error)
    }
  }

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('Team name is required')
      return
    }
    
    try {
      const response = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSuccess('Team created successfully')
        setShowCreateForm(false)
        setFormData({
          name: '',
          displayName: '',
          budgetTotal: 100000000,
          seasonId: seasons[0]?.id || ''
        })
        fetchTeams()
      } else {
        throw new Error(data.error || 'Failed to create team')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create team')
    }
  }

  const handleUpdateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!editingTeam) return
    
    try {
      const response = await fetch(`/api/teams/${editingTeam.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSuccess('Team updated successfully')
        setEditingTeam(null)
        fetchTeams()
      } else {
        throw new Error(data.error || 'Failed to update team')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update team')
    }
  }

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team? This action cannot be undone.')) {
      return
    }
    
    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSuccess('Team deleted successfully')
        fetchTeams()
      } else {
        throw new Error(data.error || 'Failed to delete team')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete team')
    }
  }

  const startEditing = (team: Team) => {
    setEditingTeam(team)
    setFormData({
      name: team.name,
      displayName: team.displayName || '',
      budgetTotal: team.budgetTotal,
      seasonId: team.seasonId
    })
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`
    } else {
      return `₹${(amount / 100000).toFixed(1)}L`
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
              <Link 
                href="/admin" 
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <ChevronLeftIcon className="h-5 w-5" />
                <span>Back to Dashboard</span>
              </Link>
              <span className="text-gray-400">|</span>
              <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
            </div>
            
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Add Team</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
            <button 
              onClick={() => setError('')}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-2">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <p className="text-green-700">{success}</p>
            <button 
              onClick={() => setSuccess('')}
              className="ml-auto text-green-500 hover:text-green-700"
            >
              ×
            </button>
          </div>
        )}

        {/* Teams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((team) => (
            <div key={team.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                  {team.displayName && (
                    <p className="text-sm text-gray-600">{team.displayName}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {team.season.name} {team.season.year}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => startEditing(team)}
                    className="p-2 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteTeam(team.id)}
                    className="p-2 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Budget:</span>
                  <span className="font-medium">{formatCurrency(team.budgetTotal)}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Spent:</span>
                  <span className="font-medium text-red-600">{formatCurrency(team.budgetSpent)}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Remaining:</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(team.budgetTotal - team.budgetSpent)}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Squad Size:</span>
                  <span className="font-medium">{team.rosterCount || 0}/25</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Users:</span>
                  <span className="font-medium">{team.users?.length || 0}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <Link
                  href={`/admin/teams/${team.id}`}
                  className="text-sm text-orange-600 hover:text-orange-800 font-medium"
                >
                  View Details →
                </Link>
              </div>
            </div>
          ))}
        </div>

        {teams.length === 0 && (
          <div className="text-center py-12">
            <UserGroupIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No teams found</h3>
            <p className="text-gray-600 mb-6">Get started by creating your first team</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-medium"
            >
              Create Team
            </button>
          </div>
        )}
      </main>

      {/* Create/Edit Team Modal */}
      {(showCreateForm || editingTeam) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingTeam ? 'Edit Team' : 'Create New Team'}
            </h2>
            
            <form onSubmit={editingTeam ? handleUpdateTeam : handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., Mumbai Indians"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., MI"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Budget (₹)
                </label>
                <select
                  value={formData.budgetTotal}
                  onChange={(e) => setFormData({ ...formData, budgetTotal: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value={50000000}>₹5 Crores</option>
                  <option value={75000000}>₹7.5 Crores</option>
                  <option value={100000000}>₹10 Crores</option>
                  <option value={120000000}>₹12 Crores</option>
                  <option value={150000000}>₹15 Crores</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Season
                </label>
                <select
                  value={formData.seasonId}
                  onChange={(e) => setFormData({ ...formData, seasonId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                >
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name} {season.year}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false)
                    setEditingTeam(null)
                    setFormData({
                      name: '',
                      displayName: '',
                      budgetTotal: 100000000,
                      seasonId: seasons[0]?.id || ''
                    })
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg"
                >
                  {editingTeam ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}