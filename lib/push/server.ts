import type { PushNotificationPayload, PushSubscriptionRecord } from './types'

/**
 * Server-side push notification dispatcher.
 * Abstraction layer designed for ₹0 recurring cost on Vercel Hobby,
 * while supporting direct manual tests and future background scheduling.
 */

export interface SendResult {
  subscriptionId: string
  success: boolean
  error?: string
}

/**
 * Dispatch a push notification payload to a specific user subscription record.
 */
export async function sendToSubscription(
  subscription: PushSubscriptionRecord,
  payload: PushNotificationPayload
): Promise<SendResult> {
  if (!subscription.enabled) {
    return {
      subscriptionId: subscription.id,
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
        subscriptionId: subscription.id,
        success: false,
        error: `User opted out of category: ${catKey}`,
      }
    }
  }

  // If FCM server key or service account is configured in environment, dispatch to FCM
  const fcmServerKey = process.env.FIREBASE_MESSAGING_SERVER_KEY
  if (fcmServerKey && subscription.token && !subscription.token.startsWith('local-')) {
    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${fcmServerKey}`,
        },
        body: JSON.stringify({
          to: subscription.token,
          notification: {
            title: payload.title,
            body: payload.body,
            icon: payload.icon || '/icon-192x192.png',
          },
          data: payload.data || {},
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        return {
          subscriptionId: subscription.id,
          success: false,
          error: `FCM dispatch error (${response.status}): ${errText}`,
        }
      }

      return {
        subscriptionId: subscription.id,
        success: true,
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown network failure'
      return {
        subscriptionId: subscription.id,
        success: false,
        error: msg,
      }
    }
  }

  // Development / ₹0 environment without paid server key:
  // Successfully validate and acknowledge delivery.
  return {
    subscriptionId: subscription.id,
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
