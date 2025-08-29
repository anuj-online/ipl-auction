'use client'

/**
 * Create Auction Page
 * Admin interface for creating new auctions
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  TrophyIcon,
  UserGroupIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'

interface Season {
  id: string
  name: string
  year: number
  teams: number
  players: number
  hasActiveAuction: boolean
}

interface AuctionSettings {
  lotDuration: number
  softCloseThreshold: number
  softCloseExtension: number
  maxExtensions: number
  allowAutoBidding: boolean
  bidIncrement: number
}

interface AuctionFormData {
  name: string
  seasonId: string
  settings: AuctionSettings
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  seasonInfo?: {
    teams: number
    players: number
    totalBudget: number
    estimatedPlayerValue: number
  }
}

export default function CreateAuctionPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  
  const [formData, setFormData] = useState<AuctionFormData>({
    name: '',
    seasonId: '',
    settings: {
      lotDuration: 60000, // 60 seconds in milliseconds
      softCloseThreshold: 10000, // 10 seconds
      softCloseExtension: 30000, // 30 seconds
      maxExtensions: 3,
      allowAutoBidding: true,
      bidIncrement: 500000, // 5 Lakhs
    }
  })

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/signin')
      return
    }

    fetchSeasons()
  }, [session, status, router])

  useEffect(() => {
    if (formData.seasonId) {
      validateAuctionSetup()
    } else {
      setValidation(null)
    }
  }, [formData.seasonId])

  const fetchSeasons = async () => {
    try {
      const response = await fetch('/api/seasons?includeStats=true')
      const data = await response.json()
      
      if (data.success) {
        const seasonsWithStats = await Promise.all(
          data.data.seasons.map(async (season: any) => {
            // Get teams count
            const teamsResponse = await fetch(`/api/teams?seasonId=${season.id}`)
            const teamsData = await teamsResponse.json()
            
            // Get players count
            const playersResponse = await fetch(`/api/players?seasonId=${season.id}`)
            const playersData = await playersResponse.json()
            
            // Check for active auction
            const auctionsResponse = await fetch(`/api/auctions?seasonId=${season.id}&status=IN_PROGRESS,PAUSED`)
            const auctionsData = await auctionsResponse.json()
            
            return {
              ...season,
              teams: teamsData.success ? teamsData.data.teams.length : 0,
              players: playersData.success ? playersData.data.players.length : 0,
              hasActiveAuction: auctionsData.success && auctionsData.data.auctions.length > 0
            }
          })
        )
        
        setSeasons(seasonsWithStats)
        
        // Auto-select first eligible season
        const eligibleSeason = seasonsWithStats.find((s: Season) => !s.hasActiveAuction)
        if (eligibleSeason) {
          setFormData(prev => ({ 
            ...prev, 
            seasonId: eligibleSeason.id,
            name: `${eligibleSeason.name} Player Auction`
          }))
        }
      }
    } catch (error) {
      console.error('Failed to fetch seasons:', error)
      setError('Failed to load seasons')
    } finally {
      setLoading(false)
    }
  }

  const validateAuctionSetup = async () => {
    if (!formData.seasonId) return
    
    setValidating(true)
    try {
      const response = await fetch(`/api/auctions/validate?seasonId=${formData.seasonId}`)
      const data = await response.json()
      
      if (data.success) {
        setValidation(data.data)
      } else {
        setError(data.error || 'Validation failed')
      }
    } catch (error) {
      console.error('Validation failed:', error)
      setError('Failed to validate auction setup')
    } finally {
      setValidating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      setError('Auction name is required')
      return
    }
    
    if (!formData.seasonId) {
      setError('Please select a season')
      return
    }
    
    if (validation && !validation.isValid) {
      setError('Please fix validation errors before creating the auction')
      return
    }
    
    setCreating(true)
    setError('')
    
    try {
      const response = await fetch('/api/auctions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      const data = await response.json()
      
      if (data.success) {
        setSuccess('Auction created successfully!')
        setTimeout(() => {
          router.push('/admin/auctions')
        }, 2000)
      } else {
        throw new Error(data.error || 'Failed to create auction')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create auction')
    } finally {
      setCreating(false)
    }
  }

  const formatDuration = (milliseconds: number) => {
    return `${milliseconds / 1000}s`
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Link 
                href="/admin/auctions" 
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeftIcon className="h-5 w-5" />
                <span>Back to Auctions</span>
              </Link>
              <span className="text-gray-400">|</span>
              <h1 className="text-2xl font-bold text-gray-900">Create New Auction</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
            <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700">×</button>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-2">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <p className="text-green-700">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Auction Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      placeholder="e.g., IPL 2025 Player Auction"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Season *
                    </label>
                    <select
                      value={formData.seasonId}
                      onChange={(e) => setFormData({ ...formData, seasonId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                      required
                    >
                      <option value="">Select a season</option>
                      {seasons.map((season) => (
                        <option 
                          key={season.id} 
                          value={season.id}
                          disabled={season.hasActiveAuction}
                        >
                          {season.name} {season.year} 
                          {season.hasActiveAuction && ' (Active Auction)'}
                          {!season.hasActiveAuction && ` (${season.teams} teams, ${season.players} players)`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Auction Settings */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Auction Settings</h3>
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="text-sm text-orange-600 hover:text-orange-800"
                  >
                    {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Lot Duration
                    </label>
                    <select
                      value={formData.settings.lotDuration}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        settings: { ...formData.settings, lotDuration: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      <option value={30000}>30 seconds</option>
                      <option value={60000}>60 seconds</option>
                      <option value={90000}>90 seconds</option>
                      <option value={120000}>2 minutes</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bid Increment
                    </label>
                    <select
                      value={formData.settings.bidIncrement}
                      onChange={(e) => setFormData({ 
                        ...formData, 
                        settings: { ...formData.settings, bidIncrement: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    >
                      <option value={250000}>₹2.5 Lakhs</option>
                      <option value={500000}>₹5 Lakhs</option>
                      <option value={1000000}>₹10 Lakhs</option>
                      <option value={2500000}>₹25 Lakhs</option>
                    </select>
                  </div>
                  
                  {showAdvanced && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Soft Close Threshold
                        </label>
                        <select
                          value={formData.settings.softCloseThreshold}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            settings: { ...formData.settings, softCloseThreshold: parseInt(e.target.value) }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        >
                          <option value={5000}>5 seconds</option>
                          <option value={10000}>10 seconds</option>
                          <option value={15000}>15 seconds</option>
                          <option value={20000}>20 seconds</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Extension Duration
                        </label>
                        <select
                          value={formData.settings.softCloseExtension}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            settings: { ...formData.settings, softCloseExtension: parseInt(e.target.value) }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        >
                          <option value={15000}>15 seconds</option>
                          <option value={30000}>30 seconds</option>
                          <option value={45000}>45 seconds</option>
                          <option value={60000}>60 seconds</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Extensions
                        </label>
                        <select
                          value={formData.settings.maxExtensions}
                          onChange={(e) => setFormData({ 
                            ...formData, 
                            settings: { ...formData.settings, maxExtensions: parseInt(e.target.value) }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        >
                          <option value={1}>1 extension</option>
                          <option value={2}>2 extensions</option>
                          <option value={3}>3 extensions</option>
                          <option value={5}>5 extensions</option>
                        </select>
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.settings.allowAutoBidding}
                            onChange={(e) => setFormData({ 
                              ...formData, 
                              settings: { ...formData.settings, allowAutoBidding: e.target.checked }
                            })}
                            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Allow Auto-Bidding</span>
                        </label>
                        <p className="text-xs text-gray-500 mt-1">Teams can set automatic bidding strategies</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex space-x-4">
                <Link
                  href="/admin/auctions"
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-center"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={creating || (validation?.isValid === false)}
                  className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-lg font-medium flex items-center justify-center space-x-2"
                >
                  {creating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <PlayIcon className="h-5 w-5" />
                      <span>Create Auction</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Sidebar - Validation & Info */}
          <div className="lg:col-span-1">
            {/* Validation Status */}
            {formData.seasonId && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Setup Validation</h3>
                
                {validating ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                    <span className="text-gray-600">Validating...</span>
                  </div>
                ) : validation ? (
                  <div className="space-y-3">
                    {validation.isValid ? (
                      <div className="flex items-center space-x-2 text-green-600">
                        <CheckCircleIcon className="h-5 w-5" />
                        <span className="font-medium">Ready to create auction</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 text-red-600">
                        <ExclamationTriangleIcon className="h-5 w-5" />
                        <span className="font-medium">Setup incomplete</span>
                      </div>
                    )}
                    
                    {validation.errors.map((error, index) => (
                      <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {error}
                      </div>
                    ))}
                    
                    {validation.warnings.map((warning, index) => (
                      <div key={index} className="text-sm text-yellow-600 bg-yellow-50 p-2 rounded">
                        {warning}
                      </div>
                    ))}
                    
                    {validation.seasonInfo && (
                      <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Teams:</span>
                          <span className="font-medium">{validation.seasonInfo.teams}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Players:</span>
                          <span className="font-medium">{validation.seasonInfo.players}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Budget:</span>
                          <span className="font-medium">{formatCurrency(validation.seasonInfo.totalBudget)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Est. Player Value:</span>
                          <span className="font-medium">{formatCurrency(validation.seasonInfo.estimatedPlayerValue)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Auction Settings Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Settings Summary</h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Lot Duration:</span>
                  <span className="font-medium">{formatDuration(formData.settings.lotDuration)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Bid Increment:</span>
                  <span className="font-medium">{formatCurrency(formData.settings.bidIncrement)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Soft Close:</span>
                  <span className="font-medium">{formatDuration(formData.settings.softCloseThreshold)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Extension:</span>
                  <span className="font-medium">{formatDuration(formData.settings.softCloseExtension)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Max Extensions:</span>
                  <span className="font-medium">{formData.settings.maxExtensions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Auto-Bidding:</span>
                  <span className="font-medium">{formData.settings.allowAutoBidding ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}