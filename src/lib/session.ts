/**
 * Session Management Utilities
 * Server-side session handling for API routes and server components
 */

import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'
import { authOptions, AuthUser, getCurrentUser } from './auth'
import { UserRole } from './validations'
import { prisma } from './prisma'

/**
 * Get current session from server context
 */
export async function getSession() {
  return await getServerSession(authOptions)
}

/**
 * Get authenticated user with full data
 */
export async function getAuthenticatedUser(): Promise<AuthUser | null> {
  const session = await getSession()
  if (!session?.user?.id) return null
  
  return await getCurrentUser(session.user.id)
}

/**
 * Require authentication - throws if not authenticated
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthenticatedUser()
  if (!user) {
    throw new Error('Authentication required')
  }
  return user
}

/**
 * Require specific role - throws if user doesn't have required role
 */
export async function requireRole(requiredRoles: UserRole[]): Promise<AuthUser> {
  const user = await requireAuth()
  if (!requiredRoles.includes(user.role)) {
    throw new Error(`Access denied. Required roles: ${requiredRoles.join(', ')}`)
  }
  return user
}

/**
 * Require admin role
 */
export async function requireAdmin(): Promise<AuthUser> {
  return await requireRole(['ADMIN'])
}

/**
 * Require team role
 */
export async function requireTeam(): Promise<AuthUser> {
  return await requireRole(['TEAM'])
}

/**
 * Check if user can access team data
 */
export async function canAccessTeam(targetTeamId: string): Promise<boolean> {
  const user = await getAuthenticatedUser()
  if (!user) return false
  
  // Admin can access all teams
  if (user.role === 'ADMIN') return true
  
  // Team users can only access their own team
  if (user.role === 'TEAM' && user.teamId === targetTeamId) return true
  
  return false
}

/**
 * Enhanced team access verification with database validation
 */
export async function verifyTeamAccess(userId: string, teamId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { team: true }
    })
    
    if (!user) return false
    if (user.role === 'ADMIN') return true
    return user.teamId === teamId && user.team?.id === teamId
  } catch (error) {
    console.error('Error verifying team access:', error)
    return false
  }
}

/**
 * API route session wrapper
 */
export function withAuth(
  handler: (request: NextRequest, user: AuthUser, context?: any) => Promise<Response>
) {
  return async (request: NextRequest, context?: any) => {
    try {
      const user = await requireAuth()
      return await handler(request, user, context)
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : 'Authentication failed' },
        { status: 401 }
      )
    }
  }
}

/**
 * API route role-based wrapper
 */
export function withRole(requiredRoles: UserRole[]) {
  return function(handler: (request: NextRequest, context: any, user: AuthUser) => Promise<Response>) {
    return async (request: NextRequest, context?: any) => {
      try {
        const user = await requireRole(requiredRoles)
        return await handler(request, context, user)
      } catch (error) {
        return Response.json(
          { error: error instanceof Error ? error.message : 'Authorization failed' },
          { status: 403 }
        )
      }
    }
  }
}

/**
 * Admin-only API wrapper
 */
export const withAdmin = withRole(['ADMIN'])

/**
 * Team-only API wrapper
 */
export const withTeam = withRole(['TEAM'])

/**
 * Enhanced team wrapper with database-backed validation
 */
export function withTeamEnhanced(
  handler: (request: NextRequest, context: any, user: AuthUser, teamId: string) => Promise<Response>
) {
  return withAuth(async (request: NextRequest, user: AuthUser, context?: any) => {
    // Ensure user has TEAM role
    if (user.role !== 'TEAM' && user.role !== 'ADMIN') {
      return createApiResponse(undefined, 'Team access required', 403)
    }

    // Extract team ID from URL params
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const teamsIndex = pathParts.findIndex(part => part === 'teams')
    const teamId = pathParts[teamsIndex + 1]

    if (!teamId) {
      return createApiResponse(undefined, 'Team ID not found in request', 400)
    }

    // Verify team access with database validation
    const hasAccess = await verifyTeamAccess(user.id, teamId)
    if (!hasAccess) {
      return createApiResponse(undefined, 'Team access denied', 403)
    }

    return handler(request, context, user, teamId)
  })
}

/**
 * Extract user from request headers (for WebSocket auth)
 */
export async function getUserFromHeaders(headers: Headers): Promise<AuthUser | null> {
  const authHeader = headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  
  const token = authHeader.slice(7)
  
  try {
    // Try to validate JWT token
    const validatedUser = await validateSessionToken(token)
    if (validatedUser) {
      return validatedUser
    }
    
    // Fallback to session-based auth
    const user = await getAuthenticatedUser()
    return user
  } catch (error) {
    console.error('Error validating user from headers:', error)
    return null
  }
}

/**
 * Enhanced JWT validation for cross-service auth
 */
export async function validateSessionToken(token: string): Promise<AuthUser | null> {
  try {
    const jwt = require('jsonwebtoken')
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!) as any
    
    if (decoded.sub) {
      return await getCurrentUser(decoded.sub)
    }
    
    return null
  } catch (error) {
    console.error('JWT validation failed:', error)
    return null
  }
}

/**
 * Generate API response with consistent format
 */
export function createApiResponse<T>(
  data?: T,
  error?: string,
  status = 200
): Response {
  const response = {
    success: !error,
    data,
    error,
    timestamp: new Date().toISOString(),
  }
  
  return Response.json(response, { status })
}

/**
 * Handle API errors with consistent format
 */
export function handleApiError(error: unknown): Response {
  console.error('API Error:', error)
  
  if (error instanceof Error) {
    return createApiResponse(undefined, error.message, 400)
  }
  
  return createApiResponse(undefined, 'Internal server error', 500)
}

/**
 * Validate request method
 */
export function validateMethod(request: NextRequest, allowedMethods: string[]): void {
  if (!allowedMethods.includes(request.method)) {
    throw new Error(`Method ${request.method} not allowed`)
  }
}

/**
 * Parse JSON body safely
 */
export async function parseJsonBody(request: NextRequest): Promise<any> {
  try {
    return await request.json()
  } catch {
    throw new Error('Invalid JSON body')
  }
}

/**
 * Extract query parameters
 */
export function getQueryParams(url: string): URLSearchParams {
  return new URL(url).searchParams
}

/**
 * Rate limiting helper (basic implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function checkRateLimit(
  identifier: string,
  maxRequests = 100,
  windowMs = 15 * 60 * 1000 // 15 minutes
): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return true
  }
  
  if (record.count >= maxRequests) {
    return false
  }
  
  record.count++
  return true
}

/**
 * CORS headers helper
 */
export function addCorsHeaders(response: Response): Response {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return response
}