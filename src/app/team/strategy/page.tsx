'use client'

/**
 * Team Strategy Planner
 * Strategic planning tools for team managers to plan their auction approach
 * Mobile-first design with budget planning, role prioritization, and strategy notes
 */

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  StarIcon,
  CalculatorIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import { MobileHeader, MobileCard, MobileTabs } from '@/components/mobile'

interface StrategyBudget {
  totalBudget: number
  currentSpent: number
  remaining: number
  allocations: {
    BATSMAN: number
    BOWLER: number
    ALL_ROUNDER: number
    WICKET_KEEPER: number
    reserve: number
  }
}

interface RoleStrategy {
  role: string
  targetCount: { min: number; max: number }
  budgetAllocation: number
  priorities: string[]
  maxBidPerPlayer: number
  notes: string
}

interface TargetPlayer {
  id: string
  name: string
  role: string
  country: string
  basePrice: number
  maxBid: number
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  notes: string
  isOverseas: boolean
}

interface AuctionStrategy {
  id?: string
  teamId: string
  seasonId: string
  budget: StrategyBudget
  roleStrategies: RoleStrategy[]
  targetPlayers: TargetPlayer[]
  generalNotes: string
  lastUpdated: string
}

export default function TeamStrategyPlanner() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [strategy, setStrategy] = useState<AuctionStrategy | null>(null)
  const [activeTab, setActiveTab] = useState('budget')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Form states
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [showAddTarget, setShowAddTarget] = useState(false)
  const [newTarget, setNewTarget] = useState<Partial<TargetPlayer>>({
    priority: 'MEDIUM',
    maxBid: 0,
    notes: ''
  })

  const roleOptions = ['BATSMAN', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER']

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session || session.user.role !== 'TEAM') {
      router.push('/auth/login')
      return
    }

    fetchStrategy()
  }, [session, status, router])

  const fetchStrategy = async () => {
    try {
      const response = await fetch(`/api/teams/${session!.user.teamId}/strategy`)
      const data = await response.json()
      
      if (data.success) {
        setStrategy(data.data.strategy)
      } else if (response.status === 404) {
        // Create initial strategy
        await createInitialStrategy()
      } else {
        throw new Error(data.error || 'Failed to fetch strategy')
      }
    } catch (error) {
      console.error('Failed to fetch strategy:', error)
      setError('Failed to load strategy')
    } finally {
      setLoading(false)
    }
  }

  const createInitialStrategy = async () => {
    try {
      const teamResponse = await fetch(`/api/teams/${session!.user.teamId}`)
      const teamData = await teamResponse.json()
      
      if (!teamData.success) throw new Error('Failed to fetch team data')
      
      const team = teamData.data.team
      const currentSpent = team.budgetSpent || 0
      const remaining = team.budgetTotal - currentSpent
      
      const initialStrategy: AuctionStrategy = {
        teamId: team.id,
        seasonId: team.seasonId,
        budget: {
          totalBudget: team.budgetTotal,
          currentSpent,
          remaining,
          allocations: {
            BATSMAN: Math.round(remaining * 0.35), // 35% for batsmen
            BOWLER: Math.round(remaining * 0.35),  // 35% for bowlers
            ALL_ROUNDER: Math.round(remaining * 0.20), // 20% for all-rounders
            WICKET_KEEPER: Math.round(remaining * 0.05), // 5% for wicket-keepers
            reserve: Math.round(remaining * 0.05) // 5% reserve
          }
        },
        roleStrategies: roleOptions.map(role => ({
          role,
          targetCount: { min: getMinCount(role), max: getMaxCount(role) },
          budgetAllocation: getInitialAllocation(role, remaining),
          priorities: [],
          maxBidPerPlayer: Math.round(getInitialAllocation(role, remaining) / getMaxCount(role)),
          notes: ''
        })),
        targetPlayers: [],
        generalNotes: '',
        lastUpdated: new Date().toISOString()
      }
      
      setStrategy(initialStrategy)
      await saveStrategy(initialStrategy)
    } catch (error) {
      console.error('Failed to create initial strategy:', error)
      setError('Failed to create initial strategy')
    }
  }

  const getMinCount = (role: string) => {
    switch (role) {
      case 'BATSMAN': return 5
      case 'BOWLER': return 5
      case 'ALL_ROUNDER': return 2
      case 'WICKET_KEEPER': return 1
      default: return 0
    }
  }

  const getMaxCount = (role: string) => {
    switch (role) {
      case 'BATSMAN': return 8
      case 'BOWLER': return 8
      case 'ALL_ROUNDER': return 4
      case 'WICKET_KEEPER': return 2
      default: return 0
    }
  }

  const getInitialAllocation = (role: string, total: number) => {
    switch (role) {
      case 'BATSMAN': return Math.round(total * 0.35)
      case 'BOWLER': return Math.round(total * 0.35)
      case 'ALL_ROUNDER': return Math.round(total * 0.20)
      case 'WICKET_KEEPER': return Math.round(total * 0.05)
      default: return 0
    }
  }

  const saveStrategy = async (strategyToSave: AuctionStrategy = strategy!) => {
    if (!strategyToSave) return
    
    setSaving(true)
    setError('')
    
    try {
      const response = await fetch(`/api/teams/${session!.user.teamId}/strategy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...strategyToSave,
          lastUpdated: new Date().toISOString()
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setStrategy(data.data.strategy)
        setSuccess('Strategy saved successfully')
        setTimeout(() => setSuccess(''), 3000)
      } else {
        throw new Error(data.error || 'Failed to save strategy')
      }
    } catch (error) {
      console.error('Failed to save strategy:', error)
      setError('Failed to save strategy')
    } finally {
      setSaving(false)
    }
  }

  const updateBudgetAllocation = (role: string, amount: number) => {
    if (!strategy) return
    
    const updatedStrategy = {
      ...strategy,
      budget: {
        ...strategy.budget,
        allocations: {
          ...strategy.budget.allocations,
          [role]: amount
        }
      }
    }
    
    setStrategy(updatedStrategy)
  }

  const updateRoleStrategy = (role: string, updates: Partial<RoleStrategy>) => {
    if (!strategy) return
    
    const updatedStrategy = {
      ...strategy,
      roleStrategies: strategy.roleStrategies.map(rs =>
        rs.role === role ? { ...rs, ...updates } : rs
      )
    }
    
    setStrategy(updatedStrategy)
  }

  const addTargetPlayer = async () => {
    if (!newTarget.name || !newTarget.role || !strategy) return
    
    const targetPlayer: TargetPlayer = {
      id: `target_${Date.now()}`,
      name: newTarget.name!,
      role: newTarget.role!,
      country: newTarget.country || 'Unknown',
      basePrice: newTarget.basePrice || 0,
      maxBid: newTarget.maxBid!,
      priority: newTarget.priority as 'HIGH' | 'MEDIUM' | 'LOW',
      notes: newTarget.notes || '',
      isOverseas: newTarget.isOverseas || false
    }
    
    const updatedStrategy = {
      ...strategy,
      targetPlayers: [...strategy.targetPlayers, targetPlayer]
    }
    
    setStrategy(updatedStrategy)
    setNewTarget({ priority: 'MEDIUM', maxBid: 0, notes: '' })
    setShowAddTarget(false)
  }

  const removeTargetPlayer = (id: string) => {
    if (!strategy) return
    
    const updatedStrategy = {
      ...strategy,
      targetPlayers: strategy.targetPlayers.filter(tp => tp.id !== id)
    }
    
    setStrategy(updatedStrategy)
  }

  const formatCurrency = (amount: number) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(1)}Cr`
    } else {
      return `₹${(amount / 100000).toFixed(1)}L`
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-red-100 text-red-800'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800'
      case 'LOW': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const tabs = [
    { id: 'budget', label: 'Budget Plan', icon: <CurrencyDollarIcon className="w-4 h-4" /> },
    { id: 'roles', label: 'Role Strategy', icon: <UserGroupIcon className="w-4 h-4" /> },
    { id: 'targets', label: 'Target Players', icon: <StarIcon className="w-4 h-4" /> },
    { id: 'notes', label: 'Notes', icon: <ClipboardDocumentListIcon className="w-4 h-4" /> }
  ]

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!strategy) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Strategy Not Found</h3>
          <p className="text-gray-600 mb-6">Unable to load your auction strategy.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <MobileHeader
        title="Strategy Planner"
        subtitle="Plan your auction approach"
        onBack={() => router.push('/team')}
        actions={
          <button
            onClick={() => saveStrategy()}
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              saving 
                ? 'bg-gray-300 text-gray-500' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        }
      />

      <div className="p-4 max-w-4xl mx-auto">
        {/* Status Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 flex items-center space-x-2">
            <CheckCircleIcon className="w-5 h-5 text-green-600" />
            <p className="text-green-600 text-sm">{success}</p>
          </div>
        )}

        {/* Tabs */}
        <MobileTabs 
          tabs={tabs} 
          activeTab={activeTab} 
          onChange={setActiveTab}
        />

        {/* Tab Content */}
        <div className="mt-4 space-y-4">
          {/* Budget Plan Tab */}
          {activeTab === 'budget' && (
            <div className="space-y-4">
              <MobileCard>
                <h2 className="text-lg font-semibold mb-4">Budget Overview</h2>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(strategy.budget.totalBudget)}
                    </p>
                    <p className="text-sm text-gray-600">Total Budget</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(strategy.budget.remaining)}
                    </p>
                    <p className="text-sm text-gray-600">Available</p>
                  </div>
                </div>

                <h3 className="text-md font-medium mb-3">Role Allocations</h3>
                <div className="space-y-3">
                  {Object.entries(strategy.budget.allocations).map(([role, amount]) => (
                    <div key={role} className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">
                        {role.replace('_', ' ')}
                      </span>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={amount}
                          onChange={(e) => updateBudgetAllocation(role, parseInt(e.target.value) || 0)}
                          className="w-24 px-2 py-1 border rounded text-sm text-right"
                          min="0"
                          max={strategy.budget.remaining}
                        />
                        <span className="text-sm text-gray-600">
                          {formatCurrency(amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </MobileCard>
            </div>
          )}

          {/* Role Strategy Tab */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              {strategy.roleStrategies.map((roleStrategy) => (
                <MobileCard key={roleStrategy.role}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold capitalize">
                      {roleStrategy.role.replace('_', ' ')}
                    </h3>
                    <button
                      onClick={() => setEditingRole(
                        editingRole === roleStrategy.role ? null : roleStrategy.role
                      )}
                      className="p-1 text-gray-400 hover:text-indigo-600"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-600">Target Count</p>
                      <p className="font-medium">
                        {roleStrategy.targetCount.min}-{roleStrategy.targetCount.max} players
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Budget</p>
                      <p className="font-medium">
                        {formatCurrency(roleStrategy.budgetAllocation)}
                      </p>
                    </div>
                  </div>

                  {editingRole === roleStrategy.role && (
                    <div className="border-t pt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-gray-600">Min Players</label>
                          <input
                            type="number"
                            value={roleStrategy.targetCount.min}
                            onChange={(e) => updateRoleStrategy(roleStrategy.role, {
                              targetCount: {
                                ...roleStrategy.targetCount,
                                min: parseInt(e.target.value) || 0
                              }
                            })}
                            className="w-full px-2 py-1 border rounded text-sm"
                            min="0"
                            max="25"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600">Max Players</label>
                          <input
                            type="number"
                            value={roleStrategy.targetCount.max}
                            onChange={(e) => updateRoleStrategy(roleStrategy.role, {
                              targetCount: {
                                ...roleStrategy.targetCount,
                                max: parseInt(e.target.value) || 0
                              }
                            })}
                            className="w-full px-2 py-1 border rounded text-sm"
                            min="0"
                            max="25"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="text-xs text-gray-600">Max Bid Per Player</label>
                        <input
                          type="number"
                          value={roleStrategy.maxBidPerPlayer}
                          onChange={(e) => updateRoleStrategy(roleStrategy.role, {
                            maxBidPerPlayer: parseInt(e.target.value) || 0
                          })}
                          className="w-full px-2 py-1 border rounded text-sm"
                          min="0"
                        />
                      </div>
                      
                      <div>
                        <label className="text-xs text-gray-600">Notes</label>
                        <textarea
                          value={roleStrategy.notes}
                          onChange={(e) => updateRoleStrategy(roleStrategy.role, {
                            notes: e.target.value
                          })}
                          className="w-full px-2 py-1 border rounded text-sm"
                          rows={2}
                          placeholder="Strategy notes for this role..."
                        />
                      </div>
                    </div>
                  )}
                </MobileCard>
              ))}
            </div>
          )}

          {/* Target Players Tab */}
          {activeTab === 'targets' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">Target Players</h2>
                <button
                  onClick={() => setShowAddTarget(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm font-medium flex items-center space-x-1"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Add Target</span>
                </button>
              </div>

              {showAddTarget && (
                <MobileCard>
                  <h3 className="text-md font-semibold mb-3">Add Target Player</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Player Name"
                      value={newTarget.name || ''}
                      onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                    
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={newTarget.role || ''}
                        onChange={(e) => setNewTarget({ ...newTarget, role: e.target.value })}
                        className="px-3 py-2 border rounded-lg"
                      >
                        <option value="">Select Role</option>
                        {roleOptions.map(role => (
                          <option key={role} value={role}>
                            {role.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                      
                      <select
                        value={newTarget.priority || 'MEDIUM'}
                        onChange={(e) => setNewTarget({ ...newTarget, priority: e.target.value as any })}
                        className="px-3 py-2 border rounded-lg"
                      >
                        <option value="HIGH">High Priority</option>
                        <option value="MEDIUM">Medium Priority</option>
                        <option value="LOW">Low Priority</option>
                      </select>
                    </div>
                    
                    <input
                      type="number"
                      placeholder="Max Bid (₹)"
                      value={newTarget.maxBid || ''}
                      onChange={(e) => setNewTarget({ ...newTarget, maxBid: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                    
                    <textarea
                      placeholder="Notes about this player..."
                      value={newTarget.notes || ''}
                      onChange={(e) => setNewTarget({ ...newTarget, notes: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      rows={2}
                    />
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={addTargetPlayer}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium"
                      >
                        Add Player
                      </button>
                      <button
                        onClick={() => {
                          setShowAddTarget(false)
                          setNewTarget({ priority: 'MEDIUM', maxBid: 0, notes: '' })
                        }}
                        className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </MobileCard>
              )}

              {/* Target Players List */}
              {strategy.targetPlayers.map((player) => (
                <MobileCard key={player.id}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{player.name}</h3>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-sm text-gray-600">
                          {player.role.replace('_', ' ')} • {player.country}
                        </span>
                        {player.isOverseas && (
                          <span className="text-xs bg-orange-100 text-orange-800 px-2 py-0.5 rounded">
                            Overseas
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 mt-2">
                        <span className={`text-xs px-2 py-1 rounded ${getPriorityColor(player.priority)}`}>
                          {player.priority}
                        </span>
                        <span className="text-sm font-medium text-green-600">
                          Max: {formatCurrency(player.maxBid)}
                        </span>
                      </div>
                      {player.notes && (
                        <p className="text-sm text-gray-600 mt-2">{player.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeTargetPlayer(player.id)}
                      className="ml-2 p-1 text-gray-400 hover:text-red-600"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </MobileCard>
              ))}

              {strategy.targetPlayers.length === 0 && !showAddTarget && (
                <MobileCard className="text-center py-8">
                  <StarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Target Players</h3>
                  <p className="text-gray-600 mb-4">Add players you want to target in the auction</p>
                  <button
                    onClick={() => setShowAddTarget(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium"
                  >
                    Add Your First Target
                  </button>
                </MobileCard>
              )}
            </div>
          )}

          {/* Notes Tab */}
          {activeTab === 'notes' && (
            <MobileCard>
              <h2 className="text-lg font-semibold mb-4">General Strategy Notes</h2>
              <textarea
                value={strategy.generalNotes}
                onChange={(e) => setStrategy({ ...strategy, generalNotes: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                rows={8}
                placeholder="Write your general auction strategy, backup plans, and important notes here..."
              />
              <div className="mt-4 text-sm text-gray-500">
                <p>Last updated: {new Date(strategy.lastUpdated).toLocaleDateString()}</p>
              </div>
            </MobileCard>
          )}
        </div>
      </div>
    </div>
  )
}