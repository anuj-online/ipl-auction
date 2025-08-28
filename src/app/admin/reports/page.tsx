'use client'

/**
 * Admin Reports Dashboard
 * Auction analytics and reporting interface
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  ChartBarIcon,
  DocumentArrowDownIcon,
  ArrowPathIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'

interface ReportData {
  reportType: string
  generatedAt: string
  data: any
}

type ReportType = 'summary' | 'detailed' | 'team-performance' | 'player-analysis' | 'bidding-patterns'

export default function AdminReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('summary')

  const reportTypes = [
    { value: 'summary', label: 'Summary Report' },
    { value: 'detailed', label: 'Detailed Report' },
    { value: 'team-performance', label: 'Team Performance' },
    { value: 'player-analysis', label: 'Player Analysis' },
    { value: 'bidding-patterns', label: 'Bidding Patterns' }
  ]

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/login')
      return
    }
  }, [session, status, router])

  const generateReport = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`/api/admin/reports?reportType=${selectedReportType}`)
      const data = await response.json()

      if (data.success) {
        setReportData(data.data)
      } else {
        throw new Error(data.error || 'Failed to generate report')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const exportReport = () => {
    if (!reportData) return
    
    const dataStr = JSON.stringify(reportData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    
    link.href = url
    link.download = `auction-report-${reportData.reportType}-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`
    return `₹${(amount / 100000).toFixed(1)}L`
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-orange-500"></div>
      </div>
    )
  }

  if (!session || session.user.role !== 'ADMIN') return null

  return (
    <div className="min-h-screen bg-gray-50">
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
              <span className="text-orange-600 font-medium">Reports & Analytics</span>
            </div>
            <Link href="/admin" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
              <ArrowLeftIcon className="w-5 h-5" />
              <span>Back</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="mt-2 text-gray-600">Generate comprehensive auction performance reports.</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Controls */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center space-x-2 mb-6">
                <FunnelIcon className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-900">Configuration</h2>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Report Type</label>
                  <select
                    value={selectedReportType}
                    onChange={(e) => setSelectedReportType(e.target.value as ReportType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    {reportTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={generateReport}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white rounded-lg font-medium"
                >
                  {loading ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <ChartBarIcon className="w-4 h-4" />
                      <span>Generate Report</span>
                    </>
                  )}
                </button>

                {reportData && (
                  <button
                    onClick={exportReport}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                  >
                    <DocumentArrowDownIcon className="w-4 h-4" />
                    <span>Export JSON</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-2">
            {reportData ? (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {reportTypes.find(t => t.value === reportData.reportType)?.label}
                  </h2>
                  <p className="text-gray-600">Generated: {new Date(reportData.generatedAt).toLocaleString()}</p>
                </div>

                {/* Summary Report Display */}
                {selectedReportType === 'summary' && reportData.data.overview && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">{reportData.data.overview.totalAuctions}</p>
                        <p className="text-sm text-gray-600">Auctions</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{reportData.data.overview.totalPlayersSold}</p>
                        <p className="text-sm text-gray-600">Players Sold</p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <p className="text-2xl font-bold text-purple-600">{reportData.data.overview.totalTeams}</p>
                        <p className="text-sm text-gray-600">Teams</p>
                      </div>
                      <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <p className="text-2xl font-bold text-orange-600">{formatCurrency(reportData.data.overview.totalValue)}</p>
                        <p className="text-sm text-gray-600">Total Value</p>
                      </div>
                    </div>

                    {reportData.data.topSales && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Top Sales</h3>
                        <div className="space-y-2">
                          {reportData.data.topSales.slice(0, 5).map((sale: any, index: number) => (
                            <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                              <div>
                                <p className="font-medium">{sale.playerName}</p>
                                <p className="text-sm text-gray-500">{sale.role} • {sale.team}</p>
                              </div>
                              <span className="font-bold text-green-600">{formatCurrency(sale.finalPrice)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Generic JSON display for other report types */}
                {selectedReportType !== 'summary' && (
                  <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
                    <pre className="text-sm">{JSON.stringify(reportData.data, null, 2)}</pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <ChartBarIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Report Generated</h3>
                <p className="text-gray-600">Select a report type and click "Generate Report" to view analytics.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}