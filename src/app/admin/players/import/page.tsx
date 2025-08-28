'use client'

/**
 * Players Import Page
 * Admin interface for bulk importing players via CSV/Excel
 */

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  CloudArrowUpIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

interface ImportPreview {
  name: string
  role: string
  country: string
  basePrice: number
  stats?: any
  errors?: string[]
}

interface Season {
  id: string
  name: string
  year: number
}

export default function PlayersImportPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [seasons, setSeasons] = useState<Season[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [importStats, setImportStats] = useState<{
    total: number
    valid: number
    errors: number
  } | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/auth/login')
      return
    }

    fetchSeasons()
  }, [session, status, router])

  const fetchSeasons = async () => {
    try {
      const response = await fetch('/api/seasons')
      const data = await response.json()
      
      if (data.success) {
        setSeasons(data.data.seasons || [])
        if (data.data.seasons.length > 0) {
          setSelectedSeasonId(data.data.seasons[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch seasons:', error)
      setError('Failed to load seasons')
    }
  }

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    setPreview([])
    setError('')
    setSuccess('')
    setImportStats(null)
    
    if (selectedFile) {
      parseFile(selectedFile)
    }
  }

  const parseFile = async (file: File) => {
    setLoading(true)
    
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        throw new Error('File must contain at least a header row and one data row')
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const requiredHeaders = ['name', 'role', 'country', 'baseprice']
      
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
      if (missingHeaders.length > 0) {
        throw new Error(`Missing required columns: ${missingHeaders.join(', ')}`)
      }

      const playerData: ImportPreview[] = []
      let validCount = 0
      let errorCount = 0

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        const player: ImportPreview = {
          name: '',
          role: '',
          country: '',
          basePrice: 0,
          errors: []
        }

        // Map values to player object
        headers.forEach((header, index) => {
          const value = values[index] || ''
          
          switch (header) {
            case 'name':
              player.name = value
              if (!value) player.errors?.push('Name is required')
              break
            case 'role':
              player.role = value
              if (!['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER'].includes(value.toUpperCase())) {
                player.errors?.push('Invalid role (must be: BATSMAN, BOWLER, ALL_ROUNDER, WICKET_KEEPER)')
              }
              break
            case 'country':
              player.country = value
              if (!value) player.errors?.push('Country is required')
              break
            case 'baseprice':
              const price = parseInt(value.replace(/[₹,]/g, ''))
              if (isNaN(price) || price < 20000000) { // Min 20L
                player.errors?.push('Base price must be a valid number (minimum ₹20L)')
              } else {
                player.basePrice = price
              }
              break
            // Additional stats can be parsed here
            default:
              if (!player.stats) player.stats = {}
              player.stats[header] = value
              break
          }
        })

        if (player.errors && player.errors.length > 0) {
          errorCount++
        } else {
          validCount++
        }

        playerData.push(player)
      }

      setPreview(playerData)
      setImportStats({
        total: playerData.length,
        valid: validCount,
        errors: errorCount
      })

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to parse file')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!selectedSeasonId) {
      setError('Please select a season')
      return
    }

    if (preview.length === 0) {
      setError('No player data to import')
      return
    }

    const validPlayers = preview.filter(p => !p.errors || p.errors.length === 0)
    
    if (validPlayers.length === 0) {
      setError('No valid players to import')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch('/api/players/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seasonId: selectedSeasonId,
          players: validPlayers.map(p => ({
            name: p.name,
            role: p.role.toUpperCase(),
            country: p.country,
            basePrice: p.basePrice,
            stats: p.stats || {}
          }))
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccess(`Successfully imported ${data.data.imported} players! ${data.data.skipped || 0} duplicates were skipped.`)
        setFile(null)
        setPreview([])
        setImportStats(null)
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      } else {
        throw new Error(data.error || 'Import failed')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    const template = `name,role,country,baseprice,age,experience
Virat Kohli,BATSMAN,India,150000000,35,15
MS Dhoni,WICKET_KEEPER,India,120000000,42,18
Jasprit Bumrah,BOWLER,India,140000000,30,8
Hardik Pandya,ALL_ROUNDER,India,160000000,30,9`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'players_import_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
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
                <Link href="/admin/players" className="text-gray-600 hover:text-gray-900">
                  Players
                </Link>
                <span className="text-gray-400">/</span>
                <span className="text-orange-600 font-medium">Import</span>
              </nav>
            </div>

            <Link
              href="/admin/players"
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              <span>Back to Players</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Import Players</h1>
          <p className="mt-2 text-gray-600">
            Bulk import players from CSV files. Download the template to get started.
          </p>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-2">
            <CheckCircleIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-green-600">{success}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload File</h2>
              
              {/* Season Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Season *
                </label>
                <select
                  value={selectedSeasonId}
                  onChange={(e) => setSelectedSeasonId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  required
                >
                  <option value="">Choose a season</option>
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>
                      {season.name} ({season.year})
                    </option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0]
                    if (selectedFile) handleFileSelect(selectedFile)
                  }}
                  className="hidden"
                />
                
                {!file ? (
                  <div>
                    <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                      >
                        Choose File
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      CSV, Excel files up to 10MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-green-500" />
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null)
                          setPreview([])
                          setImportStats(null)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        className="mt-2 text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove file
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Import Stats */}
            {importStats && (
              <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Summary</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{importStats.total}</p>
                    <p className="text-sm text-gray-600">Total Records</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{importStats.valid}</p>
                    <p className="text-sm text-gray-600">Valid Records</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{importStats.errors}</p>
                    <p className="text-sm text-gray-600">Errors</p>
                  </div>
                </div>
                
                {importStats.valid > 0 && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={handleImport}
                      disabled={loading || !selectedSeasonId}
                      className="px-6 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
                    >
                      {loading ? 'Importing...' : `Import ${importStats.valid} Players`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Preview Table */}
            {preview.length > 0 && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900">Data Preview</h3>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Role
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Country
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Base Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Errors
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {preview.slice(0, 50).map((player, index) => (
                        <tr key={index} className={player.errors && player.errors.length > 0 ? 'bg-red-50' : ''}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {player.errors && player.errors.length > 0 ? (
                              <XMarkIcon className="w-5 h-5 text-red-500" />
                            ) : (
                              <CheckCircleIcon className="w-5 h-5 text-green-500" />
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {player.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {player.role}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {player.country}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {player.basePrice > 0 ? `₹${(player.basePrice / 100000).toFixed(1)}L` : '-'}
                          </td>
                          <td className="px-6 py-4 text-sm text-red-600">
                            {player.errors && player.errors.length > 0 ? (
                              <ul className="list-disc list-inside">
                                {player.errors.map((error, errorIndex) => (
                                  <li key={errorIndex}>{error}</li>
                                ))}
                              </ul>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 50 && (
                    <div className="px-6 py-3 bg-gray-50 text-sm text-gray-500 text-center">
                      Showing first 50 of {preview.length} records
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div>
            <div className="bg-blue-50 rounded-lg p-6 mb-6">
              <div className="flex items-center space-x-2 mb-4">
                <InformationCircleIcon className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold text-blue-900">Import Instructions</h3>
              </div>
              
              <div className="space-y-4 text-sm text-blue-800">
                <div>
                  <h4 className="font-medium">Required Columns:</h4>
                  <ul className="mt-1 list-disc list-inside space-y-1">
                    <li>name - Player's full name</li>
                    <li>role - BATSMAN, BOWLER, ALL_ROUNDER, WICKET_KEEPER</li>
                    <li>country - Player's country</li>
                    <li>baseprice - Base price in rupees (minimum ₹20L)</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium">Optional Columns:</h4>
                  <ul className="mt-1 list-disc list-inside space-y-1">
                    <li>age - Player's age</li>
                    <li>experience - Years of experience</li>
                    <li>Any additional stats columns</li>
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium">File Format:</h4>
                  <ul className="mt-1 list-disc list-inside space-y-1">
                    <li>CSV file (.csv)</li>
                    <li>Excel file (.xlsx, .xls)</li>
                    <li>First row must be headers</li>
                    <li>Maximum file size: 10MB</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6">
                <button
                  onClick={downloadTemplate}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Download Template
                </button>
              </div>
            </div>

            {/* Recent Imports */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tips</h3>
              <div className="space-y-3 text-sm text-gray-600">
                <p>• Ensure player names are unique within each season</p>
                <p>• Base prices should be realistic (₹20L to ₹25Cr range)</p>
                <p>• Use standard country names (India, Australia, England, etc.)</p>
                <p>• Duplicate players will be skipped during import</p>
                <p>• Invalid rows will be highlighted in red</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}