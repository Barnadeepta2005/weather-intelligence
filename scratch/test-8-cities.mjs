// Comprehensive test script across the 8 required cities + rural India fallback

const TEST_LOCATIONS = [
  { name: 'Kolkata', country: 'India', lat: 22.5726, lon: 88.3639, tz: 'Asia/Kolkata' },
  { name: 'Delhi', country: 'India', lat: 28.6139, lon: 77.2090, tz: 'Asia/Kolkata' },
  { name: 'Mumbai', country: 'India', lat: 19.0760, lon: 72.8777, tz: 'Asia/Kolkata' },
  { name: 'Bengaluru', country: 'India', lat: 12.9719, lon: 77.5937, tz: 'Asia/Kolkata' },
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278, tz: 'Europe/London' },
  { name: 'Tokyo', country: 'Japan', lat: 35.6895, lon: 139.6917, tz: 'Asia/Tokyo' },
  { name: 'New York', country: 'United States', lat: 40.7128, lon: -74.0060, tz: 'America/New_York' },
  { name: 'Sydney', country: 'Australia', lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney' },
  // Edge Case: Rural India location with no station within 25 km (Anini, Arunachal Pradesh)
  { name: 'Anini (Rural)', country: 'India', lat: 28.7900, lon: 95.9000, tz: 'Asia/Kolkata' },
]

async function runTests() {
  console.log('========================================================================================')
  console.log('STEP 5 — VERIFYING AIR QUALITY ENGINE ACROSS ALL LOCATIONS')
  console.log('========================================================================================\n')

  const results = []

  for (const loc of TEST_LOCATIONS) {
    const url = `http://localhost:3000/api/air-quality?latitude=${loc.lat}&longitude=${loc.lon}&country=${encodeURIComponent(loc.country)}&city=${encodeURIComponent(loc.name)}&timezone=${encodeURIComponent(loc.tz)}`

    try {
      const res = await fetch(url)
      if (!res.ok) {
        console.error(`FAILED: ${loc.name} (HTTP ${res.status})`)
        continue
      }
      const data = await res.json()
      results.push({
        city: loc.name,
        country: loc.country,
        sourceType: data.sourceType,
        sourceName: data.sourceName,
        standard: data.standard,
        aqi: data.index,
        category: data.level,
        prominentPollutant: data.prominentPollutant || '—',
        pm25: data.pm25 !== null ? `${data.pm25} µg/m³` : '—',
        pm10: data.pm10 !== null ? `${data.pm10} µg/m³` : '—',
        o3: data.o3 !== null ? `${data.o3} µg/m³` : '—',
        no2: data.no2 !== null ? `${data.no2} µg/m³` : '—',
        timestamp: data.timestamp,
        isFallback: data.isFallback,
      })

      console.log(`[${loc.name}]`)
      console.log(`  Source Type : ${data.sourceType}`)
      console.log(`  Source Name : ${data.sourceName}`)
      console.log(`  Standard    : ${data.standard}`)
      console.log(`  AQI / Level : ${data.index} (${data.level})`)
      console.log(`  Prominent   : ${data.prominentPollutant || 'N/A'}`)
      console.log(`  Pollutants  : PM2.5=${data.pm25 ?? '—'}, PM10=${data.pm10 ?? '—'}, O3=${data.o3 ?? '—'}, NO2=${data.no2 ?? '—'}`)
      console.log(`  Fallback?   : ${data.isFallback}`)
      console.log('----------------------------------------------------------------------------------------')
    } catch (err) {
      console.error(`ERROR querying ${loc.name}:`, err.message)
    }

    // Small delay between requests
    await new Promise(r => setTimeout(r, 600))
  }

  console.log('\nSUMMARY TABLE:')
  console.table(results, ['city', 'sourceType', 'standard', 'aqi', 'category', 'prominentPollutant', 'isFallback'])
}

runTests()
