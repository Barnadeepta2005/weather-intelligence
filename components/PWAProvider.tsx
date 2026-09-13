'use client'

import { useEffect, useState, useCallback } from 'react'
import { WifiOff, Download, X, Share } from 'lucide-react'

export function PWAProvider() {
  const [isOffline, setIsOffline] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [isIosSafari, setIsIosSafari] = useState(false)
  const [showIosHint, setShowIosHint] = useState(false)

  // 1. Service Worker Registration
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    // Register service worker after window load to preserve page load speed
    const handleLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[PWA] Service Worker registered with scope:', reg.scope)
          }
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration failed:', err)
        })
    }

    if (document.readyState === 'complete') {
      handleLoad()
    } else {
      window.addEventListener('load', handleLoad)
      return () => window.removeEventListener('load', handleLoad)
    }
  }, [])

  // 2. Online / Offline Monitoring
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => setIsOffline(false)

    if (!navigator.onLine) {
      setIsOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 3. Standalone Mode & Install Prompt Handling
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if app is already running as installed PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')

    if (isStandalone) {
      // Installed app — never show install banners
      return
    }

    // Check if user dismissed install prompt recently
    const dismissedUntil = localStorage.getItem('wi_pwa_dismissed_until')
    const isDismissed = dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)

    // Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIos = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios|edg/.test(userAgent)

    if (isIos && isSafari && !isDismissed) {
      setIsIosSafari(true)
    }

    // Listen for native beforeinstallprompt (Chromium / Edge / Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      if (!isDismissed) {
        setShowInstallBanner(true)
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Listen for appinstalled
    const handleAppInstalled = () => {
      setShowInstallBanner(false)
      setShowIosHint(false)
      setDeferredPrompt(null)
      if (process.env.NODE_ENV !== 'production') {
        console.log('[PWA] Application successfully installed.')
      }
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // Handle native install click
  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return
    try {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (process.env.NODE_ENV !== 'production') {
        console.log('[PWA] User choice:', outcome)
      }
      setDeferredPrompt(null)
      setShowInstallBanner(false)
    } catch (err) {
      console.warn('[PWA] Installation prompt failed:', err)
    }
  }, [deferredPrompt])

  // Handle install dismiss
  const handleDismiss = useCallback(() => {
    setShowInstallBanner(false)
    setShowIosHint(false)
    // Dismiss for 7 days
    const nextWeek = Date.now() + 7 * 24 * 60 * 60 * 1000
    try {
      localStorage.setItem('wi_pwa_dismissed_until', String(nextWeek))
    } catch {
      // Ignore storage errors
    }
  }, [])

  return (
    <>
      {/* OFFLINE STATUS BANNER */}
      {isOffline && (
        <div
          className="pwa-offline-banner"
          role="status"
          aria-live="polite"
        >
          <div className="pwa-offline-content">
            <WifiOff size={15} />
            <span>
              <strong>OFFLINE MODE:</strong> Live weather, CPCB AQI, and radar require an active connection. Showing cached shell.
            </span>
          </div>
        </div>
      )}

      {/* INSTALL PROMPT BANNER (Chromium / Edge / Android) */}
      {showInstallBanner && deferredPrompt && (
        <div
          className="pwa-install-banner"
          role="region"
          aria-label="Install App Prompt"
        >
          <div className="pwa-install-info">
            <span className="pwa-install-tag">WEB APPLICATION</span>
            <strong className="pwa-install-title">INSTALL WEATHER INTELLIGENCE</strong>
            <p className="pwa-install-desc">
              Get a faster, standalone experience with homescreen access.
            </p>
          </div>
          <div className="pwa-install-actions">
            <button
              type="button"
              className="pwa-btn primary"
              onClick={handleInstallClick}
            >
              <Download size={14} />
              INSTALL
            </button>
            <button
              type="button"
              className="pwa-btn secondary"
              onClick={handleDismiss}
              aria-label="Dismiss install prompt"
            >
              NOT NOW
            </button>
          </div>
        </div>
      )}

      {/* IOS SAFARI HINT BANNER (Conditional) */}
      {isIosSafari && showIosHint && (
        <div
          className="pwa-install-banner"
          role="region"
          aria-label="iOS Install Instructions"
        >
          <div className="pwa-install-info">
            <span className="pwa-install-tag">IOS APP SHORTCUT</span>
            <strong className="pwa-install-title">ADD TO HOMESCREEN</strong>
            <p className="pwa-install-desc">
              Tap <Share size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> in Safari and select <strong>&quot;Add to Home Screen&quot;</strong>.
            </p>
          </div>
          <div className="pwa-install-actions">
            <button
              type="button"
              className="pwa-btn secondary"
              onClick={handleDismiss}
            >
              GOT IT
            </button>
          </div>
        </div>
      )}
    </>
  )
}
