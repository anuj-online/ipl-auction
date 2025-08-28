/**
 * Authentication Components
 * Centralized exports for authentication and authorization components
 */

export { default as AuthGuard, withAuthGuard, useRoleCheck } from './AuthGuard'
export { 
  default as ProtectedRoute,
  AdminRoute,
  TeamRoute,
  ViewerRoute,
  AuthenticatedRoute,
  ManagementRoute,
  createRoleRoute,
  withRoleProtection
} from './ProtectedRoute'

// Re-export types for convenience
export type { UserRole } from '@/lib/validations'