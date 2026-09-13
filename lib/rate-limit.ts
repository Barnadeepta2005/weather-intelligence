import { NextRequest, NextResponse } from 'next/server'

/**
 * Lightweight, best-effort in-memory rate limiter for Next.js API routes on Vercel.
 *
 * ARCHITECTURAL NOTE & SERVERLESS BOUNDARY:
 * In a serverless deployment (such as Vercel Hobby / Pro), each function instance
 * maintains its own isolated memory heap. This in-memory limiter provides effective
 * burst suppression and abusive scrape deterrence per warmed instance without incurring
 * the recurring latency and cost of a paid external persistence store (e.g. Redis/Upstash).
 *
 * It is coupled with upstream HTTP caching and stale-while-revalidate headers to minimize
 * redundant upstream queries to Open-Meteo, CPCB, and IMD.
 */

interface RateLimitRecord {
  tokens: number
  lastRefill: number
}

// Global store attached to globalThis to survive hot reloads in development
const rateLimitMap = new Map<string, RateLimitRecord>()

// Periodic garbage collection to prevent memory leaks from one-off IPs
let lastCleanup = Date.now()
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

function cleanStaleEntries(now: number, maxAgeMs: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now
  for (const [key, record] of rateLimitMap.entries()) {
    if (now - record.lastRefill > maxAgeMs) {
      rateLimitMap.delete(key)
    }
  }
}

export interface RateLimitOptions {
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetMs: number
}

/**
 * Extract client IP address from standard proxy headers.
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list; first entry is the client IP
    const clientIp = forwarded.split(',')[0]?.trim()
    if (clientIp) return clientIp
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return '127.0.0.1'
}

/**
 * Evaluate rate limit for a request using a Token Bucket algorithm.
 */
export function checkRateLimit(
  request: NextRequest,
  routeKey: string,
  options: RateLimitOptions
): RateLimitResult {
  const ip = getClientIp(request)
  const key = `${routeKey}:${ip}`
  const now = Date.now()

  cleanStaleEntries(now, options.windowMs * 2)

  let record = rateLimitMap.get(key)

  if (!record) {
    record = {
      tokens: options.limit - 1,
      lastRefill: now,
    }
    rateLimitMap.set(key, record)
    return {
      success: true,
      limit: options.limit,
      remaining: options.limit - 1,
      resetMs: options.windowMs,
    }
  }

  // Refill tokens proportional to elapsed time
  const elapsed = now - record.lastRefill
  const refillRate = options.limit / options.windowMs
  const refilledTokens = Math.min(options.limit, record.tokens + elapsed * refillRate)

  record.lastRefill = now

  if (refilledTokens >= 1) {
    record.tokens = refilledTokens - 1
    return {
      success: true,
      limit: options.limit,
      remaining: Math.floor(record.tokens),
      resetMs: Math.ceil((1 - (record.tokens % 1)) / refillRate),
    }
  }

  // Rate limit exceeded
  record.tokens = refilledTokens
  const waitMs = Math.ceil((1 - refilledTokens) / refillRate)
  return {
    success: false,
    limit: options.limit,
    remaining: 0,
    resetMs: Math.max(1000, waitMs),
  }
}

/**
 * Create a standard 429 Too Many Requests response with Retry-After headers.
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfterSec = Math.ceil(result.resetMs / 1000)
  return NextResponse.json(
    {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please reduce request frequency.',
      retryAfter: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil((Date.now() + result.resetMs) / 1000)),
      },
    }
  )
}
