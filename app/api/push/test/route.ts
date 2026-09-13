import { NextRequest, NextResponse } from 'next/server'
import { sendToSubscription } from '@/lib/push/server'
import type { PushSubscriptionRecord, PushNotificationPayload } from '@/lib/push/types'

export async function POST(request: NextRequest) {
  try {
    // 1. Validate Authentication
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required to send test push notifications.' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7).trim()
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing auth token.' },
        { status: 401 }
      )
    }

    // 2. Validate Payload
    const body = await request.json().catch(() => null)
    if (!body || !body.subscription) {
      return NextResponse.json(
        { error: 'Bad Request: Subscription data is required.' },
        { status: 400 }
      )
    }

    const subscription = body.subscription as PushSubscriptionRecord
    if (!subscription.id) {
      return NextResponse.json(
        { error: 'Bad Request: Invalid subscription format.' },
        { status: 400 }
      )
    }

    // 3. Construct Dedicated Test Notification (type="test")
    const testPayload: PushNotificationPayload = {
      type: 'test',
      title: 'Weather Intelligence — Test',
      body: 'Push notifications are working correctly on this device.',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: 'weather-intelligence-test',
      data: {
        type: 'test',
        url: '/',
        timestamp: Date.now(),
      },
    }

    // 4. Dispatch using server push abstraction
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
      subscriptionId: subscription.id,
      timestamp: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    )
  }
}
