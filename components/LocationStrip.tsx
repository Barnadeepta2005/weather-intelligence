'use client'

import { useState } from 'react'
import { MapPin, Heart } from 'lucide-react'
import type { LocationData } from '@/lib/types'

interface LocationStripProps {
  location: LocationData
  isLive?: boolean
}

export function LocationStrip({ location, isLive = true }: LocationStripProps) {
  const [saved, setSaved] = useState(false)

  const adminSuffix =
    location.admin1 && location.admin1.toUpperCase() !== location.city.toUpperCase()
      ? `, ${location.admin1.toUpperCase()}`
      : ''

  return (
    <div className="location-strip">
      <span className="live-dot" style={{ backgroundColor: isLive ? '#22c55e' : '#eab308' }} />
      <MapPin size={14} />
      <strong>
        {location.city}
        {adminSuffix}, {location.country}
      </strong>
      <span className="updated">
        LOCAL TIME {location.localTime} / {isLive ? `UPDATED ${location.lastUpdated}` : 'DEMO MODE (OFFLINE)'}
      </span>
      <button
        onClick={() => setSaved(!saved)}
        className={`save-btn ${saved ? 'saved' : ''}`}
      >
        <Heart size={14} fill={saved ? 'currentColor' : 'none'} />
        {saved ? 'SAVED' : 'SAVE LOCATION'}
      </button>
    </div>
  )
}
