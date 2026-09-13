/**
 * CANONICAL WEATHER ICON SYSTEM — ATMOS WEATHER
 * Single source of truth for vector weather geometry.
 *
 * Requirements:
 * - One clean continuous cloud silhouette (3 rounded lobes, horizontal base)
 * - Zero crossing or overlapping internal strokes
 * - Bold neo-brutalist stroke language (black outlines, acid yellow accents)
 * - Shared across: Landing Page, TopBar, MobileNav, PWA Icons, Snapshot Canvas
 */

export interface CanonicalMarkConfig {
  strokeColor?: string
  sunFill?: string
  cloudFill?: string
  strokeWidth?: number
  size?: number
}

export const CANONICAL_COLORS = {
  ink: '#111111',
  acid: '#c9ff4a',
  surface: '#ffffff',
  accentBlue: '#8de8ef',
}

/**
 * 100x100 viewBox canonical cloud outline path.
 * Continuous single path: horizontal base + 3 rounded lobes.
 * Starts at bottom-left corner of base, traverses clockwise, closes cleanly.
 */
export const CANONICAL_CLOUD_PATH =
  'M 32 72 L 74 72 C 81 72 87 66 87 59 C 87 52 81 46 74 46 C 73 37 66 31 54 31 C 43 31 36 38 35 46 C 29 46 22 51 22 58 C 22 66 27 72 32 72 Z'

/**
 * Centered cloud path for condition 'cloudy' (shifted slightly left/down for optical balance)
 */
export const CANONICAL_CLOUD_CENTERED_PATH =
  'M 28 66 L 72 66 C 79 66 85 60 85 53 C 85 46 79 40 72 40 C 71 31 64 25 52 25 C 41 25 34 32 33 40 C 27 40 20 45 20 52 C 20 60 25 66 28 66 Z'

/**
 * Lightning bolt path for condition 'storm'
 */
export const CANONICAL_LIGHTNING_PATH =
  'M 52 66 L 40 79 L 49 79 L 43 93 L 61 78 L 51 78 Z'

/**
 * Sun parameters in 100x100 coordinate space
 */
export const CANONICAL_SUN = {
  // Sun peeking behind cloud (partly cloudy / brand mark)
  peeking: {
    cx: 65,
    cy: 33,
    r: 14,
    rays: [
      { x1: 65, y1: 15, x2: 65, y2: 9 },   // North
      { x1: 78, y1: 20, x2: 83, y2: 15 },  // North-East
      { x1: 83, y1: 33, x2: 89, y2: 33 },  // East
      { x1: 78, y1: 46, x2: 83, y2: 51 },  // South-East
      { x1: 52, y1: 20, x2: 47, y2: 15 },  // North-West
    ],
  },
  // Full clear sun (condition 'sun' / 'clear')
  full: {
    cx: 50,
    cy: 50,
    r: 18,
    rayRadiusInner: 25,
    rayRadiusOuter: 34,
    rayCount: 8,
  },
}

/**
 * Draw the canonical ATMOS WEATHER brand mark on an HTML5 Canvas context.
 * Uses native Path2D for 100% exact parity with the SVG component.
 */
export function drawCanonicalMarkCanvas(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  options?: CanonicalMarkConfig
) {
  const strokeColor = options?.strokeColor || CANONICAL_COLORS.ink
  const sunFill = options?.sunFill || CANONICAL_COLORS.acid
  const cloudFill = options?.cloudFill || CANONICAL_COLORS.surface

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Scale from 100x100 viewBox to target size and position
  const scale = size / 100
  ctx.translate(cx - size / 2, cy - size / 2)
  ctx.scale(scale, scale)

  // 1. Draw Sun Rays
  ctx.lineWidth = 5
  ctx.strokeStyle = strokeColor
  for (const ray of CANONICAL_SUN.peeking.rays) {
    ctx.beginPath()
    ctx.moveTo(ray.x1, ray.y1)
    ctx.lineTo(ray.x2, ray.y2)
    ctx.stroke()
  }

  // 2. Draw Sun Disc
  ctx.lineWidth = 5
  ctx.fillStyle = sunFill
  ctx.strokeStyle = strokeColor
  ctx.beginPath()
  ctx.arc(CANONICAL_SUN.peeking.cx, CANONICAL_SUN.peeking.cy, CANONICAL_SUN.peeking.r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // 3. Draw Canonical Cloud (Single continuous path, zero interior lines)
  const cloudPath = new Path2D(CANONICAL_CLOUD_PATH)
  ctx.fillStyle = cloudFill
  ctx.fill(cloudPath)

  ctx.lineWidth = 5
  ctx.strokeStyle = strokeColor
  ctx.stroke(cloudPath)

  ctx.restore()
}

/**
 * Draw canonical weather condition icons for Snapshot and cards
 */
export function drawCanonicalConditionCanvas(
  ctx: CanvasRenderingContext2D,
  iconType: 'sun' | 'storm' | 'rain' | 'cloud',
  cx: number,
  cy: number,
  size: number,
  options?: CanonicalMarkConfig
) {
  const strokeColor = options?.strokeColor || CANONICAL_COLORS.ink
  const sunFill = options?.sunFill || CANONICAL_COLORS.acid
  const cloudFill = options?.cloudFill || CANONICAL_COLORS.surface

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const scale = size / 100
  ctx.translate(cx - size / 2, cy - size / 2)
  ctx.scale(scale, scale)

  if (iconType === 'sun') {
    // Full Sun with 8 rays
    const { cx: scx, cy: scy, r, rayRadiusInner, rayRadiusOuter, rayCount } = CANONICAL_SUN.full

    // Rays
    ctx.lineWidth = 5
    ctx.strokeStyle = strokeColor
    for (let i = 0; i < rayCount; i++) {
      const angle = (i * Math.PI) / 4
      const x1 = scx + Math.cos(angle) * rayRadiusInner
      const y1 = scy + Math.sin(angle) * rayRadiusInner
      const x2 = scx + Math.cos(angle) * rayRadiusOuter
      const y2 = scy + Math.sin(angle) * rayRadiusOuter
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }

    // Disc
    ctx.fillStyle = sunFill
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.arc(scx, scy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  } else if (iconType === 'storm') {
    // Cloud + Lightning Bolt
    const cloudPath = new Path2D(CANONICAL_CLOUD_PATH)
    ctx.fillStyle = cloudFill
    ctx.fill(cloudPath)
    ctx.lineWidth = 5
    ctx.strokeStyle = strokeColor
    ctx.stroke(cloudPath)

    // Lightning
    const boltPath = new Path2D(CANONICAL_LIGHTNING_PATH)
    ctx.fillStyle = sunFill
    ctx.fill(boltPath)
    ctx.lineWidth = 4
    ctx.strokeStyle = strokeColor
    ctx.stroke(boltPath)
  } else if (iconType === 'rain') {
    // Cloud + Rain Streaks
    const cloudPath = new Path2D(CANONICAL_CLOUD_PATH)
    ctx.fillStyle = cloudFill
    ctx.fill(cloudPath)
    ctx.lineWidth = 5
    ctx.strokeStyle = strokeColor
    ctx.stroke(cloudPath)

    // Rain dashes
    ctx.lineWidth = 4.5
    ctx.strokeStyle = strokeColor
    const rainLines = [
      { x1: 36, y1: 78, x2: 30, y2: 90 },
      { x1: 48, y1: 78, x2: 42, y2: 90 },
      { x1: 60, y1: 78, x2: 54, y2: 90 },
      { x1: 72, y1: 78, x2: 66, y2: 90 },
    ]
    for (const drop of rainLines) {
      ctx.beginPath()
      ctx.moveTo(drop.x1, drop.y1)
      ctx.lineTo(drop.x2, drop.y2)
      ctx.stroke()
    }
  } else {
    // Partly cloudy (brand mark)
    // 1. Sun rays
    ctx.lineWidth = 5
    ctx.strokeStyle = strokeColor
    for (const ray of CANONICAL_SUN.peeking.rays) {
      ctx.beginPath()
      ctx.moveTo(ray.x1, ray.y1)
      ctx.lineTo(ray.x2, ray.y2)
      ctx.stroke()
    }

    // 2. Sun Disc
    ctx.lineWidth = 5
    ctx.fillStyle = sunFill
    ctx.strokeStyle = strokeColor
    ctx.beginPath()
    ctx.arc(CANONICAL_SUN.peeking.cx, CANONICAL_SUN.peeking.cy, CANONICAL_SUN.peeking.r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // 3. Cloud
    const cloudPath = new Path2D(CANONICAL_CLOUD_PATH)
    ctx.fillStyle = cloudFill
    ctx.fill(cloudPath)
    ctx.lineWidth = 5
    ctx.strokeStyle = strokeColor
    ctx.stroke(cloudPath)
  }

  ctx.restore()
}
