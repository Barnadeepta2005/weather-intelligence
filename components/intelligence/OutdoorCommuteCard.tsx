'use client'

import React from 'react'
import { Footprints, Car, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react'
import type { OutdoorGuidanceData, CommuteGuidanceData, OutdoorState, CommuteState } from '@/lib/intelligence/types'

interface OutdoorCommuteCardProps {
  outdoor: OutdoorGuidanceData
  commute: CommuteGuidanceData
}

export function OutdoorCommuteCard({ outdoor, commute }: OutdoorCommuteCardProps) {
  const getOutdoorBadge = (state: OutdoorState) => {
    switch (state) {
      case 'AVOID':
        return { bg: 'var(--coral)', text: '#111' }
      case 'NOT IDEAL':
        return { bg: 'var(--orange)', text: '#111' }
      case 'CAUTION':
        return { bg: 'var(--acid)', text: '#111' }
      case 'GOOD':
      default:
        return { bg: 'var(--mint)', text: '#111' }
    }
  }

  const getCommuteBadge = (state: CommuteState) => {
    switch (state) {
      case 'DIFFICULT':
        return { bg: 'var(--coral)', text: '#111' }
      case 'WATCH OUT':
        return { bg: 'var(--orange)', text: '#111' }
      case 'SMOOTH':
      default:
        return { bg: 'var(--mint)', text: '#111' }
    }
  }

  const outBadge = getOutdoorBadge(outdoor.state)
  const comBadge = getCommuteBadge(commute.state)

  return (
    <div className="outdoor-commute-container">
      {/* OUTDOOR GUIDANCE CARD */}
      <div className="intel-card outdoor-card">
        <div className="intel-card-header">
          <div className="intel-kicker-group">
            <span className="intel-kicker">ACTIVITY GUIDANCE</span>
            <h3 className="intel-title">OUTDOOR</h3>
          </div>
          <div className="intel-status-pill" style={{ backgroundColor: outBadge.bg, color: outBadge.text }}>
            <Footprints size={13} />
            <span>{outdoor.state}</span>
          </div>
        </div>

        <div className="intel-card-body">
          <strong className="intel-body-headline">{outdoor.headline}</strong>
          <p className="intel-body-details">{outdoor.details}</p>
          <div className="intel-sub-tag">
            <span>DRIVER: {outdoor.keyFactor}</span>
          </div>
        </div>
      </div>

      {/* COMMUTE INTELLIGENCE CARD */}
      <div className="intel-card commute-card">
        <div className="intel-card-header">
          <div className="intel-kicker-group">
            <span className="intel-kicker">TRANSIT & ROADS</span>
            <h3 className="intel-title">COMMUTE</h3>
          </div>
          <div className="intel-status-pill" style={{ backgroundColor: comBadge.bg, color: comBadge.text }}>
            <Car size={13} />
            <span>{commute.state}</span>
          </div>
        </div>

        <div className="intel-card-body">
          <strong className="intel-body-headline">{commute.headline}</strong>
          <p className="intel-body-details">{commute.details}</p>
          {commute.impactWindow && (
            <div className="intel-sub-tag">
              <span>WINDOW: {commute.impactWindow}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
