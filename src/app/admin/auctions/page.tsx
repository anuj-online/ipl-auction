'use client'

/**
 * Admin Auction Control Center
 * Live auction management and control interface
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  ForwardIcon,
  ClockIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  TrophyIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'

interface Auction {
  id: string
  name: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED'
  season: {
    name: string
    year: number
  }
  currentLot?: {
    id: string
    player: {
      name: string
      role: string
      country: string
      basePrice: number
    }
    currentPrice?: number
    endsAt?: string
  }
  stats: {
    totalLots: number
    completedLots: number
    soldLots: number
    unsoldLots: number
    totalValue: number
    averagePrice: number
  }
}

export default function AuctionControlPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/login')
      return
    }

    fetchAuctions()
  }, [session, status, router])

  const fetchAuctions = async () => {
    try {
      const response = await fetch('/api/auctions')
      if (!response.ok) throw new Error('Failed to fetch auctions')
      
      const data = await response.json()
      setAuctions(data.data.auctions || [])
      
      // Auto-select first active auction
      const activeAuction = data.data.auctions?.find((a: Auction) => 
        a.status === 'IN_PROGRESS' || a.status === 'PAUSED'
      )
      if (activeAuction) {
        setSelectedAuction(activeAuction)
      }
    } catch (error) {
      console.error('Failed to fetch auctions:', error)
      setError('Failed to load auctions')
    } finally {
      setLoading(false)
    }
  }

  const executeAuctionAction = async (action: string, data?: any) => {
    if (!selectedAuction) return
    
    setActionLoading(true)
    setError('')
    
    try {
      const response = await fetch(`/api/auctions/${selectedAuction.id}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, data }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Action failed')
      }
      
      // Refresh auction data
      await fetchAuctions()
    } catch (error) {
      console.error('Action failed:', error)
      setError(error instanceof Error ? error.message : 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return 'bg-green-100 text-green-800'
      case 'PAUSED':
        return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-800'
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
                <span className="text-orange-600 font-medium">Auction Control</span>
              </nav>
            </div>
            
            {selectedAuction && (
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedAuction.status)}`}>
                  {selectedAuction.status.replace('_', ' ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Auction Control Center</h1>
          <p className="mt-2 text-gray-600">
            Manage live auctions, control bidding flow, and monitor auction progress.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Auction List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Available Auctions</h2>
              </div>
              <div className="p-4 space-y-2">
                {auctions.map((auction) => (
                  <button
                    key={auction.id}
                    onClick={() => setSelectedAuction(auction)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selectedAuction?.id === auction.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900 truncate">{auction.name}</h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(auction.status)}`}>
                        {auction.status === 'IN_PROGRESS' ? 'LIVE' : auction.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{auction.season.name}</p>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>{auction.stats.completedLots}/{auction.stats.totalLots} lots</span>
                      <span>₹{(auction.stats.totalValue / 10000000).toFixed(1)}Cr</span>
                    </div>
                  </button>
                ))}
                
                {auctions.length === 0 && (
                  <div className="text-center py-8">
                    <TrophyIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No auctions available</p>
                    <Link
                      href="/admin/seasons"
                      className="text-orange-600 hover:text-orange-700 text-sm mt-2 inline-block"
                    >
                      Create a season first
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Control Panel */}
          <div className="lg:col-span-3">
            {selectedAuction ? (
              <div className="space-y-6">
                {/* Current Lot Info */}
                {selectedAuction.currentLot && (
                  <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-semibold text-gray-900">Current Lot</h2>
                      {selectedAuction.currentLot.endsAt && (
                        <div className="flex items-center space-x-2 text-red-600">
                          <ClockIcon className="w-5 h-5" />
                          <span className="font-mono">
                            {new Date(selectedAuction.currentLot.endsAt).toLocaleTimeString()}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">
                          {selectedAuction.currentLot.player.name}
                        </h3>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>Role: {selectedAuction.currentLot.player.role}</p>
                          <p>Country: {selectedAuction.currentLot.player.country}</p>
                          <p>Base Price: ₹{(selectedAuction.currentLot.player.basePrice / 100000).toFixed(1)}L</p>
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600 mb-1">Current Bid</p>
                          <p className="text-3xl font-bold text-green-600">
                            ₹{selectedAuction.currentLot.currentPrice ? 
                              (selectedAuction.currentLot.currentPrice / 100000).toFixed(1) + 'L' : 
                              'No bids'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Control Buttons */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Auction Controls</h2>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedAuction.status === 'NOT_STARTED' && (
                      <button
                        onClick={() => executeAuctionAction('start')}
                        disabled={actionLoading}
                        className="flex flex-col items-center p-4 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        <PlayIcon className="w-6 h-6 mb-2" />
                        <span>Start Auction</span>
                      </button>
                    )}
                    
                    {selectedAuction.status === 'IN_PROGRESS' && (
                      <>
                        <button
                          onClick={() => executeAuctionAction('pause')}
                          disabled={actionLoading}
                          className="flex flex-col items-center p-4 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          <PauseIcon className="w-6 h-6 mb-2" />
                          <span>Pause</span>
                        </button>
                        
                        <button
                          onClick={() => executeAuctionAction('nextLot')}
                          disabled={actionLoading}
                          className="flex flex-col items-center p-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                          <ForwardIcon className="w-6 h-6 mb-2" />
                          <span>Next Lot</span>
                        </button>
                        
                        {selectedAuction.currentLot && (
                          <>
                            <button
                              onClick={() => executeAuctionAction('forceSell', { 
                                lotId: selectedAuction.currentLot!.id 
                              })}
                              disabled={actionLoading}
                              className="flex flex-col items-center p-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                              <CheckCircleIcon className="w-6 h-6 mb-2" />
                              <span>Force Sell</span>
                            </button>
                            
                            <button
                              onClick={() => executeAuctionAction('markUnsold', { 
                                lotId: selectedAuction.currentLot!.id 
                              })}
                              disabled={actionLoading}
                              className="flex flex-col items-center p-4 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                              <StopIcon className="w-6 h-6 mb-2" />
                              <span>Mark Unsold</span>
                            </button>
                          </>
                        )}
                      </>
                    )}
                    
                    {selectedAuction.status === 'PAUSED' && (
                      <button
                        onClick={() => executeAuctionAction('resume')}
                        disabled={actionLoading}
                        className="flex flex-col items-center p-4 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        <PlayIcon className="w-6 h-6 mb-2" />
                        <span>Resume</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Auction Statistics */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Auction Statistics</h2>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {selectedAuction.stats.completedLots}
                      </p>
                      <p className="text-sm text-gray-600">Lots Completed</p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {selectedAuction.stats.soldLots}
                      </p>
                      <p className="text-sm text-gray-600">Players Sold</p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">
                        ₹{(selectedAuction.stats.totalValue / 10000000).toFixed(1)}Cr
                      </p>
                      <p className="text-sm text-gray-600">Total Value</p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        ₹{(selectedAuction.stats.averagePrice / 100000).toFixed(1)}L
                      </p>
                      <p className="text-sm text-gray-600">Avg Price</p>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Progress</span>
                      <span>{selectedAuction.stats.completedLots} / {selectedAuction.stats.totalLots}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-orange-600 h-2 rounded-full transition-all"
                        style={{ 
                          width: `${(selectedAuction.stats.completedLots / selectedAuction.stats.totalLots) * 100}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <TrophyIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Auction Selected</h3>
                <p className="text-gray-600">Select an auction from the list to begin management.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}