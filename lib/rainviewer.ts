/**
 * RainViewer Weather Maps API client.
 *
 * Communicates with RainViewer's free public endpoint:
 * https://api.rainviewer.com/public/weather-maps.json
 *
 * Strict ₹0 recurring-cost requirement using free open radar data.
 * RainViewer free tier provides historical/past radar frames (~2 hours at 10-min intervals)
 * plus the latest frame. Free tier does NOT include future nowcast.
 */

export interface RadarFrame {
  time: number
  path: string
  timeFormatted: string
  isLatest: boolean
}

export interface RadarMetadata {
  host: string
  generated: number
  frames: RadarFrame[]
  latestFrame: RadarFrame | null
  updatedAgoMinutes: number
}

/**
 * Format unix timestamp (seconds) into local "HH:MM".
 */
export function formatRadarTime(unixSeconds: number, timezone?: string): string {
  try {
    const d = new Date(unixSeconds * 1000)
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    })
  } catch {
    const d = new Date(unixSeconds * 1000)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
}

/**
 * Build the tile URL template for MapLibre raster source.
 * Color scheme 2 = Universal Blue (clean, legible against light basemaps).
 */
export function getRadarTileUrl(
  host: string,
  path: string,
  tileSize: 256 | 512 = 256,
  colorScheme = 2
): string {
  return `${host}${path}/${tileSize}/{z}/{x}/{y}/${colorScheme}/1_1.png`
}

/**
 * Fetch and normalize RainViewer weather radar metadata.
 */
export async function getRainViewerMetadata(timezone?: string): Promise<RadarMetadata> {
  const url = 'https://api.rainviewer.com/public/weather-maps.json'
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 6000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      throw new Error(`RainViewer API returned HTTP ${res.status}`)
    }

    const json = await res.json()
    if (!json || typeof json !== 'object' || !json.host) {
      throw new Error('Malformed RainViewer metadata payload')
    }

    const host: string = json.host
    const pastFrames: Array<{ time: number; path: string }> = Array.isArray(json.radar?.past)
      ? json.radar.past
      : []

    if (pastFrames.length === 0) {
      throw new Error('No radar frames currently available from RainViewer')
    }

    const total = pastFrames.length
    const frames: RadarFrame[] = pastFrames.map((f, index) => {
      const isLatest = index === total - 1
      return {
        time: f.time,
        path: f.path,
        timeFormatted: formatRadarTime(f.time, timezone),
        isLatest,
      }
    })

    const latestFrame = frames[frames.length - 1] || null
    const nowSeconds = Math.floor(Date.now() / 1000)
    const diffMinutes = latestFrame ? Math.max(0, Math.round((nowSeconds - latestFrame.time) / 60)) : 10

    return {
      host,
      generated: json.generated ?? nowSeconds,
      frames,
      latestFrame,
      updatedAgoMinutes: diffMinutes,
    }
  } finally {
    clearTimeout(timeoutId)
  }
}
