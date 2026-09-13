'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import {
  WifiOff,
  Download,
  X,
  Share,
  PlusSquare,
  Smartphone,
  Laptop,
} from 'lucide-react'

interface PWAContextType {
  isStandalone: boolean
  canInstall: boolean
  isIosSafari: boolean
  isOffline: boolean
  triggerInstall: () => void
}

const PWAContext = createContext<PWAContextType>({
  isStandalone: false,
  canInstall: false,
  isIosSafari: false,
  isOffline: false,
  triggerInstall: () => {},
})

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function usePWA() {
  return useContext(PWAContext)
}

interface PWAProviderProps {
  children?: ReactNode
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [isOffline, setIsOffline] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [isIosSafari, setIsIosSafari] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalType, setModalType] = useState<'ios' | 'android' | 'unsupported'>('ios')

  // 1. Service Worker Registration
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    const handleLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          if (process.env.NODE_ENV !== 'production') {
            console.log('[PWA] Service Worker registered with scope:', reg.scope)
          }
        })
        .catch((err) => {
          if (process.env.NODE_ENV !== 'production') {
            console.warn('[PWA] Service Worker registration failed:', err)
          }
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

  // 3. Standalone Mode & Device Detection
  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkStandalone = () => {
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      setIsStandalone(Boolean(standalone))
      return standalone
    }

    const isInstalled = checkStandalone()
    if (isInstalled) return

    // Detect display mode changes
    const mql = window.matchMedia('(display-mode: standalone)')
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsStandalone(true)
        setModalOpen(false)
      }
    }
    mql.addEventListener?.('change', handleMediaChange)

    // Detect iOS Safari (including iPadOS with desktop user agent)
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isMacTouch =
      ((navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform === 'macOS' ||
        /macintosh|macintel/.test(userAgent)) &&
      navigator.maxTouchPoints > 1
    const isIos = (/iphone|ipad|ipod/.test(userAgent) || isMacTouch) && !(window as { MSStream?: unknown }).MSStream
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios|edg|android/.test(userAgent)

    if (isIos && isSafari) {
      setIsIosSafari(true)
    }

    if (/android/.test(userAgent)) {
      setIsAndroid(true)
    }

    // Capture beforeinstallprompt (Chromium / Edge / Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Capture appinstalled
    const handleAppInstalled = () => {
      setDeferredPrompt(null)
      setIsStandalone(true)
      setModalOpen(false)
      if (process.env.NODE_ENV !== 'production') {
        console.log('[PWA] Application successfully installed.')
      }
    }
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      mql.removeEventListener?.('change', handleMediaChange)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // 3. User-Initiated Install Action
  const triggerInstall = useCallback(async () => {
    if (deferredPrompt) {
      // Direct native prompt (Chrome / Android / Chromium Desktop)
      try {
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        if (process.env.NODE_ENV !== 'production') {
          console.log('[PWA] Install prompt outcome:', outcome)
        }
        if (outcome === 'accepted') {
          setDeferredPrompt(null)
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[PWA] Install prompt error:', err)
        }
      }
    } else if (isAndroid) {
      // Android browser fallback (when beforeinstallprompt is unavailable or dismissed)
      setModalType('android')
      setModalOpen(true)
    } else if (isIosSafari) {
      // iOS Safari instructions (Safari does not support beforeinstallprompt)
      setModalType('ios')
      setModalOpen(true)
    } else {
      // Unsupported desktop browser (e.g. Firefox, Safari macOS)
      setModalType('unsupported')
      setModalOpen(true)
    }
  }, [deferredPrompt, isIosSafari, isAndroid])

  // Escape key listener for instruction modal
  useEffect(() => {
    if (!modalOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalOpen])

  const contextValue: PWAContextType = {
    isStandalone,
    canInstall: Boolean(deferredPrompt || isIosSafari),
    isIosSafari,
    isOffline,
    triggerInstall,
  }

  return (
    <PWAContext.Provider value={contextValue}>
      {children}

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

      {/* PWA INSTALLATION INSTRUCTION MODAL */}
      {modalOpen && (
        <div
          className="pwa-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false)
          }}
        >
          <div className="pwa-modal-card">
            {/* Modal Header */}
            <div className="pwa-modal-header">
              <div className="pwa-modal-header-text">
                <span className="pwa-modal-tag">PWA INSTALLATION</span>
                <h3 id="pwa-modal-title" className="pwa-modal-title">
                  {modalType === 'ios'
                    ? 'Add ATMOS WEATHER to your Home Screen'
                    : modalType === 'android'
                    ? 'Install ATMOS WEATHER'
                    : 'App Installation'}
                </h3>
              </div>
              <button
                type="button"
                className="pwa-modal-close-btn"
                onClick={() => setModalOpen(false)}
                aria-label="Close installation instructions"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="pwa-modal-body">
              {modalType === 'ios' ? (
                <div className="pwa-instructions-list">
                  <p className="pwa-instruction-intro">
                    Add ATMOS WEATHER to your Home Screen for full-screen standalone access:
                  </p>
                  <div className="pwa-step-item">
                    <span className="pwa-step-num">1</span>
                    <div className="pwa-step-text">
                      Tap <strong>Share</strong> <Share size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> in the Safari toolbar.
                    </div>
                  </div>
                  <div className="pwa-step-item">
                    <span className="pwa-step-num">2</span>
                    <div className="pwa-step-text">
                      Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong> <PlusSquare size={14} style={{ display: 'inline', verticalAlign: 'middle' }} />.
                    </div>
                  </div>
                  <div className="pwa-step-item">
                    <span className="pwa-step-num">3</span>
                    <div className="pwa-step-text">
                      Tap <strong>&quot;Add&quot;</strong> in the top-right corner.
                    </div>
                  </div>
                  <div className="pwa-instruction-note">
                    Tap Share, then Add to Home Screen.
                  </div>
                </div>
              ) : modalType === 'android' ? (
                <div className="pwa-instructions-list">
                  <p className="pwa-instruction-intro">
                    Install ATMOS WEATHER to your device for standalone access:
                  </p>
                  <div className="pwa-step-item">
                    <span className="pwa-step-num">1</span>
                    <div className="pwa-step-text">
                      Tap the browser menu (three dots <strong>⋮</strong> in the corner).
                    </div>
                  </div>
                  <div className="pwa-step-item">
                    <span className="pwa-step-num">2</span>
                    <div className="pwa-step-text">
                      Tap <strong>&quot;Install app&quot;</strong> or <strong>&quot;Add to Home screen&quot;</strong>.
                    </div>
                  </div>
                  <div className="pwa-step-item">
                    <span className="pwa-step-num">3</span>
                    <div className="pwa-step-text">
                      Tap <strong>&quot;Install&quot;</strong> to confirm.
                    </div>
                  </div>
                  <div className="pwa-instruction-note">
                    💡 The app icon will appear in your app drawer and Home Screen.
                  </div>
                </div>
              ) : (
                <div className="pwa-instructions-list">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: 900, fontSize: '13px' }}>
                    <Laptop size={18} />
                    <span>APP INSTALLATION NOT AVAILABLE</span>
                  </div>
                  <p style={{ margin: '8px 0', fontSize: '12px', lineHeight: 1.5, color: '#333' }}>
                    App installation is not available in this browser.
                  </p>
                  <div className="pwa-instruction-note" style={{ background: '#f1f5f9', borderLeftColor: 'var(--ink)' }}>
                    To install ATMOS WEATHER as a standalone app, open this page in <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, or <strong>Brave</strong>.
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pwa-modal-footer">
              <button
                type="button"
                className="pwa-btn primary"
                onClick={() => setModalOpen(false)}
                style={{ width: '100%' }}
              >
                GOT IT
              </button>
            </div>
          </div>
        </div>
      )}
    </PWAContext.Provider>
  )
}

/**
 * Desktop Top-Level Action Button: "INSTALL APP"
 * Automatically hidden if app is running in standalone mode.
 */
export function InstallAppButton({ className = '' }: { className?: string }) {
  const { isStandalone, triggerInstall } = usePWA()
  if (isStandalone) return null

  return (
    <button
      type="button"
      onClick={triggerInstall}
      className={`install-app-btn ${className}`}
      aria-label="Install ATMOS WEATHER"
      title="Install ATMOS WEATHER App"
    >
      <Download size={14} />
      <span>INSTALL APP</span>
    </button>
  )
}

/**
 * Mobile Navigation Icon Button
 * Compact 42x42 square matching mobile navigation rhythm.
 * Automatically hidden if app is running in standalone mode.
 */
export function MobileInstallButton({ className = '' }: { className?: string }) {
  const { isStandalone, triggerInstall } = usePWA()
  if (isStandalone) return null

  return (
    <button
      type="button"
      onClick={triggerInstall}
      className={`mobile-install-btn ${className}`}
      aria-label="Install ATMOS WEATHER"
      title="Install ATMOS WEATHER App"
    >
      <Download size={18} />
    </button>
  )
}
