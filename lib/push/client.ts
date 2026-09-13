'use client'

import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { getFirebaseFirestore } from '@/lib/firebase'
import type {
  NotificationPermissionState,
  PushCategories,
  PushSubscriptionRecord,
  PushNotificationPayload,
} from './types'
import { DEFAULT_PUSH_CATEGORIES } from './types'

const DEVICE_ID_KEY = 'wi_push_device_id_v1'
const CACHED_CATEGORIES_KEY = 'wi_push_categories_v1'

/** Generate or retrieve a stable device ID for multi-device support */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server-device'
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY)
    if (!id) {
      const rand = Math.random().toString(36).substring(2, 10)
      const ts = Date.now().toString(36)
      id = `dev-${ts}-${rand}`
      localStorage.setItem(DEVICE_ID_KEY, id)
    }
    return id
  } catch {
    return 'temp-device'
  }
}

/** Detect device form factor */
export function detectDeviceType(): 'mobile' | 'desktop' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop'
  const ua = navigator.userAgent.toLowerCase()
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet'
  }
  if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    return 'mobile'
  }
  return 'desktop'
}

/** Check if Web Push and Service Workers are supported in the current environment */
export function checkPushSupport(): boolean {
  if (typeof window === 'undefined') return false
  const hasNotification = 'Notification' in window
  const hasSW = 'serviceWorker' in navigator
  const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  return Boolean(hasNotification && hasSW && isSecure)
}

/** Get current permission state */
export function getNotificationPermissionState(): NotificationPermissionState {
  if (!checkPushSupport()) return 'UNSUPPORTED'
  const perm = Notification.permission
  if (perm === 'granted') return 'ENABLED'
  if (perm === 'denied') return 'BLOCKED'
  return 'NOT_ENABLED'
}

/** Get cached categories from localStorage */
export function getLocalPushCategories(): PushCategories {
  if (typeof window === 'undefined') return DEFAULT_PUSH_CATEGORIES
  try {
    const raw = localStorage.getItem(CACHED_CATEGORIES_KEY)
    if (raw) return { ...DEFAULT_PUSH_CATEGORIES, ...JSON.parse(raw) }
  } catch {
    // Ignore
  }
  return DEFAULT_PUSH_CATEGORIES
}

/** Save categories locally */
export function saveLocalPushCategories(cats: PushCategories) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHED_CATEGORIES_KEY, JSON.stringify(cats))
  } catch {
    // Ignore
  }
}

/**
 * Register device for Push Notifications.
 * Must only be called as a direct result of user interaction (e.g. clicking "ENABLE").
 */
export async function registerDevicePush(
  user: User | null,
  categories: PushCategories = DEFAULT_PUSH_CATEGORIES
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!checkPushSupport()) {
    return { success: false, error: 'Push notifications are unsupported in this browser.' }
  }

  try {
    // 1. Request permission from explicit gesture
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { success: false, error: permission === 'denied' ? 'Permission was denied by user.' : 'Permission dismissed.' }
    }

    // 2. Wait for service worker registration
    const swReg = await navigator.serviceWorker.ready
    if (!swReg) {
      return { success: false, error: 'Service worker is not active.' }
    }

    const deviceId = getOrCreateDeviceId()
    const deviceType = detectDeviceType()
    const userAgent = navigator.userAgent
    let fcmToken = ''

    // 3. Obtain token via Firebase Messaging or native pushManager
    try {
      const { getMessaging, getToken } = await import('firebase/messaging')
      const { getApp } = await import('firebase/app')
      const app = getApp()
      const messaging = getMessaging(app)
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined

      fcmToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: swReg,
      })
    } catch (fcmErr) {
      console.warn('[FCM Client] Standard getToken failed, attempting fallback subscription:', fcmErr)
      // Fallback: Web Push standard subscription
      try {
        const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
        let sub = await swReg.pushManager.getSubscription()
        if (!sub && vapidKey) {
          sub = await swReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey,
          })
        }
        fcmToken = sub ? JSON.stringify(sub) : `local-${deviceId}`
      } catch {
        fcmToken = `device-token-${deviceId}`
      }
    }

    saveLocalPushCategories(categories)

    // 4. Save to Firestore under authenticated user scope
    if (user && fcmToken) {
      try {
        const db = getFirebaseFirestore()
        const subDocRef = doc(db, 'users', user.uid, 'pushSubscriptions', deviceId)
        const record: PushSubscriptionRecord = {
          id: deviceId,
          token: fcmToken,
          deviceType,
          userAgent,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          enabled: true,
          categories,
        }
        await setDoc(subDocRef, record, { merge: true })
      } catch (dbErr) {
        console.warn('[FCM Client] Firestore subscription sync failed:', dbErr)
      }
    }

    return { success: true, token: fcmToken }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown registration failure'
    return { success: false, error: msg }
  }
}

/**
 * Disable push notifications for this current device.
 */
export async function disableCurrentDevice(user: User | null): Promise<boolean> {
  const deviceId = getOrCreateDeviceId()

  if (user) {
    try {
      const db = getFirebaseFirestore()
      const subDocRef = doc(db, 'users', user.uid, 'pushSubscriptions', deviceId)
      await updateDoc(subDocRef, {
        enabled: false,
        updatedAt: new Date().toISOString(),
      })
    } catch {
      // If document does not exist, ignore
    }
  }

  // Also unsubscribe native PushSubscription if possible
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
      }
    } catch {
      // Ignore
    }
  }

  return true
}

/**
 * Update push categories for the current device.
 */
export async function updatePushCategories(
  user: User | null,
  categories: PushCategories
): Promise<boolean> {
  saveLocalPushCategories(categories)

  if (user) {
    try {
      const db = getFirebaseFirestore()
      const deviceId = getOrCreateDeviceId()
      const subDocRef = doc(db, 'users', user.uid, 'pushSubscriptions', deviceId)
      await updateDoc(subDocRef, {
        categories,
        updatedAt: new Date().toISOString(),
      })
      return true
    } catch {
      return false
    }
  }

  return true
}

/**
 * Fetch subscription record for this device from Firestore.
 */
export async function getDeviceSubscriptionRecord(
  user: User | null
): Promise<PushSubscriptionRecord | null> {
  if (!user) return null
  try {
    const db = getFirebaseFirestore()
    const deviceId = getOrCreateDeviceId()
    const subDocRef = doc(db, 'users', user.uid, 'pushSubscriptions', deviceId)
    const snap = await getDoc(subDocRef)
    if (snap.exists()) {
      return snap.data() as PushSubscriptionRecord
    }
  } catch {
    // Ignore
  }
  return null
}

/**
 * Listen for push messages arriving while the application is in the foreground.
 */
export function setupForegroundPushListener(
  callback: (payload: PushNotificationPayload) => void
): () => void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {}
  }

  // Handler for messages forwarded from service worker
  const swHandler = (event: MessageEvent) => {
    if (event.data && event.data.type === 'PUSH_NOTIFICATION_RECEIVED') {
      callback(event.data.payload)
    }
  }

  navigator.serviceWorker.addEventListener('message', swHandler)

  // Also setup Firebase onMessage if messaging is active
  let unsubscribeFcm: (() => void) | null = null
  import('firebase/messaging')
    .then(({ getMessaging, onMessage }) => {
      import('firebase/app').then(({ getApp }) => {
        try {
          const app = getApp()
          const messaging = getMessaging(app)
          unsubscribeFcm = onMessage(messaging, (payload) => {
            const title = payload.notification?.title || payload.data?.title || 'Weather Alert'
            const body = payload.notification?.body || payload.data?.body || ''
            callback({ title, body, data: payload.data })
          })
        } catch {
          // Messaging not active yet
        }
      })
    })
    .catch(() => {})

  return () => {
    navigator.serviceWorker.removeEventListener('message', swHandler)
    if (unsubscribeFcm) unsubscribeFcm()
  }
}
