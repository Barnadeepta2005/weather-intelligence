'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Bell,
  Check,
  AlertTriangle,
  Send,
  Loader2,
  ShieldCheck,
  Smartphone,
  Info,
  UserRound,
} from 'lucide-react'
import type { User } from 'firebase/auth'
import type { NotificationPermissionState, PushCategories } from '@/lib/push/types'
import { DEFAULT_PUSH_CATEGORIES } from '@/lib/push/types'
import {
  checkPushSupport,
  getNotificationPermissionState,
  getLocalPushCategories,
  registerDevicePush,
  disableCurrentDevice,
  updatePushCategories,
  getDeviceSubscriptionRecord,
  getOrCreateDeviceId,
  detectDeviceType,
  triggerForegroundPushNotification,
} from '@/lib/push/client'

export interface NotificationModalProps {
  isOpen: boolean
  onClose: () => void
  user: User | null
  onOpenAuth?: () => void
}

export function NotificationModal({
  isOpen,
  onClose,
  user,
  onOpenAuth,
}: NotificationModalProps) {
  const [mounted, setMounted] = useState(false)
  const [permState, setPermState] = useState<NotificationPermissionState>('NOT_ENABLED')
  const [categories, setCategories] = useState<PushCategories>(DEFAULT_PUSH_CATEGORIES)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deviceType, setDeviceType] = useState<'mobile' | 'desktop' | 'tablet'>('desktop')

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync state when modal opens
  useEffect(() => {
    if (!isOpen) return
    const currentPerm = getNotificationPermissionState()
    setPermState(currentPerm)
    setDeviceType(detectDeviceType())
    setCategories(getLocalPushCategories())
    setFeedback(null)

    // Check if user has remote Firestore subscription for this device
    if (user && currentPerm === 'ENABLED') {
      getDeviceSubscriptionRecord(user).then((record) => {
        if (record) {
          if (record.categories) setCategories(record.categories)
          if (record.enabled === false) setPermState('NOT_ENABLED')
        }
      })
    }
  }, [isOpen, user])

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Handle Enable
  const handleEnable = useCallback(async () => {
    setIsProcessing(true)
    setFeedback(null)
    const result = await registerDevicePush(user, categories)
    setIsProcessing(false)

    if (result.success) {
      setPermState('ENABLED')
      setFeedback({
        type: 'success',
        message: 'Push notifications enabled successfully for this device.',
      })
    } else {
      const state = getNotificationPermissionState()
      setPermState(state)
      setFeedback({
        type: 'error',
        message: result.error || 'Failed to enable push notifications.',
      })
    }
  }, [user, categories])

  // Handle Disable
  const handleDisable = useCallback(async () => {
    setIsProcessing(true)
    setFeedback(null)
    await disableCurrentDevice(user)
    setIsProcessing(false)
    setPermState('NOT_ENABLED')
    setFeedback({
      type: 'success',
      message: 'Push notifications disabled for this device.',
    })
  }, [user])

  // Handle Category Toggle
  const handleToggleCategory = useCallback(
    (key: keyof PushCategories) => {
      setCategories((prev) => {
        const next = { ...prev, [key]: !prev[key] }
        updatePushCategories(user, next)
        return next
      })
    },
    [user]
  )

  // Handle Send Test Notification
  const handleSendTest = useCallback(async () => {
    if (!user) return
    setIsTesting(true)
    setFeedback(null)

    try {
      const token = await user.getIdToken()
      const deviceId = getOrCreateDeviceId()

      const res = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subscription: {
            id: deviceId,
            token: `token-${deviceId}`,
            deviceType,
            enabled: true,
            categories,
          },
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setFeedback({
          type: 'success',
          message: 'Test notification sent.',
        })

        // Trigger in-app notification banner for foreground message without native Notification constructor
        triggerForegroundPushNotification({
          type: 'test',
          title: 'PUSH TEST RECEIVED',
          body: 'Push notifications are working correctly on this device.',
          url: '/',
        })
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'Test notification could not be sent.',
        })
      }
    } catch {
      setFeedback({ type: 'error', message: 'Test notification could not be sent.' })
    } finally {
      setIsTesting(false)
    }
  }, [user, deviceType, categories])

  // Scroll lock background page when modal is active
  useEffect(() => {
    if (!isOpen) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isOpen])

  if (!isOpen || !mounted) return null

  const modalContent = (
    <div
      className="settings-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        className="settings-dialog notification-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notifications-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="notification-modal-header">
          <button
            type="button"
            className="settings-close notification-modal-close"
            onClick={onClose}
            aria-label="Close notifications dialog"
          >
            <X size={18} />
          </button>
          <span className="settings-badge" style={{ background: 'var(--acid)', color: 'var(--ink)' }}>
            <Bell size={13} />
            <span>COMMUNICATIONS</span>
          </span>
          <h2 id="notifications-title">NOTIFICATIONS</h2>
          <p className="settings-sub">
            Get important weather alerts even when the app isn&apos;t open.
          </p>
        </header>

        <div className="notification-modal-body">
          {/* Status Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              border: '2px solid var(--ink)',
              boxShadow: '3px 3px 0 var(--ink)',
              background: '#ffffff',
            }}
          >
            <div>
              <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', color: 'var(--muted)' }}>
                PUSH STATUS
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <span
                  className="intel-status-pill"
                  style={{
                    fontSize: '11px',
                    fontWeight: 900,
                    padding: '4px 10px',
                    background:
                      permState === 'ENABLED'
                        ? 'var(--acid)'
                        : permState === 'BLOCKED'
                        ? 'var(--coral)'
                        : permState === 'UNSUPPORTED'
                        ? '#e2e8f0'
                        : '#fef08a',
                  }}
                >
                  {permState}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 700 }}>
                  Device: {deviceType.toUpperCase()}
                </span>
              </div>
            </div>

            {permState === 'ENABLED' ? (
              <button
                type="button"
                onClick={handleDisable}
                disabled={isProcessing}
                className="secondary-btn"
                style={{ height: '34px', fontSize: '10px', fontWeight: 900, padding: '0 10px', cursor: 'pointer' }}
              >
                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : 'DISABLE'}
              </button>
            ) : permState === 'BLOCKED' ? (
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#dc2626' }}>
                UNBLOCK IN BROWSER
              </span>
            ) : permState === 'UNSUPPORTED' ? (
              <span style={{ fontSize: '10px', fontWeight: 800, color: 'var(--muted)' }}>
                NOT SUPPORTED
              </span>
            ) : (
              <button
                type="button"
                onClick={handleEnable}
                disabled={isProcessing}
                className="primary-btn"
                style={{ height: '34px', fontSize: '10px', fontWeight: 900, margin: 0, padding: '0 12px', cursor: 'pointer' }}
              >
                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : 'ENABLE'}
              </button>
            )}
          </div>

          {/* Feedback Alert */}
          {feedback && (
            <div
              style={{
                padding: '10px 14px',
                border: '2px solid var(--ink)',
                boxShadow: '2px 2px 0 var(--ink)',
                background: feedback.type === 'success' ? 'var(--mint)' : '#fee2e2',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {feedback.type === 'success' ? <Check size={15} /> : <AlertTriangle size={15} color="#dc2626" />}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Push Categories */}
          <div style={{ border: '2px solid var(--ink)', padding: '16px', background: '#ffffff', boxShadow: '3px 3px 0 var(--ink)' }}>
            <span style={{ fontSize: '10px', fontWeight: 900, letterSpacing: '0.1em', color: 'var(--muted)', display: 'block', marginBottom: '12px' }}>
              ALERT CATEGORIES
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={categories.severeAlerts}
                  onChange={() => handleToggleCategory('severeAlerts')}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--ink)', cursor: 'pointer' }}
                />
                <span>Severe weather alerts (Official IMD Warnings)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={categories.rainAlerts}
                  onChange={() => handleToggleCategory('rainAlerts')}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--ink)', cursor: 'pointer' }}
                />
                <span>Rain alerts (Upcoming precipitation timing)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={categories.airQualityAlerts}
                  onChange={() => handleToggleCategory('airQualityAlerts')}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--ink)', cursor: 'pointer' }}
                />
                <span>Air quality alerts (Hazardous AQI spikes)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={categories.dailyBriefing}
                  onChange={() => handleToggleCategory('dailyBriefing')}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--ink)', cursor: 'pointer' }}
                />
                <span>Daily morning weather briefing</span>
              </label>
            </div>
          </div>

          {/* Test & Account Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              border: '2px solid var(--ink)',
              background: '#f8fafc',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <span style={{ fontSize: '11px', fontWeight: 900, display: 'block' }}>
                DISPATCH VERIFICATION
              </span>
              <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700 }}>
                {user ? `Authenticated as ${user.displayName || user.email || 'User'}` : 'Sign in to test delivery'}
              </span>
            </div>

            {user ? (
              <button
                type="button"
                onClick={handleSendTest}
                disabled={isTesting || permState !== 'ENABLED'}
                className="secondary-btn"
                style={{
                  height: '36px',
                  padding: '0 14px',
                  fontSize: '10px',
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: permState === 'ENABLED' ? 'var(--cyan)' : '#e2e8f0',
                  cursor: permState === 'ENABLED' ? 'pointer' : 'not-allowed',
                }}
              >
                {isTesting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                SEND TEST
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  if (onOpenAuth) onOpenAuth()
                }}
                className="secondary-btn"
                style={{
                  height: '36px',
                  padding: '0 12px',
                  fontSize: '10px',
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <UserRound size={13} />
                SIGN IN TO TEST
              </button>
            )}
          </div>

          {/* Disclaimer / Free-tier info */}
          <div
            style={{
              fontSize: '10px',
              color: 'var(--muted)',
              lineHeight: 1.45,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '0 4px',
            }}
          >
            <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>
              ₹0 recurring cost architecture. Web push operates via browser Service Worker standards and Firebase Cloud Messaging without external subscription fees.
            </span>
          </div>
        </div>
      </section>
    </div>
  )

  return createPortal(modalContent, document.body)
}
