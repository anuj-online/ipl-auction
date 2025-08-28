'use client'

/**
 * AuthGuard Component
 * Centralized authentication and role-based access control
 * Handles session loading, authentication checks, and role-based redirects
 */

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { UserRole } from '@/lib/validations'

interface AuthGuardProps {
  children: React.ReactNode
  requireAuth?: boolean
  allowedRoles?: UserRole[]
  fallbackPath?: string
  loadingComponent?: React.ReactNode
  unauthorizedComponent?: React.ReactNode
}

interface LoadingSpinnerProps {
  message?: string
}

function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">{message}</p>
      </div>
    </div>
  )
}

function UnauthorizedAccess({ requiredRoles, userRole }: { requiredRoles?: UserRole[], userRole?: UserRole }) {
  const router = useRouter()

  const handleGoBack = () => {
    if (userRole === 'ADMIN') {
      router.push('/admin')
    } else if (userRole === 'TEAM') {
      router.push('/team')
    } else if (userRole === 'VIEWER') {
      router.push('/viewer')
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page.
            {requiredRoles && (
              <span className="block mt-2 text-sm">
                Required roles: {requiredRoles.join(', ')}
              </span>
            )}
            {userRole && (
              <span className="block mt-1 text-sm">
                Your role: {userRole}
              </span>
            )}
          </p>
          <button
            onClick={handleGoBack}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AuthGuard({
  children,
  requireAuth = true,
  allowedRoles,
  fallbackPath,
  loadingComponent,
  unauthorizedComponent
}: AuthGuardProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isRedirecting, setIsRedirecting] = useState(false)

  useEffect(() => {
    // Skip auth checks if authentication is not required
    if (!requireAuth) return

    // Wait for session to load
    if (status === 'loading') return

    // Handle unauthenticated users
    if (status === 'unauthenticated') {
      console.log('AuthGuard: User not authenticated, redirecting to login')
      setIsRedirecting(true)
      const callbackUrl = encodeURIComponent(pathname)
      router.push(`/auth/signin?callbackUrl=${callbackUrl}`)
      return
    }

    // Handle authenticated users
    if (status === 'authenticated' && session?.user) {
      const userRole = session.user.role

      // Check if user has required roles
      if (allowedRoles && !allowedRoles.includes(userRole)) {
        console.log(`AuthGuard: User role ${userRole} not in allowed roles [${allowedRoles.join(', ')}]`)
        
        // If fallbackPath is provided, redirect there
        if (fallbackPath) {
          setIsRedirecting(true)
          router.push(fallbackPath)
          return
        }
        
        // Otherwise, show unauthorized component or default
        return
      }

      console.log(`AuthGuard: Access granted for role ${userRole}`)
    }
  }, [status, session, router, pathname, requireAuth, allowedRoles, fallbackPath])

  // Show loading while session is being established
  if (status === 'loading') {
    return loadingComponent || <LoadingSpinner message="Checking authentication..." />
  }

  // Show loading while redirecting
  if (isRedirecting) {
    return loadingComponent || <LoadingSpinner message="Redirecting..." />
  }

  // If authentication is not required, always show children
  if (!requireAuth) {
    return <>{children}</>
  }

  // If user is not authenticated, don't render anything (redirect is happening)
  if (status === 'unauthenticated') {
    return loadingComponent || <LoadingSpinner message="Redirecting to login..." />
  }

  // If user is authenticated but doesn't have required role
  if (session?.user && allowedRoles && !allowedRoles.includes(session.user.role)) {
    return unauthorizedComponent || <UnauthorizedAccess requiredRoles={allowedRoles} userRole={session.user.role} />
  }

  // If user is authenticated and has required role, show children
  if (status === 'authenticated' && session?.user) {
    return <>{children}</>
  }

  // Fallback loading state
  return loadingComponent || <LoadingSpinner message="Loading..." />
}

/**
 * Higher-order component for protecting pages with authentication
 */
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  authOptions: Omit<AuthGuardProps, 'children'>
) {
  return function AuthGuardedComponent(props: P) {
    return (
      <AuthGuard {...authOptions}>
        <Component {...props} />
      </AuthGuard>
    )
  }
}

/**
 * Hook for role-based access control
 */
export function useRoleCheck(allowedRoles: UserRole[]) {
  const { data: session, status } = useSession()
  
  const hasAccess = () => {
    if (status === 'loading') return null
    if (status === 'unauthenticated') return false
    if (!session?.user?.role) return false
    return allowedRoles.includes(session.user.role)
  }

  const isLoading = status === 'loading'
  const isAuthenticated = status === 'authenticated'
  const userRole = session?.user?.role
  
  return {
    hasAccess: hasAccess(),
    isLoading,
    isAuthenticated,
    userRole,
    session
  }
}