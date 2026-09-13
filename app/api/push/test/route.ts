import { NextRequest, NextResponse } from 'next/server'
import { sendToSubscription } from '@/lib/push/server'
import { getAdminAuth } from '@/lib/firebase-admin'
import { checkRateLimit, createRateLimitResponse } from '@/lib/rate-limit'
import type { PushSubscriptionRecord, PushNotificationPayload } from '@/lib/push/types'

export async function POST(request: NextRequest) {
  // 1. Strict Rate Limiting: 5 requests per minute per IP
  const rateLimit = checkRateLimit(request, 'push-test', { limit: 5, windowMs: 60_000 })
  if (!rateLimit.success) {
    return createRateLimitResponse(rateLimit)
  }

  try {
    // 2. Validate Authorization Header presence
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or malformed Authorization header.' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7).trim()
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Empty bearer token.' },
        { status: 401 }
      )
    }

    // 3. Cryptographically Verify Firebase ID Token with Firebase Admin SDK
    let authenticatedUid: string
    try {
      const decodedToken = await getAdminAuth().verifyIdToken(token)
      authenticatedUid = decodedToken.uid
      if (!authenticatedUid) {
        return NextResponse.json(
          { error: 'Unauthorized: Invalid token payload.' },
          { status: 401 }
        )
      }
    } catch (authError: unknown) {
      const errMessage = authError instanceof Error ? authError.message : 'Invalid token'
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Push Test Auth] Token verification rejected:', errMessage)
      }
      return NextResponse.json(
        { error: 'Unauthorized: Invalid, malformed, or expired Firebase ID token.' },
        { status: 401 }
      )
    }

    // 4. Validate Request Body
    const body = await request.json().catch(() => null)
    if (!body || !body.subscription) {
      return NextResponse.json(
        { error: 'Bad Request: Subscription payload is required.' },
        { status: 400 }
      )
    }

    // 5. Cross-User Prevention: Require body.userId and ensure caller matches authenticated token
    if (!body.userId || body.userId !== authenticatedUid) {
      return NextResponse.json(
        { error: 'Forbidden: Missing or mismatched userId. You cannot dispatch notifications for another user.' },
        { status: 403 }
      )
    }

    const subscription = body.subscription as PushSubscriptionRecord
    const subId = subscription.deviceId || subscription.id
    if (!subId) {
      return NextResponse.json(
        { error: 'Bad Request: Invalid subscription device identifier.' },
        { status: 400 }
      )
    }

    // 6. Construct Dedicated Test Notification (type="test", category-independent)
    const testPayload: PushNotificationPayload = {
      type: 'test',
      title: 'ATMOS WEATHER — Test',
      body: 'Push notifications are working correctly on this device.',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: 'atmos-weather-test',
      data: {
        type: 'test',
        url: '/app',
        timestamp: Date.now(),
      },
    }

    // 7. Dispatch using server push abstraction
    const result = await sendToSubscription(subscription, testPayload)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to dispatch test notification.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Test notification dispatched successfully.',
      subscriptionId: subId,
      uid: authenticatedUid,
      timestamp: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Push Test Error]:', msg)
    }
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    )
  }
}
