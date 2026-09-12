'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Zap, ExternalLink, X, Clock, MapPin, ShieldCheck, ChevronRight } from 'lucide-react'
import type { WeatherAlert, AlertSeverity } from '@/lib/alerts/types'

interface AlertBannerProps {
  alerts: WeatherAlert[]
}

function getSeverityBadge(severity: AlertSeverity): { label: string; bg: string; text: string } {
  switch (severity) {
    case 'EXTREME':
      return { label: 'WARNING', bg: '#ef4444', text: '#ffffff' }
    case 'SEVERE':
      return { label: 'ALERT', bg: '#f97316', text: '#ffffff' }
    case 'MODERATE':
      return { label: 'WATCH', bg: '#eab308', text: '#000000' }
    default:
      return { label: 'ADVISORY', bg: '#3b82f6', text: '#ffffff' }
  }
}

function getBannerTheme(severity: AlertSeverity): { bg: string; border: string } {
  switch (severity) {
    case 'EXTREME':
      return { bg: '#fee2e2', border: '#b91c1c' }
    case 'SEVERE':
      return { bg: '#ffedd5', border: '#c2410c' }
    case 'MODERATE':
      return { bg: '#fef9c3', border: '#854d0e' }
    default:
      return { bg: '#dbeafe', border: '#1d4ed8' }
  }
}

function getActionGuidance(severity: AlertSeverity, title: string): string {
  const isLightning = title.toUpperCase().includes('LIGHTNING') || title.toUpperCase().includes('THUNDERSTORM')
  const isRain = title.toUpperCase().includes('RAIN')

  if (severity === 'EXTREME') {
    return 'Take immediate action. Remain indoors away from windows and electrical fixtures. Follow instructions issued by disaster management authorities.'
  }
  if (severity === 'SEVERE') {
    if (isLightning) {
      return 'Be prepared. Seek safe shelter immediately if thunder roars. Avoid standing under isolated trees, open fields, or tin sheds.'
    }
    if (isRain) {
      return 'Be prepared for localized waterlogging, low visibility, and transport disruption. Avoid vulnerable roads and low-lying zones.'
    }
    return 'Be prepared for adverse weather conditions. Secure outdoor items and stay informed with local meteorological updates.'
  }
  // MODERATE
  if (isLightning) {
    return 'Watch and be updated. Thunderstorms and lightning expected. Postpone non-essential outdoor work and monitor weather evolution.'
  }
  return 'Keep track of local weather updates. Moderate weather conditions may develop across the district.'
}

export function AlertBanner({ alerts }: AlertBannerProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setModalOpen(false)
      }
    }
    if (modalOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalOpen])

  if (!alerts || alerts.length === 0) {
    return null
  }

  // Use primary (highest severity) alert for banner display
  const primaryAlert = alerts[0]
  const badge = getSeverityBadge(primaryAlert.severity)
  const theme = getBannerTheme(primaryAlert.severity)
  const guidance = getActionGuidance(primaryAlert.severity, primaryAlert.title)

  const validityText = primaryAlert.endTime
    ? `Valid upto ${primaryAlert.endTime}`
    : primaryAlert.validDate
    ? `Date: ${primaryAlert.validDate}`
    : ''

  const modalContent = (
    <div
      className="alert-modal-backdrop"
      onClick={() => setModalOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Official Weather Alert Details"
    >
      <div
        className="alert-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="alert-modal-header" style={{ borderBottomColor: '#000' }}>
          <div className="alert-modal-title-wrap">
            <span
              className="alert-modal-badge"
              style={{ backgroundColor: badge.bg, color: badge.text }}
            >
              {badge.label}
            </span>
            <h2 className="alert-modal-title">{primaryAlert.title}</h2>
          </div>
          <button
            type="button"
            className="alert-modal-close"
            onClick={() => setModalOpen(false)}
            aria-label="Close alert details"
          >
            <X size={20} />
          </button>
        </div>

        <div className="alert-modal-body">
          {/* Affected Area & Source */}
          <div className="alert-detail-row">
            <div className="alert-detail-item">
              <span className="alert-detail-label">
                <MapPin size={14} className="inline-icon" /> AFFECTED REGION
              </span>
              <strong className="alert-detail-val">{primaryAlert.area}</strong>
              <span className="alert-detail-sub">IMD District ID: {primaryAlert.districtId}</span>
            </div>

            <div className="alert-detail-item">
              <span className="alert-detail-label">
                <Clock size={14} className="inline-icon" /> VALIDITY WINDOW
              </span>
              <strong className="alert-detail-val">
                {validityText || 'Immediate (3-Hour Outlook)'}
              </strong>
              {primaryAlert.issuedAt && (
                <span className="alert-detail-sub">Issued: {primaryAlert.issuedAt}</span>
              )}
            </div>
          </div>

          {/* Official IMD Warning Text */}
          <div className="alert-detail-box">
            <div className="alert-box-header">
              <ShieldCheck size={16} />
              <span>OFFICIAL IMD METEOROLOGICAL ADVISORY</span>
            </div>
            <p className="alert-box-text">{primaryAlert.description}</p>
          </div>

          {/* Action Guidance */}
          <div className="alert-guidance-box" style={{ backgroundColor: theme.bg }}>
            <div className="alert-guidance-head">
              <AlertTriangle size={16} />
              <strong>RECOMMENDED SAFETY PRECAUTIONS</strong>
            </div>
            <p className="alert-guidance-text">{guidance}</p>
          </div>

          {/* Attribution & Official Link */}
          <div className="alert-modal-footer">
            <div className="alert-modal-source">
              <span>Source: <strong>India Meteorological Department (IMD)</strong></span>
              <span className="alert-source-sub">Ministry of Earth Sciences • Govt of India</span>
            </div>
            <a
              href={primaryAlert.sourceUrl || 'https://mausam.imd.gov.in'}
              target="_blank"
              rel="noopener noreferrer"
              className="alert-external-btn"
            >
              <span>VIEW ON MAUSAM</span>
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <aside
        className="alert-banner"
        style={{
          backgroundColor: theme.bg,
        }}
        aria-live="polite"
        role="region"
        aria-label="Weather Alert Notice"
      >
        <div className="alert-banner-left">
          <div className="alert-badge-group">
            <span
              className="alert-severity-pill"
              style={{ backgroundColor: badge.bg, color: badge.text }}
            >
              {badge.label}
            </span>
            <span className="alert-source-pill">IMD OFFICIAL</span>
          </div>

          <div className="alert-banner-content">
            <h3 className="alert-banner-title">
              <Zap size={16} className="alert-icon" />
              <span>{primaryAlert.title}</span>
            </h3>
            <p className="alert-banner-sub">
              <span>{primaryAlert.area}</span>
              {validityText && (
                <>
                  <span className="alert-sep">•</span>
                  <span>{validityText}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="alert-details-btn"
          onClick={() => setModalOpen(true)}
          aria-label="View official alert details"
        >
          <span>DETAILS</span>
          <ChevronRight size={16} />
        </button>
      </aside>

      {mounted && modalOpen && createPortal(modalContent, document.body)}
    </>
  )
}
