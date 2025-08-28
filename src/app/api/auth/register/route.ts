/**
 * User Registration API Route
 * Handles new user registration with role-based access
 */

import { NextRequest } from 'next/server'
import { validateData, registerSchema } from '@/lib/validations'
import { createUser } from '@/lib/auth'
import { requireAdmin, createApiResponse, handleApiError, parseJsonBody } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    // Only admins can register new users (except for bootstrap)
    const isBootstrap = request.nextUrl.searchParams.get('bootstrap') === 'true'
    
    if (!isBootstrap) {
      await requireAdmin()
    }

    const body = await parseJsonBody(request)
    const validation = validateData(registerSchema, body)
    
    if (!validation.success) {
      return createApiResponse(undefined, validation.error, 400)
    }

    const { email, password, name, role, teamId } = validation.data

    const user = await createUser({
      email,
      password,
      name,
      role,
      teamId,
    })

    return createApiResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        teamId: user.teamId,
      },
      message: 'User created successfully'
    })

  } catch (error) {
    return handleApiError(error)
  }
}