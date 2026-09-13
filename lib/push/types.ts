export type NotificationPermissionState =
  | 'NOT_ENABLED'
  | 'ENABLED'
  | 'BLOCKED'
  | 'UNSUPPORTED'

export interface PushCategories {
  severeAlerts: boolean
  rainAlerts: boolean
  airQualityAlerts: boolean
  dailyBriefing: boolean
}

export const DEFAULT_PUSH_CATEGORIES: PushCategories = {
  severeAlerts: true,
  rainAlerts: false,
  airQualityAlerts: false,
  dailyBriefing: false,
}

export interface PushSubscriptionRecord {
  id: string
  deviceId: string
  token: string
  endpoint?: string
  platform: string
  deviceType?: 'mobile' | 'desktop' | 'tablet'
  userAgent?: string
  createdAt: string
  updatedAt: string
  enabled: boolean
  categories: PushCategories
}

export interface PushNotificationPayload {
  type?: 'test' | 'alert' | 'briefing'
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  url?: string
  data?: {
    type?: string
    url?: string
    category?: keyof PushCategories
    timestamp?: number
    [key: string]: unknown
  }
}
