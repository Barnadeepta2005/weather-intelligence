'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Settings, Thermometer, UserRound, LogOut, Check, Info } from 'lucide-react'
import type { User } from 'firebase/auth'
import type { TemperatureUnit, SelectedLocation } from '@/lib/types'

export interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  unit: TemperatureUnit
  onUnitChange: (unit: TemperatureUnit) => void
  user: User | null
  onOpenAuth?: () => void
  onSignOut?: () => void
  currentLocation?: SelectedLocation
}

export function SettingsModal({
  isOpen,
  onClose,
  unit,
  onUnitChange,
  user,
  onOpenAuth,
  onSignOut,
  currentLocation,
}: SettingsModalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close on Escape key
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
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="settings-close"
          onClick={onClose}
          aria-label="Close settings dialog"
        >
          <X size={18} />
        </button>

        <p className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Settings size={13} /> WEATHER INTELLIGENCE / PREFERENCES
        </p>
        <h2 id="settings-title">Settings</h2>
        <p className="settings-copy">
          Configure display preferences and manage your account.
        </p>

        {/* SECTION 1: TEMPERATURE UNIT */}
        <div className="settings-section">
          <div className="settings-section-header">
            <span className="settings-section-title">
              <Thermometer size={14} /> TEMPERATURE UNIT
            </span>
            <span className="settings-section-badge">CURRENT: {unit}</span>
          </div>
          <p className="settings-section-desc">
            Changes all temperatures across the dashboard, hourly forecast, and weekly outlook.
          </p>
          <div className="unit-switch-group">
            <button
              type="button"
              className={`unit-switch-btn ${unit === '°C' ? 'active' : ''}`}
              onClick={() => onUnitChange('°C')}
              aria-pressed={unit === '°C'}
            >
              <span className="unit-symbol">°C</span>
              <span className="unit-label">CELSIUS</span>
              {unit === '°C' && <Check size={14} className="unit-check" />}
            </button>
            <button
              type="button"
              className={`unit-switch-btn ${unit === '°F' ? 'active' : ''}`}
              onClick={() => onUnitChange('°F')}
              aria-pressed={unit === '°F'}
            >
              <span className="unit-symbol">°F</span>
              <span className="unit-label">FAHRENHEIT</span>
              {unit === '°F' && <Check size={14} className="unit-check" />}
            </button>
          </div>
        </div>

        {/* SECTION 2: ACCOUNT & SYNC */}
        <div className="settings-section">
          <div className="settings-section-header">
            <span className="settings-section-title">
              <UserRound size={14} /> ACCOUNT &amp; SYNC
            </span>
            <span className={`settings-account-badge ${user ? 'signed-in' : ''}`}>
              {user ? 'AUTHENTICATED' : 'GUEST'}
            </span>
          </div>

          {user ? (
            <div className="settings-user-card">
              <div className="settings-user-info">
                <strong>{user.displayName || 'WEATHER USER'}</strong>
                <small>{user.email || 'Email registered'}</small>
              </div>
              <button
                type="button"
                className="settings-action-btn sign-out-btn"
                onClick={() => {
                  onClose()
                  onSignOut?.()
                }}
              >
                <LogOut size={13} />
                <span>SIGN OUT</span>
              </button>
            </div>
          ) : (
            <div className="settings-guest-card">
              <p>Sign in to synchronize your saved cities and preferences across devices.</p>
              <button
                type="button"
                className="settings-action-btn sign-in-btn"
                onClick={() => {
                  onClose()
                  onOpenAuth?.()
                }}
              >
                <UserRound size={14} />
                <span>SIGN IN / CREATE ACCOUNT</span>
              </button>
            </div>
          )}
        </div>

        {/* SECTION 3: APPLICATION INFO */}
        <div className="settings-section">
          <div className="settings-section-header">
            <span className="settings-section-title">
              <Info size={14} /> CURRENT LOCATION
            </span>
          </div>
          <div className="settings-location-info">
            <strong>{currentLocation?.name || 'Kolkata'}, {currentLocation?.country || 'India'}</strong>
            <small>
              Lat: {currentLocation?.latitude?.toFixed(2)}° N / Lon: {currentLocation?.longitude?.toFixed(2)}° E
            </small>
          </div>
        </div>

        <div className="settings-footer">
          <button type="button" className="settings-done-btn" onClick={onClose}>
            DONE
          </button>
        </div>
      </section>
    </div>
  )

  return createPortal(modalContent, document.body)
}
