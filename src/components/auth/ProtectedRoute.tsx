'use client'

/**
 * ProtectedRoute Component
 * Higher-order component for role-specific page protection
 * Simplifies protecting entire pages with specific role requirements
 */

import { ReactNode } from 'react'
import AuthGuard from './AuthGuard'
import { UserRole } from '@/lib/validations'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles: UserRole[]
  fallbackPath?: string
  loadingMessage?: string
}

/**
 * ProtectedRoute component that wraps pages requiring specific roles
 */
export default function ProtectedRoute({
  children,
  allowedRoles,
  fallbackPath,
  loadingMessage
}: ProtectedRouteProps) {
  return (
    <AuthGuard
      requireAuth={true}
      allowedRoles={allowedRoles}
      fallbackPath={fallbackPath}
      loadingComponent={
        loadingMessage ? (
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
              <p className="text-gray-600 text-lg">{loadingMessage}</p>
            </div>
          </div>
        ) : undefined
      }
    >
      {children}
    </AuthGuard>
  )
}

/**
 * Pre-configured ProtectedRoute components for each role
 */

// Admin-only pages
export function AdminRoute({ children, fallbackPath = '/' }: { children: ReactNode; fallbackPath?: string }) {
  return (
    <ProtectedRoute
      allowedRoles={['ADMIN']}
      fallbackPath={fallbackPath}
      loadingMessage="Verifying admin access..."
    >
      {children}
    </ProtectedRoute>
  )
}

// Team-only pages
export function TeamRoute({ children, fallbackPath = '/' }: { children: ReactNode; fallbackPath?: string }) {
  return (
    <ProtectedRoute
      allowedRoles={['TEAM']}
      fallbackPath={fallbackPath}
      loadingMessage="Verifying team access..."
    >
      {children}
    </ProtectedRoute>
  )
}

// Viewer-only pages (though viewers usually have least restrictions)
export function ViewerRoute({ children, fallbackPath = '/' }: { children: ReactNode; fallbackPath?: string }) {
  return (
    <ProtectedRoute
      allowedRoles={['VIEWER']}
      fallbackPath={fallbackPath}
      loadingMessage="Loading viewer interface..."
    >
      {children}
    </ProtectedRoute>
  )
}

// Any authenticated user
export function AuthenticatedRoute({ children, fallbackPath = '/' }: { children: ReactNode; fallbackPath?: string }) {
  return (
    <ProtectedRoute
      allowedRoles={['ADMIN', 'TEAM', 'VIEWER']}
      fallbackPath={fallbackPath}
      loadingMessage="Verifying authentication..."
    >
      {children}
    </ProtectedRoute>
  )
}

// Admin or Team (for management features)
export function ManagementRoute({ children, fallbackPath = '/' }: { children: ReactNode; fallbackPath?: string }) {
  return (
    <ProtectedRoute
      allowedRoles={['ADMIN', 'TEAM']}
      fallbackPath={fallbackPath}
      loadingMessage="Verifying management access..."
    >
      {children}
    </ProtectedRoute>
  )
}

/**
 * Utility function to create role-specific page wrappers
 */
export function createRoleRoute(allowedRoles: UserRole[], loadingMessage?: string) {
  return function RoleRoute({ 
    children, 
    fallbackPath = '/' 
  }: { 
    children: ReactNode; 
    fallbackPath?: string 
  }) {
    return (
      <ProtectedRoute
        allowedRoles={allowedRoles}
        fallbackPath={fallbackPath}
        loadingMessage={loadingMessage}
      >
        {children}
      </ProtectedRoute>
    )
  }
}

/**
 * HOC for protecting page components
 */
export function withRoleProtection<P extends object>(
  Component: React.ComponentType<P>,
  allowedRoles: UserRole[],
  options?: {
    fallbackPath?: string
    loadingMessage?: string
  }
) {
  const displayName = Component.displayName || Component.name || 'Component'
  
  function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute
        allowedRoles={allowedRoles}
        fallbackPath={options?.fallbackPath}
        loadingMessage={options?.loadingMessage}
      >
        <Component {...props} />
      </ProtectedRoute>
    )
  }
  
  ProtectedComponent.displayName = `withRoleProtection(${displayName})`
  
  return ProtectedComponent
}