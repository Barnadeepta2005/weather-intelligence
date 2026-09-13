import 'server-only'

import { getApps, initializeApp, cert, getApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getMessaging, type Messaging } from 'firebase-admin/messaging'

let adminApp: App | null = null

export function isFirebaseAdminConfigured(): boolean {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  return Boolean(projectId && clientEmail && privateKey)
}

export function getAdminApp(): App {
  if (adminApp) {
    return adminApp
  }

  const existingApps = getApps()
  if (existingApps.length > 0) {
    adminApp = existingApps[0]
    return adminApp
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY

  if (projectId && clientEmail && rawKey) {
    // Correctly parse escaped newlines in environment variable
    const privateKey = rawKey.replace(/\\n/g, '\n')
    adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    })
  } else if (projectId) {
    // Project-only initialization (uses application default credentials or local testing)
    adminApp = initializeApp({ projectId })
  } else {
    adminApp = initializeApp()
  }

  return adminApp
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp())
}

export function getAdminMessaging(): Messaging {
  return getMessaging(getAdminApp())
}
