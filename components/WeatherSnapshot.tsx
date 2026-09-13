'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Download, Share2, Loader2, Check, AlertCircle } from 'lucide-react'
import type { DashboardData } from '@/lib/open-meteo'
import type {
  SelectedLocation,
  TemperatureUnit,
  InsightData,
  WeatherIconType,
} from '@/lib/types'
import type { AlertsResponse } from '@/lib/alerts/types'
import { drawCanonicalConditionCanvas } from '@/lib/weather-icons/canonical-paths'

interface WeatherSnapshotProps {
  isOpen: boolean
  onClose: () => void
  location: SelectedLocation
  data: DashboardData | null
  alertsData: AlertsResponse | null
  todayInsight: InsightData | null
  unit: TemperatureUnit
  weatherRisk?: { score: number; level: string } | null
}

/** Sanitize city name and format deterministic filename */
export function getSnapshotFilename(cityName: string, dateStr?: string): string {
  const safeCity =
    cityName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'weather'
  const date = dateStr
    ? dateStr.replace(/[^0-9-]/g, '')
    : new Date().toISOString().split('T')[0]
  return `atmos-weather-${safeCity}-${date}.png`
}

/** Helper: draw weather icon onto canvas using canonical vector mark system */
function drawWeatherIcon(
  ctx: CanvasRenderingContext2D,
  iconType: WeatherIconType,
  cx: number,
  cy: number,
  size: number
) {
  drawCanonicalConditionCanvas(ctx, iconType, cx, cy, size)
}

/** Helper: wrap and draw text on canvas */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number = 3
): number {
  const words = text.split(' ')
  let line = ''
  let currentY = y
  let linesDrawn = 0

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' '
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line.trim(), x, currentY)
      line = words[n] + ' '
      currentY += lineHeight
      linesDrawn++
      if (linesDrawn >= maxLines - 1 && n < words.length - 1) {
        // Ellipsize remaining
        const remaining = words.slice(n).join(' ')
        let truncated = remaining
        while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1)
        }
        ctx.fillText(truncated + '...', x, currentY)
        return currentY + lineHeight
      }
    } else {
      line = testLine
    }
  }
  ctx.fillText(line.trim(), x, currentY)
  return currentY + lineHeight
}

export function WeatherSnapshot({
  isOpen,
  onClose,
  location,
  data,
  alertsData,
  todayInsight,
  unit,
  weatherRisk,
}: WeatherSnapshotProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [pngUrl, setPngUrl] = useState<string | null>(null)
  const [pngBlob, setPngBlob] = useState<Blob | null>(null)
  const [generating, setGenerating] = useState<boolean>(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState<boolean>(false)

  // Clear toast after 3 seconds
  useEffect(() => {
    if (!toastMsg) return
    const t = setTimeout(() => setToastMsg(null), 3500)
    return () => clearTimeout(t)
  }, [toastMsg])

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

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      const origOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = origOverflow
      }
    }
  }, [isOpen])

  // Render the Weather Intelligence snapshot to Canvas
  const generateSnapshot = useCallback(() => {
    if (!data) return
    setGenerating(true)
    setGenError(null)

    const canvas = canvasRef.current || document.createElement('canvas')
    canvasRef.current = canvas
    canvas.width = 1200
    canvas.height = 1500
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setGenError('Unable to initialize canvas rendering context.')
      setGenerating(false)
      return
    }

    try {
      // 1. Warm off-white canvas backdrop
      ctx.fillStyle = '#f5f2e9'
      ctx.fillRect(0, 0, 1200, 1500)

      // 2. Brutalist Card Shadow & Card Frame
      const cardX = 54
      const cardY = 54
      const cardW = 1092
      const cardH = 1392
      const shadowOffset = 16

      // Hard offset black shadow
      ctx.fillStyle = '#000000'
      ctx.fillRect(cardX + shadowOffset, cardY + shadowOffset, cardW, cardH)

      // Main Card Surface
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(cardX, cardY, cardW, cardH)

      // Thick Black Card Border
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 6
      ctx.strokeRect(cardX, cardY, cardW, cardH)

      // 3. TOP KICKER BAR (y = 54 to 146)
      // Acid Yellow Pill
      const pillX = 96
      const pillY = 90
      const pillW = 270
      const pillH = 36
      ctx.fillStyle = '#e2f163'
      ctx.fillRect(pillX, pillY, pillW, pillH)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 3
      ctx.strokeRect(pillX, pillY, pillW, pillH)

      ctx.fillStyle = '#000000'
      ctx.font = '900 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText('ATMOS WEATHER', pillX + 16, pillY + 23)

      // Top Right: Live indicator + local time
      const isLive = data.isLive
      const localTimeStr = data.location.localTime || ''
      const lastUpdated = data.location.lastUpdated || 'RECENT'

      ctx.fillStyle = isLive ? '#22c55e' : '#eab308'
      ctx.beginPath()
      ctx.arc(880, 108, 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.fillStyle = '#000000'
      ctx.font = '800 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      const statusText = isLive ? `LIVE METRICS • ${localTimeStr}` : `OFFLINE DEMO • ${lastUpdated}`
      ctx.fillText(statusText, 898, 113)

      // Horizontal separator
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(cardX, 148)
      ctx.lineTo(cardX + cardW, 148)
      ctx.stroke()

      // 4. HERO SECTION: LOCATION & TEMPERATURE
      // City Name
      const cityName = (location.name || data.location.city || 'CURRENT LOCATION').toUpperCase()
      const regionText = [
        location.admin1 || data.location.admin1,
        location.country || data.location.country,
      ]
        .filter(Boolean)
        .join(', ')
        .toUpperCase()

      // Adaptive font sizing for long city names
      let cityFontSize = 68
      if (cityName.length > 20) cityFontSize = 46
      else if (cityName.length > 14) cityFontSize = 54

      ctx.fillStyle = '#000000'
      ctx.font = `900 ${cityFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
      ctx.fillText(cityName, 96, 224)

      // Region subtitle
      if (regionText) {
        ctx.fillStyle = '#64748b'
        ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.fillText(regionText, 98, 258)
      }

      // Hero Temp
      const tempVal = data.currentConditions.temperature
      const feelsLikeVal = data.currentConditions.feelsLike
      const highVal = data.currentConditions.high
      const lowVal = data.currentConditions.low

      ctx.fillStyle = '#000000'
      ctx.font = '900 140px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      const tempStr = String(tempVal)
      ctx.fillText(tempStr, 96, 400)

      const tempWidth = ctx.measureText(tempStr).width
      // Degree unit sign
      ctx.font = '900 68px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(unit, 96 + tempWidth + 10, 325)

      // Condition Pill Badge
      const condition = (data.currentConditions.condition || 'Clear').toUpperCase()
      ctx.font = '900 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      const condWidth = ctx.measureText(condition).width
      const condPillW = condWidth + 36
      const condPillH = 42
      const condPillX = 96
      const condPillY = 430

      ctx.fillStyle = '#d8b4fe' // Soft lavender
      ctx.fillRect(condPillX, condPillY, condPillW, condPillH)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 3
      ctx.strokeRect(condPillX, condPillY, condPillW, condPillH)

      ctx.fillStyle = '#000000'
      ctx.fillText(condition, condPillX + 18, condPillY + 28)

      // Phase 5: Optional compact intelligence field
      if (weatherRisk && typeof weatherRisk.score === 'number') {
        const riskBadgeX = condPillX + condPillW + 14
        const riskText = `ATMOS WEATHER RISK: ${weatherRisk.score}/100 — ${weatherRisk.level}`
        ctx.font = '900 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        const riskTextW = ctx.measureText(riskText).width
        const riskPillW = riskTextW + 28
        const riskPillH = condPillH

        ctx.fillStyle = weatherRisk.score >= 60 ? '#fee2e2' : weatherRisk.score >= 40 ? '#fef08a' : '#dcfce7'
        ctx.fillRect(riskBadgeX, condPillY, riskPillW, riskPillH)
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 3
        ctx.strokeRect(riskBadgeX, condPillY, riskPillW, riskPillH)

        ctx.fillStyle = '#000000'
        ctx.fillText(riskText, riskBadgeX + 14, condPillY + 27)
      }

      // Secondary Temp Strip: Feels Like / High / Low
      const subMetricsText = `FEELS LIKE ${feelsLikeVal}° • HIGH ${highVal}° • LOW ${lowVal}°`
      ctx.fillStyle = '#1e293b'
      ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(subMetricsText, 98, 506)

      // Right Column: Weather Icon Illustration
      drawWeatherIcon(
        ctx,
        data.currentConditions.iconType || 'sun',
        930,
        320,
        170
      )

      // 5. OPTIONAL OFFICIAL IMD ALERT BANNER
      let nextSectionY = 540
      const hasAlert = alertsData?.hasActiveAlerts && alertsData.alerts.length > 0

      if (hasAlert) {
        const activeAlert = alertsData.alerts[0]
        const alertBoxY = nextSectionY
        const alertBoxH = 110
        const alertBoxW = 1008
        const alertBoxX = 96

        // Severity Color
        let alertBg = '#fef3c7' // Yellow/Moderate default
        if (activeAlert.severity === 'SEVERE' || activeAlert.severity === 'EXTREME') {
          alertBg = '#fee2e2'
        } else if (activeAlert.severity === 'INFO' || activeAlert.severity === 'MINOR') {
          alertBg = '#e0e7ff'
        }

        // Shadow & Box
        ctx.fillStyle = '#000000'
        ctx.fillRect(alertBoxX + 6, alertBoxY + 6, alertBoxW, alertBoxH)

        ctx.fillStyle = alertBg
        ctx.fillRect(alertBoxX, alertBoxY, alertBoxW, alertBoxH)
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 3.5
        ctx.strokeRect(alertBoxX, alertBoxY, alertBoxW, alertBoxH)

        // Badge: IMD OFFICIAL WARNING
        ctx.fillStyle = '#b91c1c'
        ctx.font = '900 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.fillText('🚨 IMD OFFICIAL WARNING', alertBoxX + 22, alertBoxY + 34)

        // Alert Title
        ctx.fillStyle = '#000000'
        ctx.font = '900 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        const alertTitle = (activeAlert.title || 'Official Weather Warning').toUpperCase()
        ctx.fillText(alertTitle, alertBoxX + 22, alertBoxY + 68)

        // Area & Timeframe
        ctx.fillStyle = '#475569'
        ctx.font = '700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        const areaLine = `${activeAlert.area || location.name} District • Active Official Notice`
        ctx.fillText(areaLine, alertBoxX + 22, alertBoxY + 94)

        nextSectionY += alertBoxH + 34
      }

      // 6. ATMOSPHERIC METRICS TILES (3 Columns)
      const tileY = nextSectionY
      const tileH = 220
      const tileW = 314
      const tileGap = 33
      const tile1X = 96
      const tile2X = tile1X + tileW + tileGap
      const tile3X = tile2X + tileW + tileGap

      // Helper for neo-brutalist metric card
      const drawTile = (x: number, y: number, w: number, h: number, bg: string) => {
        ctx.fillStyle = '#000000'
        ctx.fillRect(x + 6, y + 6, w, h)
        ctx.fillStyle = bg
        ctx.fillRect(x, y, w, h)
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 3.5
        ctx.strokeRect(x, y, w, h)
      }

      // TILE 1: AIR QUALITY
      const aqi = data.airQuality
      const hasAqi = aqi && aqi.index !== null && aqi.index !== undefined

      drawTile(tile1X, tileY, tileW, tileH, '#f8fafc')
      // Header
      ctx.fillStyle = '#000000'
      ctx.font = '900 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      const aqiStandard = aqi?.standard || 'US'
      ctx.fillText(`AIR QUALITY • ${aqiStandard}`, tile1X + 18, tileY + 34)

      if (hasAqi) {
        ctx.font = '900 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.fillText(String(aqi.index), tile1X + 18, tileY + 104)

        ctx.font = '900 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        const levelStr = (aqi.level || 'Good').toUpperCase()
        ctx.fillText(levelStr, tile1X + 18, tileY + 138)

        // Source badge
        const isGround = aqi.sourceType === 'GROUND_STATION'
        const srcTag = isGround ? 'GROUND STATION' : 'ATMOSPHERIC MODEL'
        ctx.fillStyle = isGround ? '#15803d' : '#64748b'
        ctx.font = '800 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.fillText(srcTag, tile1X + 18, tileY + 168)

        if (aqi.prominentPollutant) {
          ctx.fillStyle = '#475569'
          ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          ctx.fillText(`Main: ${aqi.prominentPollutant}`, tile1X + 18, tileY + 192)
        }
      } else {
        ctx.font = '800 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.fillStyle = '#64748b'
        ctx.fillText('NO STATION DATA', tile1X + 18, tileY + 110)
      }

      // TILE 2: UV INDEX
      const uv = data.uv
      drawTile(tile2X, tileY, tileW, tileH, '#f8fafc')
      ctx.fillStyle = '#000000'
      ctx.font = '900 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText('UV INDEX', tile2X + 18, tileY + 34)

      ctx.font = '900 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(String(uv?.index ?? '--'), tile2X + 18, tileY + 104)

      ctx.font = '900 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText((uv?.level || 'Moderate').toUpperCase(), tile2X + 18, tileY + 138)

      ctx.fillStyle = '#64748b'
      ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      const uvAdvice = uv?.advice || 'Standard outdoor protection'
      drawWrappedText(ctx, uvAdvice, tile2X + 18, tileY + 168, tileW - 36, 16, 2)

      // TILE 3: ATMOSPHERIC (WIND & HUMIDITY)
      drawTile(tile3X, tileY, tileW, tileH, '#f8fafc')
      ctx.fillStyle = '#000000'
      ctx.font = '900 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText('ENVIRONMENT', tile3X + 18, tileY + 34)

      const windSpeed = data.currentConditions.wind.speed
      const windDir = data.currentConditions.wind.direction
      const humidity = data.currentConditions.humidity
      const pressure = data.currentConditions.pressure
      const visibility = data.currentConditions.visibility

      ctx.fillStyle = '#000000'
      ctx.font = '800 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText(`WIND: ${windSpeed} km/h ${windDir}`, tile3X + 18, tileY + 76)
      ctx.fillText(`HUMIDITY: ${humidity}%`, tile3X + 18, tileY + 112)
      ctx.fillText(`PRESSURE: ${pressure} hPa`, tile3X + 18, tileY + 148)
      ctx.fillText(`VISIBILITY: ${visibility} km`, tile3X + 18, tileY + 184)

      nextSectionY += tileH + 34

      // 7. TODAY'S INSIGHT (COMPACT EDITORIAL BLOCK)
      const insight = todayInsight || data.insight
      if (insight && nextSectionY < 1250) {
        const insightBoxX = 96
        const insightBoxY = nextSectionY
        const insightBoxW = 1008
        const insightBoxH = 170

        // Hard shadow & background
        ctx.fillStyle = '#000000'
        ctx.fillRect(insightBoxX + 6, insightBoxY + 6, insightBoxW, insightBoxH)
        ctx.fillStyle = '#fffdf5' // Cream
        ctx.fillRect(insightBoxX, insightBoxY, insightBoxW, insightBoxH)
        ctx.strokeStyle = '#000000'
        ctx.lineWidth = 3.5
        ctx.strokeRect(insightBoxX, insightBoxY, insightBoxW, insightBoxH)

        // Pill Tag: TODAY'S INSIGHT
        ctx.fillStyle = '#000000'
        ctx.font = '900 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        ctx.fillText("TODAY'S INTELLIGENCE INSIGHT", insightBoxX + 22, insightBoxY + 36)

        // Headline
        const headlineText =
          insight.headline ||
          insight.heading ||
          insight.description ||
          'Weather conditions are within normal regional patterns.'
        ctx.fillStyle = '#000000'
        ctx.font = '900 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        const nextY = drawWrappedText(
          ctx,
          headlineText,
          insightBoxX + 22,
          insightBoxY + 72,
          insightBoxW - 44,
          30,
          2
        )

        // Advice / Recommendation snippet if space allows
        const subAdvice = insight.recommendation || insight.explanation
        if (subAdvice && nextY < insightBoxY + insightBoxH - 10) {
          ctx.fillStyle = '#475569'
          ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          drawWrappedText(ctx, subAdvice, insightBoxX + 22, nextY + 6, insightBoxW - 44, 20, 2)
        }
      }

      // 8. FOOTER BAR (y = 1360 to 1446)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.moveTo(cardX, 1340)
      ctx.lineTo(cardX + cardW, 1340)
      ctx.stroke()

      // Left Footer: Brand
      ctx.fillStyle = '#000000'
      ctx.font = '900 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText('ATMOS WEATHER', 96, 1380)

      ctx.fillStyle = '#64748b'
      ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText('Official IMD & CPCB data where available • Atmospheric models by Open-Meteo', 96, 1406)

      // Right Footer: Localized Generation Timestamp
      const now = new Date()
      const dateDisplay = now.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).toUpperCase()
      const timeDisplay = now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
      const tzName = location.timezone && location.timezone !== 'auto' ? location.timezone : ''

      ctx.fillStyle = '#000000'
      ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(`${dateDisplay} • ${timeDisplay} ${tzName ? `(${tzName})` : ''}`, cardX + cardW - 42, 1380)

      ctx.fillStyle = '#64748b'
      ctx.font = '700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ctx.fillText('LIVE LOCAL REPORT • ₹0 PUBLIC DATA', cardX + cardW - 42, 1406)
      ctx.textAlign = 'left' // Reset

      // Generate PNG blob & URL
      canvas.toBlob((blob) => {
        if (!blob) {
          setGenError('Failed to generate PNG blob from canvas.')
          setGenerating(false)
          return
        }
        setPngBlob(blob)
        const url = URL.createObjectURL(blob)
        setPngUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return url
        })
        setGenerating(false)
      }, 'image/png')
    } catch (err: unknown) {
      console.error('[WeatherSnapshot] Generation error:', err)
      const message = err instanceof Error ? err.message : 'Error generating snapshot canvas.'
      setGenError(message)
      setGenerating(false)
    }
  }, [data, location, alertsData, todayInsight, unit])

  // Trigger generation whenever modal opens or active dependencies change
  useEffect(() => {
    if (isOpen && data) {
      generateSnapshot()
    } else {
      // Discard when closed
      setPngBlob(null)
      setPngUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [isOpen, data, generateSnapshot])

  // Deterministic download helper
  const triggerDownload = useCallback((blob: Blob) => {
    const filename = getSnapshotFilename(location.name)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    setToastMsg(`Downloaded ${filename}`)
  }, [location.name])

  // Handle Download button click
  const handleDownload = () => {
    if (!pngBlob) return
    triggerDownload(pngBlob)
  }

  // Handle Share button click with Web Share API + fallback
  const handleShare = async () => {
    if (!pngBlob) return
    const filename = getSnapshotFilename(location.name)
    const file = new File([pngBlob], filename, { type: 'image/png' })

    const shareData = {
      title: `ATMOS WEATHER — ${location.name}`,
      text: `Live weather snapshot for ${location.name}: ${data?.currentConditions.temperature}°${unit}, ${data?.currentConditions.condition}.`,
      files: [file],
    }

    // Modern Web Share API with file support
    if (
      typeof navigator !== 'undefined' &&
      navigator.canShare &&
      navigator.canShare({ files: [file] })
    ) {
      try {
        await navigator.share(shareData)
        setToastMsg('Snapshot shared successfully!')
        return
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User closed the share sheet
          return
        }
        console.warn('[WeatherSnapshot] Web share failed, falling back to download:', err)
      }
    }

    // Fallback: direct download
    triggerDownload(pngBlob)
    setToastMsg('Web Share unavailable on this device: downloaded PNG.')
  }

  // Copy PNG to clipboard if supported
  const handleCopyImage = async () => {
    if (!pngBlob) return
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob }),
        ])
        setIsCopied(true)
        setToastMsg('Copied snapshot image to clipboard!')
        setTimeout(() => setIsCopied(false), 2500)
        return
      } catch {
        // Fallback to download
      }
    }
    triggerDownload(pngBlob)
  }

  if (!isOpen) return null

  return (
    <div
      className="snapshot-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="snapshot-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="snapshot-modal-card">
        {/* MODAL HEADER */}
        <div className="snapshot-modal-header">
          <div className="snapshot-header-left">
            <span className="snapshot-tag">SHAREABLE SNAPSHOT</span>
            <h2 id="snapshot-modal-title" className="snapshot-modal-heading">
              {location.name.toUpperCase()} WEATHER CARD
            </h2>
          </div>
          <button
            type="button"
            className="snapshot-close-btn"
            onClick={onClose}
            aria-label="Close share weather snapshot"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY / PREVIEW CONTAINER */}
        <div className="snapshot-preview-area">
          {generating ? (
            <div className="snapshot-loading-state">
              <Loader2 size={32} className="animate-spin" />
              <p>RENDERING 1200 × 1500 HIGH-RES CARD...</p>
            </div>
          ) : genError ? (
            <div className="snapshot-error-state">
              <AlertCircle size={28} color="#dc2626" />
              <p>Failed to render card: {genError}</p>
              <button
                type="button"
                className="primary-btn"
                onClick={generateSnapshot}
              >
                RETRY
              </button>
            </div>
          ) : pngUrl ? (
            <div className="snapshot-image-frame">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pngUrl}
                alt={`Weather snapshot card for ${location.name}`}
                className="snapshot-preview-img"
              />
            </div>
          ) : null}
        </div>

        {/* FEEDBACK TOAST */}
        {toastMsg && (
          <div className="snapshot-toast" role="status">
            <Check size={14} />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* MODAL ACTIONS */}
        <div className="snapshot-modal-actions">
          <button
            type="button"
            className="snapshot-action-btn primary"
            onClick={handleDownload}
            disabled={generating || !pngBlob}
          >
            <Download size={15} />
            DOWNLOAD PNG
          </button>

          <button
            type="button"
            className="snapshot-action-btn share"
            onClick={handleShare}
            disabled={generating || !pngBlob}
          >
            <Share2 size={15} />
            SHARE
          </button>

          <button
            type="button"
            className="snapshot-action-btn secondary"
            onClick={handleCopyImage}
            disabled={generating || !pngBlob}
            title="Copy image to clipboard"
          >
            {isCopied ? <Check size={15} /> : <Download size={15} />}
            {isCopied ? 'COPIED!' : 'COPY IMAGE'}
          </button>

          <button
            type="button"
            className="snapshot-action-btn close"
            onClick={onClose}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  )
}
