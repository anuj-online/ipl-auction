'use client'

/**
 * Providers Component
 * Wraps the app with NextAuth SessionProvider for authentication
 */

import { SessionProvider } from 'next-auth/react'

export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}