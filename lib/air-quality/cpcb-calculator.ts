/**
 * Official Central Pollution Control Board (CPCB) National Air Quality Index (NAQI)
 * Methodology Implementation.
 *
 * References:
 * - CPCB National Air Quality Index Technical Report (October 2014, IIT Kanpur)
 * - Breakpoints, sub-index interpolation, minimum data criteria (3 pollutants incl. PM2.5/PM10),
 *   and maximum sub-index aggregation.
 */

export interface PollutantReading {
  pollutantId: string // 'PM2.5' | 'PM10' | 'NO2' | 'OZONE' | 'SO2' | 'CO' | 'NH3'
  avgValue: number | null
}

export interface CPCBSubIndex {
  pollutant: string
  concentration: number
  subIndex: number
}

export interface CPCBCalculationResult {
  aqi: number
  category: string
  prominentPollutant: string
  subIndices: CPCBSubIndex[]
  isValid: boolean
  validationError?: string
}

interface Breakpoint {
  bLo: number
  bHi: number
  iLo: number
  iHi: number
}

/** Official CPCB Breakpoints Table */
const CPCB_BREAKPOINTS: Record<string, Breakpoint[]> = {
  'PM2.5': [
    { bLo: 0, bHi: 30, iLo: 0, iHi: 50 },
    { bLo: 31, bHi: 60, iLo: 51, iHi: 100 },
    { bLo: 61, bHi: 90, iLo: 101, iHi: 200 },
    { bLo: 91, bHi: 120, iLo: 201, iHi: 300 },
    { bLo: 121, bHi: 250, iLo: 301, iHi: 400 },
    { bLo: 251, bHi: 350, iLo: 401, iHi: 500 },
  ],
  'PM10': [
    { bLo: 0, bHi: 50, iLo: 0, iHi: 50 },
    { bLo: 51, bHi: 100, iLo: 51, iHi: 100 },
    { bLo: 101, bHi: 250, iLo: 101, iHi: 200 },
    { bLo: 251, bHi: 350, iLo: 201, iHi: 300 },
    { bLo: 351, bHi: 430, iLo: 301, iHi: 400 },
    { bLo: 431, bHi: 500, iLo: 401, iHi: 500 },
  ],
  'NO2': [
    { bLo: 0, bHi: 40, iLo: 0, iHi: 50 },
    { bLo: 41, bHi: 80, iLo: 51, iHi: 100 },
    { bLo: 81, bHi: 180, iLo: 101, iHi: 200 },
    { bLo: 181, bHi: 280, iLo: 201, iHi: 300 },
    { bLo: 281, bHi: 400, iLo: 301, iHi: 400 },
    { bLo: 401, bHi: 500, iLo: 401, iHi: 500 },
  ],
  'OZONE': [
    { bLo: 0, bHi: 50, iLo: 0, iHi: 50 },
    { bLo: 51, bHi: 100, iLo: 51, iHi: 100 },
    { bLo: 101, bHi: 168, iLo: 101, iHi: 200 },
    { bLo: 169, bHi: 208, iLo: 201, iHi: 300 },
    { bLo: 209, bHi: 748, iLo: 301, iHi: 400 },
    { bLo: 749, bHi: 1000, iLo: 401, iHi: 500 },
  ],
  'SO2': [
    { bLo: 0, bHi: 40, iLo: 0, iHi: 50 },
    { bLo: 41, bHi: 80, iLo: 51, iHi: 100 },
    { bLo: 81, bHi: 380, iLo: 101, iHi: 200 },
    { bLo: 381, bHi: 800, iLo: 201, iHi: 300 },
    { bLo: 801, bHi: 1600, iLo: 301, iHi: 400 },
    { bLo: 1601, bHi: 2000, iLo: 401, iHi: 500 },
  ],
  'NH3': [
    { bLo: 0, bHi: 200, iLo: 0, iHi: 50 },
    { bLo: 201, bHi: 400, iLo: 51, iHi: 100 },
    { bLo: 401, bHi: 800, iLo: 101, iHi: 200 },
    { bLo: 801, bHi: 1200, iLo: 201, iHi: 300 },
    { bLo: 1201, bHi: 1800, iLo: 301, iHi: 400 },
    { bLo: 1801, bHi: 2400, iLo: 401, iHi: 500 },
  ],
  'CO': [
    { bLo: 0, bHi: 1.0, iLo: 0, iHi: 50 },
    { bLo: 1.1, bHi: 2.0, iLo: 51, iHi: 100 },
    { bLo: 2.1, bHi: 10.0, iLo: 101, iHi: 200 },
    { bLo: 10.1, bHi: 17.0, iLo: 201, iHi: 300 },
    { bLo: 17.1, bHi: 34.0, iLo: 301, iHi: 400 },
    { bLo: 34.1, bHi: 50.0, iLo: 401, iHi: 500 },
  ],
}

/** Standardize pollutant name keys */
export function normalizePollutantKey(rawKey: string): string {
  const upper = rawKey.trim().toUpperCase()
  if (upper === 'PM2.5' || upper === 'PM25' || upper === 'PM2_5') return 'PM2.5'
  if (upper === 'PM10') return 'PM10'
  if (upper === 'NO2' || upper === 'NITROGEN_DIOXIDE') return 'NO2'
  if (upper === 'OZONE' || upper === 'O3') return 'OZONE'
  if (upper === 'SO2' || upper === 'SULPHUR_DIOXIDE') return 'SO2'
  if (upper === 'CO' || upper === 'CARBON_MONOXIDE') return 'CO'
  if (upper === 'NH3' || upper === 'AMMONIA') return 'NH3'
  return upper
}

/**
 * Calculate CPCB sub-index for a single pollutant using linear interpolation:
 * Ip = I_lo + [(I_hi - I_lo) / (B_hi - B_lo)] * (Cp - B_lo)
 */
export function calculateCPCBSubIndex(pollutantKey: string, concentration: number): number | null {
  const key = normalizePollutantKey(pollutantKey)
  const breakpoints = CPCB_BREAKPOINTS[key]
  if (!breakpoints || concentration < 0 || isNaN(concentration)) {
    return null
  }

  let c = concentration
  // In Indian CAAQMS telemetry, CO is commonly reported in µg/m³ or scaled 0.01 mg/m³ (e.g. 25–200).
  // CPCB breakpoints for CO are strictly in mg/m³ (0–1.0 Good, 1.1–2.0 Satisfactory, etc.).
  if (key === 'CO' && c > 5) {
    c = c > 100 ? c / 1000 : c / 100
  }

  // Find matching breakpoint range
  for (const bp of breakpoints) {
    if (c >= bp.bLo && c <= bp.bHi) {
      const subIndex = bp.iLo + ((bp.iHi - bp.iLo) / (bp.bHi - bp.bLo)) * (c - bp.bLo)
      return Math.round(subIndex)
    }
  }

  // If above maximum defined breakpoint, cap at 500
  if (c > breakpoints[breakpoints.length - 1].bHi) {
    return 500
  }

  return null
}

/**
 * Categorize CPCB AQI value into official Indian categories:
 * 0–50: GOOD
 * 51–100: SATISFACTORY
 * 101–200: MODERATE
 * 201–300: POOR
 * 301–400: VERY POOR
 * 401–500: SEVERE
 */
export function classifyCPCB(aqi: number): string {
  if (aqi <= 50) return 'GOOD'
  if (aqi <= 100) return 'SATISFACTORY'
  if (aqi <= 200) return 'MODERATE'
  if (aqi <= 300) return 'POOR'
  if (aqi <= 400) return 'VERY POOR'
  return 'SEVERE'
}

/**
 * Validate and calculate CPCB NAQI from monitored pollutant readings.
 *
 * Strict CPCB Rules:
 * 1. At least 3 valid pollutant readings must be available.
 * 2. At least one of them MUST be PM2.5 or PM10.
 * 3. Reject null, -999, 'NA', NaN, and invalid non-positive numbers for particulates.
 * 4. Overall AQI = max(sub-indices). Prominent pollutant is the one driving the max sub-index.
 */
export function calculateCPCBAQI(readings: PollutantReading[]): CPCBCalculationResult {
  const subIndices: CPCBSubIndex[] = []
  let hasParticulate = false

  for (const r of readings) {
    const key = normalizePollutantKey(r.pollutantId)
    const val = r.avgValue

    // Reject null, undefined, sentinel -999, NaN, or non-positive particulates
    if (val === null || val === undefined || isNaN(val) || val <= -900) {
      continue
    }

    if ((key === 'PM2.5' || key === 'PM10') && val <= 0) {
      continue
    }

    const sub = calculateCPCBSubIndex(key, val)
    if (sub !== null) {
      subIndices.push({
        pollutant: key === 'OZONE' ? 'O3' : key,
        concentration: val,
        subIndex: sub,
      })

      if (key === 'PM2.5' || key === 'PM10') {
        hasParticulate = true
      }
    }
  }

  // Minimum data criteria validation
  if (subIndices.length < 3) {
    return {
      aqi: 0,
      category: 'UNAVAILABLE',
      prominentPollutant: '',
      subIndices,
      isValid: false,
      validationError: `Insufficient monitored pollutants (${subIndices.length}/3 required by CPCB protocol).`,
    }
  }

  if (!hasParticulate) {
    return {
      aqi: 0,
      category: 'UNAVAILABLE',
      prominentPollutant: '',
      subIndices,
      isValid: false,
      validationError: 'Mandatory particulate matter (PM2.5 or PM10) observation is missing.',
    }
  }

  // Max operator for overall AQI and prominent pollutant
  let maxSubIndex = -1
  let prominent = 'PM2.5'

  for (const si of subIndices) {
    if (si.subIndex > maxSubIndex) {
      maxSubIndex = si.subIndex
      prominent = si.pollutant
    }
  }

  const finalAqi = Math.max(0, Math.min(500, maxSubIndex))
  const category = classifyCPCB(finalAqi)

  return {
    aqi: finalAqi,
    category,
    prominentPollutant: prominent,
    subIndices,
    isValid: true,
  }
}
