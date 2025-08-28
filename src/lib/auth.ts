/**
 * Authentication & Session Management
 * NextAuth.js configuration and utility functions
 */

import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { UserRole } from './validations'

/**
 * NextAuth configuration
 */
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { team: true },
        })

        if (!user?.passwordHash) {
          return null
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )

        if (!isValidPassword) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
          teamId: user.teamId,
          teamName: user.team?.name,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.teamId = user.teamId
        token.teamName = user.teamName
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as UserRole
        session.user.teamId = token.teamId as string | undefined
        session.user.teamName = token.teamName as string | undefined
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

/**
 * Password hashing utilities
 */
export async function hashPassword(password: string): Promise<string> {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12')
  return await bcrypt.hash(password, rounds)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return await bcrypt.compare(password, hashedPassword)
}

/**
 * User creation utilities
 */
export async function createUser({
  email,
  password,
  name,
  role = 'VIEWER',
  teamId,
}: {
  email: string
  password: string
  name?: string
  role?: UserRole
  teamId?: string
}) {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  })

  if (existingUser) {
    throw new Error('User already exists')
  }

  const passwordHash = await hashPassword(password)

  return await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role,
      teamId,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      teamId: true,
      createdAt: true,
    },
  })
}

/**
 * Role-based authorization utilities
 */
export function hasRole(userRole: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(userRole)
}

export function isAdmin(userRole: UserRole): boolean {
  return userRole === 'ADMIN'
}

export function isTeam(userRole: UserRole): boolean {
  return userRole === 'TEAM'
}

export function isViewer(userRole: UserRole): boolean {
  return userRole === 'VIEWER'
}

export function canAccessTeamData(userRole: UserRole, userTeamId?: string, targetTeamId?: string): boolean {
  if (isAdmin(userRole)) return true
  if (isTeam(userRole) && userTeamId === targetTeamId) return true
  return false
}

/**
 * Session utilities
 */
export interface AuthUser {
  id: string
  email: string
  name?: string
  role: UserRole
  teamId?: string
  teamName?: string
}

export async function getCurrentUser(userId: string): Promise<AuthUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { team: true },
  })

  if (!user) return null

  return {
    id: user.id,
    email: user.email,
    name: user.name || undefined,
    role: user.role as UserRole,
    teamId: user.teamId || undefined,
    teamName: user.team?.name || undefined,
  }
}

/**
 * Bootstrap admin user
 */
export async function bootstrapAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@iplauction.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

  const existingAdmin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  })

  if (existingAdmin) {
    console.log('Admin user already exists')
    return existingAdmin
  }

  console.log('Creating bootstrap admin user...')
  const admin = await createUser({
    email: adminEmail,
    password: adminPassword,
    name: 'System Administrator',
    role: 'ADMIN',
  })

  console.log(`✅ Admin user created: ${adminEmail}`)
  return admin
}

/**
 * Authorization middleware helpers
 */
export function createAuthGuard(requiredRoles: UserRole[]) {
  return (userRole: UserRole) => {
    if (!hasRole(userRole, requiredRoles)) {
      throw new Error(`Access denied. Required roles: ${requiredRoles.join(', ')}`)
    }
  }
}

export const requireAdmin = createAuthGuard(['ADMIN'])
export const requireTeam = createAuthGuard(['TEAM'])
export const requireAuthenticated = createAuthGuard(['ADMIN', 'TEAM', 'VIEWER'])