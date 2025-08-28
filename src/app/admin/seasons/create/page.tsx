'use client'

/**
 * Create Season Page
 * Admin interface for creating new auction seasons
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

interface SeasonFormData {
  name: string
  year: number
  description: string
  maxTeams: number
  budgetCap: number
  playerPoolSize: number
  auctionDate: string
  settings: {
    bidIncrement: number
    lotTimer: number
    maxBidsPerLot: number
    enableAutoExtension: boolean
    autoExtensionTime: number
    rosterConstraints: {
      maxSquadSize: number
      maxOverseasPlayers: number
      minWicketKeepers: number
    }
  }
}

export default function CreateSeasonPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState<SeasonFormData>({
    name: '',
    year: new Date().getFullYear() + 1,
    description: '',
    maxTeams: 8,
    budgetCap: 100000000, // 10 Crores
    playerPoolSize: 200,
    auctionDate: '',
    settings: {
      bidIncrement: 500000, // 5 Lakhs
      lotTimer: 60,
      maxBidsPerLot: 50,
      enableAutoExtension: true,
      autoExtensionTime: 30,
      rosterConstraints: {
        maxSquadSize: 25,
        maxOverseasPlayers: 8,
        minWicketKeepers: 2,
      }
    }
  })

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/login')
      return
    }
  }, [session, status, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Validate form data
      if (!formData.name.trim()) {
        throw new Error('Season name is required')
      }
      
      if (formData.year < new Date().getFullYear()) {
        throw new Error('Season year cannot be in the past')
      }
      
      if (formData.maxTeams < 2 || formData.maxTeams > 16) {
        throw new Error('Number of teams must be between 2 and 16')
      }

      const response = await fetch('/api/seasons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess('Season created successfully!')
        setTimeout(() => {
          router.push('/admin/seasons')
        }, 2000)
      } else {
        throw new Error(data.error || 'Failed to create season')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create season')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    if (field.includes('.')) {
      const [parent, child, subchild] = field.split('.')
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent as keyof SeasonFormData],
          [child]: subchild ? {
            ...(prev[parent as keyof SeasonFormData] as any)[child],
            [subchild]: value
          } : value
        }
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }))
    }
  }

  const formatCurrency = (amount: number) => {
    return `₹${(amount / 10000000).toFixed(1)} Crores`
  }

  if (status === 'loading') {
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
                <Link href="/admin/seasons" className="text-gray-600 hover:text-gray-900">
                  Seasons
                </Link>
                <span className="text-gray-400">/</span>
                <span className="text-orange-600 font-medium">Create</span>
              </nav>
            </div>

            <Link
              href="/admin/seasons"
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span>Back to Seasons</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Season</h1>
          <p className="mt-2 text-gray-600">
            Set up a new auction season with teams, budget caps, and auction rules.
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-2">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <p className="text-green-600">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center space-x-2 mb-6">
              <CalendarDaysIcon className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Basic Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Season Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., IPL 2025"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year *
                </label>
                <input
                  type="number"
                  value={formData.year}
                  onChange={(e) => handleInputChange('year', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min={new Date().getFullYear()}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Brief description of the season..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Auction Date
                </label>
                <input
                  type="datetime-local"
                  value={formData.auctionDate}
                  onChange={(e) => handleInputChange('auctionDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Team & Budget Configuration */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center space-x-2 mb-6">
              <UserGroupIcon className="w-6 h-6 text-green-600" />
              <h2 className="text-xl font-semibold text-gray-900">Team & Budget Configuration</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Teams *
                </label>
                <input
                  type="number"
                  value={formData.maxTeams}
                  onChange={(e) => handleInputChange('maxTeams', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min="2"
                  max="16"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget Cap Per Team
                </label>
                <div className="space-y-2">
                  <input
                    type="number"
                    value={formData.budgetCap}
                    onChange={(e) => handleInputChange('budgetCap', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    step="1000000"
                  />
                  <p className="text-xs text-gray-500">{formatCurrency(formData.budgetCap)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Player Pool Size
                </label>
                <input
                  type="number"
                  value={formData.playerPoolSize}
                  onChange={(e) => handleInputChange('playerPoolSize', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min="50"
                  max="1000"
                />
              </div>
            </div>
          </div>

          {/* Auction Settings */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center space-x-2 mb-6">
              <CurrencyDollarIcon className="w-6 h-6 text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-900">Auction Settings</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bid Increment
                </label>
                <div className="space-y-2">
                  <input
                    type="number"
                    value={formData.settings.bidIncrement}
                    onChange={(e) => handleInputChange('settings.bidIncrement', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    step="100000"
                  />
                  <p className="text-xs text-gray-500">₹{(formData.settings.bidIncrement / 100000).toFixed(1)}L</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lot Timer (seconds)
                </label>
                <input
                  type="number"
                  value={formData.settings.lotTimer}
                  onChange={(e) => handleInputChange('settings.lotTimer', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min="30"
                  max="300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Bids Per Lot
                </label>
                <input
                  type="number"
                  value={formData.settings.maxBidsPerLot}
                  onChange={(e) => handleInputChange('settings.maxBidsPerLot', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min="10"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Auto Extension Time (seconds)
                </label>
                <input
                  type="number"
                  value={formData.settings.autoExtensionTime}
                  onChange={(e) => handleInputChange('settings.autoExtensionTime', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min="15"
                  max="60"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.settings.enableAutoExtension}
                    onChange={(e) => handleInputChange('settings.enableAutoExtension', e.target.checked)}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Enable Auto Extension</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Automatically extend lot timer when bids are placed near the end
                </p>
              </div>
            </div>
          </div>

          {/* Roster Constraints */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center space-x-2 mb-6">
              <TrophyIcon className="w-6 h-6 text-orange-600" />
              <h2 className="text-xl font-semibold text-gray-900">Roster Constraints</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Squad Size
                </label>
                <input
                  type="number"
                  value={formData.settings.rosterConstraints.maxSquadSize}
                  onChange={(e) => handleInputChange('settings.rosterConstraints.maxSquadSize', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min="15"
                  max="30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Overseas Players
                </label>
                <input
                  type="number"
                  value={formData.settings.rosterConstraints.maxOverseasPlayers}
                  onChange={(e) => handleInputChange('settings.rosterConstraints.maxOverseasPlayers', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min="4"
                  max="10"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Wicket Keepers
                </label>
                <input
                  type="number"
                  value={formData.settings.rosterConstraints.minWicketKeepers}
                  onChange={(e) => handleInputChange('settings.rosterConstraints.minWicketKeepers', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  min="1"
                  max="3"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end space-x-4">
            <Link
              href="/admin/seasons"
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg font-medium transition-colors"
            >
              {loading ? 'Creating...' : 'Create Season'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}