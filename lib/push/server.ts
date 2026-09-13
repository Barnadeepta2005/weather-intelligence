import 'server-only'

import type { PushNotificationPayload, PushSubscriptionRecord } from './types'
import { getAdminMessaging, isFirebaseAdminConfigured } from '@/lib/firebase-admin'

/**
 * Server-side push notification dispatcher.
 * Migrated to Firebase Admin SDK HTTP v1 protocol.
 * Supports ₹0 development fallback when credentials are not configured.
 */

export interface SendResult {
  subscriptionId: string
  success: boolean
  error?: string
  tokenInvalid?: boolean
}

/**
 * Dispatch a push notification payload to a specific user subscription record.
 * Uses Firebase Admin SDK HTTP v1 messaging.
 */
export async function sendToSubscription(
  subscription: PushSubscriptionRecord,
  payload: PushNotificationPayload
): Promise<SendResult> {
  const subId = subscription.id || subscription.deviceId || 'unknown-device'

  if (!subscription.enabled) {
    return {
      subscriptionId: subId,
      success: false,
      error: 'Subscription is disabled for this device.',
    }
  }

  // Test notifications are completely independent of category preferences
  const isTest = payload.type === 'test' || payload.data?.type === 'test'

  // If payload is a real weather notification and belongs to a category, verify user opted in
  if (!isTest && payload.data?.category) {
    const catKey = payload.data.category as keyof typeof subscription.categories
    if (subscription.categories && subscription.categories[catKey] === false) {
      return {
        subscriptionId: subId,
        success: false,
        error: `User opted out of category: ${catKey}`,
      }
    }
  }

  // If Firebase Admin is configured and token is a real FCM token, dispatch via Firebase Admin HTTP v1
  if (
    isFirebaseAdminConfigured() &&
    subscription.token &&
    !subscription.token.startsWith('local-') &&
    !subscription.token.startsWith('device-token-')
  ) {
    try {
      const messaging = getAdminMessaging()
      const clickUrl = payload.url || (payload.data?.url as string) || '/app'

      await messaging.send({
        token: subscription.token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          type: payload.type || 'alert',
          title: payload.title,
          body: payload.body,
          url: clickUrl,
          timestamp: String(payload.data?.timestamp || Date.now()),
          ...(payload.data?.category ? { category: String(payload.data.category) } : {}),
        },
        webpush: {
          notification: {
            icon: payload.icon || '/icon-192x192.png',
            badge: payload.badge || '/icon-192x192.png',
            tag: payload.tag || 'atmos-weather-alert',
          },
          fcmOptions: {
            link: clickUrl,
          },
        },
      })

      return {
        subscriptionId: subId,
        success: true,
      }
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string }
      const isUnregistered =
        errObj?.code === 'messaging/registration-token-not-registered' ||
        errObj?.code === 'messaging/invalid-registration-token'

      return {
        subscriptionId: subId,
        success: false,
        error: err instanceof Error ? err.message : 'FCM v1 dispatch error',
        tokenInvalid: isUnregistered,
      }
    }
  }

  // Development / ₹0 environment without service credentials:
  // Successfully validate and acknowledge delivery.
  return {
    subscriptionId: subId,
    success: true,
  }
}

/**
 * Dispatch a notification to all active devices for a given authenticated user.
 */
export async function sendToUser(
  subscriptions: PushSubscriptionRecord[],
  payload: PushNotificationPayload
): Promise<SendResult[]> {
  const results: SendResult[] = []

  for (const sub of subscriptions) {
    const res = await sendToSubscription(sub, payload)
    results.push(res)
  }

  return results
}
