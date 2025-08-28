/**
 * Utility Functions
 * Common utility functions used across the application
 */

/**
 * Rate limiting implementation
 * Simple in-memory rate limiter for API endpoints
 */
export function rateLimit(config: {
  windowMs: number
  maxRequests: number
}) {
  const requests = new Map<string, { count: number; windowStart: number }>()

  return function(identifier: string): { success: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs
    
    const key = `${identifier}:${windowStart}`
    const existing = requests.get(key)
    
    if (!existing) {
      requests.set(key, { count: 1, windowStart })
      return {
        success: true,
        remaining: config.maxRequests - 1,
        resetTime: windowStart + config.windowMs
      }
    }
    
    if (existing.count >= config.maxRequests) {
      return {
        success: false,
        remaining: 0,
        resetTime: windowStart + config.windowMs
      }
    }
    
    existing.count++
    requests.set(key, existing)
    
    return {
      success: true,
      remaining: config.maxRequests - existing.count,
      resetTime: windowStart + config.windowMs
    }
  }
}

/**
 * Generate a random ID
 */
export function generateId(length = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number): string {
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`
  } else if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`
  } else {
    return `₹${amount.toLocaleString()}`
  }
}

/**
 * Delay function for async operations
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  backoff = 1000
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (retries > 0) {
      await delay(backoff)
      return retry(fn, retries - 1, backoff * 2)
    }
    throw error
  }
}

/**
 * Cleanup old entries from a Map based on timestamp
 */
export function cleanupOldEntries<T extends { timestamp: number }>(
  map: Map<string, T>,
  maxAge: number
): void {
  const now = Date.now()
  for (const [key, value] of map.entries()) {
    if (now - value.timestamp > maxAge) {
      map.delete(key)
    }
  }
}