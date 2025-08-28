'use client'

/**
 * Sign In Page
 * Authentication interface with role-based UI display
 * Shows different dashboards based on user role (admin vs team)
 */

import { useState, useEffect } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  EyeIcon, 
  EyeSlashIcon, 
  ExclamationTriangleIcon,
  ChartBarIcon,
  UserGroupIcon,
  PlayCircleIcon,
  CogIcon,
  CurrencyDollarIcon,
  TrophyIcon,
  ClockIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline'

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [waitingForSession, setWaitingForSession] = useState(false)
  const router = useRouter()
  const { data: session, status } = useSession()

  // Handle session establishment for form feedback
  useEffect(() => {
    if (waitingForSession && status === 'authenticated' && session?.user?.role) {
      console.log('Login successful, showing role-based UI:', session.user.role)
      setWaitingForSession(false)
      setIsLoading(false)
    }
    
    // Handle session establishment timeout
    if (waitingForSession && status === 'unauthenticated') {
      setWaitingForSession(false)
      setError('Session establishment failed. Please try again.')
      setIsLoading(false)
    }
  }, [session, status, waitingForSession])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setWaitingForSession(false)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('Invalid credentials. Please try again.')
        setIsLoading(false)
      } else if (result?.ok) {
        console.log('Sign in successful, waiting for session establishment...')
        setWaitingForSession(true)
        // Don't set loading to false here - let the session effect handle it
        
        // Set a timeout to handle cases where session doesn't establish
        setTimeout(() => {
          if (waitingForSession) {
            setWaitingForSession(false)
            setError('Login timeout. Please try again.')
            setIsLoading(false)
          }
        }, 10000) // 10 second timeout
      }
    } catch (error) {
      console.error('Login error:', error)
      setError('An error occurred. Please try again.')
      setIsLoading(false)
      setWaitingForSession(false)
    }
  }

  const handleSignOut = async () => {
    await signOut({ redirect: false })
    // Page will re-render showing login form
  }

  const demoAccounts = [
    { role: 'Admin', email: 'admin@iplauction.com', password: 'admin123' },
    { role: 'Team (MI)', email: 'mi@iplauction.com', password: 'team123' },
    { role: 'Team (CSK)', email: 'csk@iplauction.com', password: 'team123' },
  ]

  // If user is already authenticated, show role-based UI
  if (status === 'authenticated' && session?.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900">
        {/* Header */}
        <nav className="bg-white/10 backdrop-blur-lg border-b border-white/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">IPL</span>
                </div>
                <span className="text-white text-xl font-bold">Auction Pro</span>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-white">
                  <span className="text-sm text-blue-200">Welcome,</span>
                  <span className="ml-1 font-medium">{session.user.name || session.user.email}</span>
                  <span className="ml-2 px-2 py-1 bg-orange-500 rounded text-xs font-medium">
                    {session.user.role}
                  </span>
                </div>
                
                <button
                  onClick={handleSignOut}
                  className="text-blue-200 hover:text-white transition-colors p-2"
                  title="Sign Out"
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Role-based Dashboard Content */}
        {session.user.role === 'ADMIN' ? (
          <AdminDashboardUI />
        ) : session.user.role === 'TEAM' ? (
          <TeamDashboardUI session={session} />
        ) : (
          <ViewerDashboardUI />
        )}
      </div>
    )
  }

  // Show loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  // Show signin form for unauthenticated users
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center space-x-2 mb-6">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">IPL</span>
            </div>
            <span className="text-white text-2xl font-bold">Auction Pro</span>
          </Link>
          <h2 className="text-3xl font-bold text-white">Sign in to your account</h2>
          <p className="mt-2 text-blue-200">
            Enter your credentials to access the auction system
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center space-x-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
                <span className="text-red-200">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-blue-300 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent pr-12"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-blue-300 hover:text-white"
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-5 h-5" />
                  ) : (
                    <EyeIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || waitingForSession}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {waitingForSession ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Establishing session...</span>
                </div>
              ) : isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Demo Accounts */}
          <div className="mt-8">
            <div className="text-center">
              <h3 className="text-sm font-medium text-white mb-4">Demo Accounts</h3>
              <div className="space-y-2">
                {demoAccounts.map((account, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setEmail(account.email)
                      setPassword(account.password)
                    }}
                    className="w-full text-left px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-white font-medium">{account.role}</span>
                      <span className="text-blue-300 text-sm">{account.email}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-blue-300 hover:text-white transition-colors text-sm"
            >
              ← Back to homepage
            </Link>
          </div>
        </div>

        {/* Additional Info */}
        <div className="text-center">
          <p className="text-blue-200 text-sm">
            Don't have an account?{' '}
            <Link href="/demo" className="text-orange-400 hover:text-orange-300 font-medium">
              Try the demo
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

// Admin Dashboard UI Component
function AdminDashboardUI() {
  const quickActions = [
    {
      name: 'Manage Seasons',
      description: 'Create and configure auction seasons',
      href: '/admin/seasons',
      icon: ChartBarIcon,
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
      description: 'Import and manage player data',
      href: '/admin/players',
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Admin Dashboard</h1>
        <p className="text-blue-200">Manage your auction system</p>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {quickActions.map((action, index) => (
          <Link
            key={index}
            href={action.href}
            className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:border-white/30 transition-all group"
          >
            <div className={`w-12 h-12 ${action.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <action.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{action.name}</h3>
            <p className="text-blue-200 text-sm">{action.description}</p>
          </Link>
        ))}
      </div>

      {/* Stats Preview */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <h3 className="text-white font-semibold mb-2">System Status</h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="text-green-400">All systems operational</span>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <h3 className="text-white font-semibold mb-2">Active Sessions</h3>
          <p className="text-2xl font-bold text-white">24</p>
          <p className="text-blue-200 text-sm">Connected users</p>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <h3 className="text-white font-semibold mb-2">Recent Activity</h3>
          <p className="text-blue-200 text-sm">3 teams joined</p>
          <p className="text-blue-200 text-sm">2 min ago</p>
        </div>
      </div>
    </div>
  )
}

// Team Dashboard UI Component
function TeamDashboardUI({ session }: { session: any }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          {session.user.teamName || 'Team Dashboard'}
        </h1>
        <p className="text-blue-200">Ready to bid in the auction</p>
      </div>

      {/* Team Stats */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <div className="flex items-center space-x-3">
            <CurrencyDollarIcon className="w-8 h-8 text-green-400" />
            <div>
              <h3 className="text-white font-semibold">Budget Remaining</h3>
              <p className="text-2xl font-bold text-green-400">₹10.0 Cr</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <div className="flex items-center space-x-3">
            <UserGroupIcon className="w-8 h-8 text-blue-400" />
            <div>
              <h3 className="text-white font-semibold">Squad Size</h3>
              <p className="text-2xl font-bold text-blue-400">0/25</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <div className="flex items-center space-x-3">
            <ClockIcon className="w-8 h-8 text-orange-400" />
            <div>
              <h3 className="text-white font-semibold">Auction Status</h3>
              <p className="text-lg font-semibold text-orange-400">Waiting to Start</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        <Link
          href="/team"
          className="bg-orange-500 hover:bg-orange-600 rounded-xl p-6 transition-colors text-center group"
        >
          <PlayCircleIcon className="w-12 h-12 text-white mx-auto mb-4 group-hover:scale-110 transition-transform" />
          <h3 className="text-xl font-semibold text-white mb-2">Enter Auction Room</h3>
          <p className="text-orange-100">Join the live bidding session</p>
        </Link>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
          <TrophyIcon className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">Player Watchlist</h3>
          <p className="text-blue-200">Manage your preferred players</p>
        </div>
      </div>
    </div>
  )
}

// Viewer Dashboard UI Component
function ViewerDashboardUI() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Auction Viewer</h1>
        <p className="text-blue-200">Watch the live auction</p>
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/20 text-center">
        <PlayCircleIcon className="w-16 h-16 text-blue-400 mx-auto mb-4" />
        <h3 className="text-2xl font-semibold text-white mb-4">Live Auction</h3>
        <p className="text-blue-200 mb-6">Join thousands of fans watching the auction live</p>
        <Link
          href="/viewer"
          className="inline-flex items-center px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
        >
          <PlayCircleIcon className="w-5 h-5 mr-2" />
          Watch Live
        </Link>
      </div>
    </div>
  )
}