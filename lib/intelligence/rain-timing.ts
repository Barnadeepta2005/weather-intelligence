import type { RainTimingData, RainTimingStatus } from './types'
import type { HourlyEntry } from '@/lib/types'

interface RainTimingInput {
  hourly: HourlyEntry[]
  currentCondition: string
}

export function computeRainTiming({
  hourly,
  currentCondition,
}: RainTimingInput): RainTimingData {
  if (!hourly || hourly.length === 0) {
    return {
      status: 'NO_RAIN',
      headline: 'No meaningful rain expected today.',
      details: 'Immediate hourly forecast indicates dry conditions throughout the day.',
      peakProbability: 0,
    }
  }

  // Parse rain probability numbers from hourly data
  const parsedHourly = hourly.map((h, index) => {
    const prob = parseInt(h.rainProbability?.replace('%', '') || '0', 10) || 0
    const cond = (h.condition || '').toLowerCase()
    const hasRainKeyword =
      cond.includes('rain') ||
      cond.includes('drizzle') ||
      cond.includes('shower') ||
      cond.includes('thunder')
    return {
      index,
      time: h.time,
      prob,
      hasRainKeyword,
      condition: h.condition || 'Clear',
    }
  })

  // Find peak probability in the horizon
  let maxProbItem = parsedHourly[0]
  parsedHourly.forEach((item) => {
    if (item.prob > maxProbItem.prob) {
      maxProbItem = item
    }
  })

  const currentLower = (currentCondition || '').toLowerCase()
  const isCurrentlyRaining =
    currentLower.includes('rain') ||
    currentLower.includes('drizzle') ||
    currentLower.includes('shower') ||
    currentLower.includes('thunder') ||
    (parsedHourly[0]?.hasRainKeyword && parsedHourly[0]?.prob >= 50)

  // 1. Rain Ongoing Scenario
  if (isCurrentlyRaining) {
    // Look for first upcoming hour where rain ceases (prob < 25% and no rain keyword)
    const clearingItem = parsedHourly.find(
      (item, idx) => idx > 0 && item.prob < 30 && !item.hasRainKeyword
    )

    const easingTime = clearingItem ? clearingItem.time : undefined

    return {
      status: 'RAIN_ONGOING',
      headline: easingTime ? `Rain ongoing • Likely to ease around ${easingTime}` : 'Rain ongoing across the area',
      details: `Active precipitation observed. Maximum rain probability stands at ${maxProbItem.prob}%.`,
      peakProbability: Math.max(70, maxProbItem.prob),
      easingTimeLabel: easingTime,
      intensityLabel: currentLower.includes('heavy')
        ? 'Heavy'
        : currentLower.includes('drizzle')
        ? 'Light'
        : 'Moderate',
    }
  }

  // 2. Upcoming Meaningful Rain (e.g. peak probability >= 40%)
  if (maxProbItem.prob >= 40 || maxProbItem.hasRainKeyword) {
    // Find the first hour where rain chance spikes >= 35%
    const upcomingOnset = parsedHourly.find((item) => item.prob >= 35 || item.hasRainKeyword)
    const onsetTime = upcomingOnset ? upcomingOnset.time : maxProbItem.time

    // Find clearing after onset
    const onsetIdx = upcomingOnset ? upcomingOnset.index : 0
    const clearingAfter = parsedHourly.find(
      (item) => item.index > onsetIdx && item.prob < 30 && !item.hasRainKeyword
    )

    return {
      status: 'RAIN_UPCOMING',
      headline: `Rain likely around ${onsetTime}`,
      details: `Peak probability reaches ${maxProbItem.prob}% near ${maxProbItem.time}${
        clearingAfter ? `, tapering off by ${clearingAfter.time}` : ''
      }.`,
      peakProbability: maxProbItem.prob,
      peakTimeLabel: maxProbItem.time,
      easingTimeLabel: clearingAfter?.time,
      intensityLabel: maxProbItem.prob >= 70 ? 'Likely Rain' : 'Scattered Showers',
    }
  }

  // 3. Low / Slight Rain Chance (20% - 39%)
  if (maxProbItem.prob >= 20) {
    return {
      status: 'RAIN_POSSIBLE',
      headline: `Low shower chance around ${maxProbItem.time}`,
      details: `Isolated or brief passing showers possible (${maxProbItem.prob}% chance). No widespread disruption expected.`,
      peakProbability: maxProbItem.prob,
      peakTimeLabel: maxProbItem.time,
      intensityLabel: 'Isolated',
    }
  }

  // 4. Completely Dry Conditions
  return {
    status: 'NO_RAIN',
    headline: 'No meaningful rain expected today.',
    details: 'Precipitation probability remains below 20% across the immediate forecast window.',
    peakProbability: maxProbItem.prob,
    intensityLabel: 'None',
  }
}
