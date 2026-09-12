# Critical Air Quality Architecture Review

---

### A. Current AQI Pipeline Audit

Tracing the pipeline from coordinates to the UI:

```
Selected Location Coordinates (e.g. 22.5726, 88.3639 — Kolkata)
                        ↓
Server Route: /api/weather?latitude=...&longitude=...&timezone=...
                        ↓
Open-Meteo Air Quality API Request:
https://air-quality-api.open-meteo.com/v1/air-quality?latitude=22.5726&longitude=88.3639
  &current=us_aqi,european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone
  &hourly=us_aqi,european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone
  &timezone=Asia%2FKolkata
                        ↓
Timestamp Alignment:
Matched local top-of-hour: forecast.current.time.substring(0, 13)
Finds index in aqJson.hourly.time matching local hour
                        ↓
Variable Extraction:
- Primary AQI: Math.round(hourly.us_aqi[matchedHourlyIdx])
- Standard: 'US' (0–500 scale)
- Category Classification: classifyUSAQI (Good: 0–50, Moderate: 51–100, Unhealthy Sensitive: 101–150, Unhealthy: 151–200, Very Unhealthy: 201–300, Hazardous: 301–500)
- Pollutants: hourly.pm2_5, hourly.pm10, hourly.ozone, hourly.nitrogen_dioxide at same index
                        ↓
AirQualityData Payload sent to Client:
{
  index: 51,
  standard: 'US',
  level: 'MODERATE',
  pm25: 7, pm10: 8, o3: 78, no2: 3,
  timestamp: '2026-09-12T13:00'
}
                        ↓
AQICard Presentation:
- Title: "US AIR QUALITY INDEX"
- Value: 51 | MODERATE
- Meter Bar: (51 / 300) = 17% fill
- Scale Ticks: GOOD / MODERATE / UNHEALTHY
- Pollutants: PM2.5 (7 µg/m³), PM10 (8 µg/m³), O₃ (78 µg/m³), NO₂ (3 µg/m³)
```

* **Nature of Data**: Sourced from Open-Meteo's **Copernicus CAMS atmospheric dispersion model** (gridded numerical simulation at ~40 km resolution). It is **not** ground monitoring station data.

---

### B. Why Current Results Differ from Indian Expectations

Users in India comparing the app to local sources (e.g. CPCB bulletins, SAFAR, SAMEER app, local news) will observe significant discrepancies due to three fundamental factors:

1. **Different Breakpoints and Risk Scale**:
   * Under the **US EPA AQI**, a $PM_{2.5}$ concentration of $35.5\ \mu\text{g/m}^3$ triggers an AQI of $101$ ("Unhealthy for Sensitive Groups").
   * Under the **Indian CPCB NAQI**, $PM_{2.5}$ up to $60\ \mu\text{g/m}^3$ is classified as **"Satisfactory"** (AQI 51–100), and is only considered "Moderate" between $61 - 90\ \mu\text{g/m}^3$.
   * *Example*: A $PM_{2.5}$ of $55\ \mu\text{g/m}^3$ in Kolkata reads as **149 (Unhealthy / Orange)** in US AQI, but **92 (Satisfactory / Light Green)** in CPCB AQI. Displaying US AQI without clarification leads Indian users to believe air quality is alarming when official domestic guidelines state it is satisfactory.
2. **Category Names**:
   * US EPA uses: *Good, Moderate, Unhealthy for Sensitive Groups, Unhealthy, Very Unhealthy, Hazardous*.
   * CPCB NAQI uses: *Good, Satisfactory, Moderate, Poor, Very Poor, Severe*.
   * Indian users expect the word **"Satisfactory"** for moderate-clean air and **"Poor" / "Very Poor" / "Severe"** during winter smog episodes.
3. **Atmospheric Model vs Ground Station Reality**:
   * Open-Meteo outputs model predictions across a 40×40 km grid cell. It accounts for synoptic weather, rain washout, and regional chemical transport, but smooths out hyper-local urban canyon emissions.
   * CPCB Continuous Ambient Air Quality Monitoring Stations (CAAQMS) measure ambient air directly at street or rooftop level (e.g. Victoria Memorial, Ballygunge in Kolkata; Anand Vihar in Delhi). During rain, CPCB monitors often report higher particulate spikes than satellite-grid models predict due to immediate local diesel and road-dust resuspension.

---

### C. Official CPCB Methodology Requirements

The Central Pollution Control Board (CPCB) National Air Quality Index (NAQI) protocol (established October 2014 by IIT Kanpur and the CPCB Expert Committee) mandates the following rules:

#### 1. Pollutants Monitored (8 Pollutants)
* $PM_{10}$ (24-hour average, $\mu\text{g/m}^3$)
* $PM_{2.5}$ (24-hour average, $\mu\text{g/m}^3$)
* $NO_2$ (24-hour average, $\mu\text{g/m}^3$)
* $SO_2$ (24-hour average, $\mu\text{g/m}^3$)
* $CO$ (8-hour average, $\text{mg/m}^3$)
* $O_3$ (8-hour average or 1-hour average, $\mu\text{g/m}^3$)
* $NH_3$ (24-hour average, $\mu\text{g/m}^3$)
* $Pb$ (24-hour average, $\mu\text{g/m}^3$)

#### 2. Official Breakpoint Table

| Category | AQI Range | $PM_{10}$ (24h) | $PM_{2.5}$ (24h) | $NO_2$ (24h) | $O_3$ (8h) | $CO$ (8h) $\text{mg/m}^3$ | $SO_2$ (24h) | $NH_3$ (24h) | $Pb$ (24h) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Good** | 0 – 50 | 0 – 50 | 0 – 30 | 0 – 40 | 0 – 50 | 0 – 1.0 | 0 – 40 | 0 – 200 | 0 – 0.5 |
| **Satisfactory** | 51 – 100 | 51 – 100 | 31 – 60 | 41 – 80 | 51 – 100 | 1.1 – 2.0 | 41 – 80 | 201 – 400 | 0.6 – 1.0 |
| **Moderate** | 101 – 200 | 101 – 250 | 61 – 90 | 81 – 180 | 101 – 168 | 2.1 – 10.0 | 81 – 380 | 401 – 800 | 1.1 – 2.0 |
| **Poor** | 201 – 300 | 251 – 350 | 91 – 120 | 181 – 280 | 169 – 208 | 10.1 – 17.0 | 381 – 800 | 801 – 1200 | 2.1 – 3.0 |
| **Very Poor** | 301 – 400 | 351 – 430 | 121 – 250 | 281 – 400 | 209 – 748 | 17.1 – 34.0 | 801 – 1600 | 1201 – 1800 | 3.1 – 3.5 |
| **Severe** | 401 – 500 | > 430 | > 250 | > 400 | > 748 | > 34.0 | > 1600 | > 1800 | > 3.5 |

#### 3. Sub-Index Interpolation Formula
For any pollutant concentration $C_p$:
$$I_p = I_{lo} + \left[ \frac{I_{hi} - I_{lo}}{B_{hi} - B_{lo}} \right] \times (C_p - B_{lo})$$
Where:
* $B_{hi}, B_{lo}$ are breakpoint concentrations enclosing $C_p$
* $I_{hi}, I_{lo}$ are the corresponding AQI category boundaries

#### 4. Mandatory Minimum Data Criteria
* A minimum of **3 pollutants** must have valid monitored data.
* **Strict Rule**: At least one of the 3 pollutants **MUST be either $PM_{2.5}$ or $PM_{10}$**.
* If particulate matter is absent, CPCB rules explicitly prohibit publishing an AQI.

#### 5. Overall AQI Rule (Max Operator)
$$AQI = \max(I_1, I_2, I_3, \dots, I_n)$$
The pollutant responsible for the highest sub-index is designated the **Prominent / Driving Pollutant**.

---

### D. Best Free Indian Data-Source Candidates

Evaluation against the 14 required criteria (A through N):

| Criterion | Candidate 1: **Data.gov.in (OGD India / CPCB CAAQMS API)** | Candidate 2: **OpenAQ API (v3)** | Candidate 3: **WAQI / AQICN API** |
| :--- | :--- | :--- | :--- |
| **A. Is it actually free?** | Yes | Yes (community free tier) | Yes (free token for non-commercial) |
| **B. Requires API key?** | Yes | Yes (`X-API-Key`) | Yes (`token`) |
| **C. Is the key free?** | Yes (instant registration) | Yes (instant via explore.openaq.org) | Yes (instant via aqicn.org) |
| **D. Current / near-real-time?** | Yes (hourly station reports) | Yes (fetches CPCB feeds hourly) | Yes (hourly station reports) |
| **E. PM2.5 available?** | Yes | Yes | Yes |
| **F. PM10 available?** | Yes | Yes | Yes |
| **G. O3 available?** | Yes | Yes | Yes |
| **H. NO2 available?** | Yes | Yes | Yes |
| **I. Direct AQI provided?** | **Yes** (calculates CPCB AQI + prominent pollutant directly per station) | **No** (only raw physical measurements; does not calculate AQI) | Yes (instantcast index, though primarily US-scaled) |
| **J. Can CPCB AQI be computed?** | Already computed by CPCB | Yes, by writing a CPCB calculator over returned parameters | Yes, if raw `iaqi` measurements are mapped |
| **K. Rate Limits** | 10 requests / min, 10,000 / day | **10 requests / min**, 10,000 / month | 1,000 requests / min |
| **L. Commercial / Public Web permitted?** | Yes (National Data Sharing and Accessibility Policy — NDSAP) | Yes (with attribution; cannot replicate OpenAQ platform) | Non-commercial / open dashboard permitted |
| **M. Attribution Required** | "Data source: Central Pollution Control Board (CPCB), Ministry of Environment, Forest & Climate Change via Data.gov.in" | "Air quality data provided by OpenAQ and CPCB" | "Air quality data provided by The World Air Quality Index Project / CPCB" |
| **N. Geographic Coverage in India** | ~500+ official CAAQMS stations in ~250 cities | Same CPCB network (~500 stations) + select research sensors | Same CPCB network (~500 stations) |

---

### E. OpenAQ Suitability Analysis

* **Strengths**: High uptime, global standardized JSON format, reliable AWS-backed infrastructure, ingests CPCB stations directly.
* **Critical Limitations**:
  1. **No Precomputed AQI**: OpenAQ explicitly refuses to calculate AQI, leaving sub-index computation, averaging window tracking, and prominent pollutant determination to the client.
  2. **Free-Tier Cap**: 10,000 requests per **month** (approx. 330 requests/day). For a live public web application without aggressive server-side caching, this limit can be exhausted rapidly.
  3. **Multi-Parameter Requests**: Querying multiple parameters ($PM_{2.5}, PM_{10}, NO_2, O_3$) often requires iterating sensor objects, consuming multiple request quotas unless batched.
* **Verdict on OpenAQ**: Suitable as a secondary data pipeline, but requires client/server-side CPCB calculation logic and strict in-memory caching.

---

### F. Free-Tier & Rate-Limit Details

1. **Data.gov.in (Official CPCB API Resource `3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69`)**:
   * Rate Limit: 10 requests/minute per IP/key, 10,000 requests/day.
   * Cost: ₹0 recurring cost.
   * Failure Mode: Known to experience periodic latency (3–8s) and gateway timeouts during peak hours. Server-side caching (15–30 minutes) is mandatory.
2. **Open-Meteo Air Quality API (Current Global Provider)**:
   * Rate Limit: 10,000 calls/day for non-commercial open use.
   * Cost: ₹0 recurring cost.
   * Reliability: 99.9% uptime, sub-200ms latency globally.
   * Nature: Numerical simulation/forecast model (CAMS).

---

### G. Recommended Regional Architecture

A clean, decoupled Provider Pattern should be introduced to isolate data sources by geographic region:

```
                            Location Request (lat, lon, country)
                                           ↓
                              AirQualityService.getAQI()
                                           ↓
                        ┌──────────────────┴──────────────────┐
                        │                                     │
                 [Country == 'INDIA']                  [Other Countries]
                        ↓                                     ↓
              IndiaGroundAQIProvider                 GlobalModelProvider
             (Data.gov.in / CPCB CAAQMS)            (Open-Meteo CAMS Model)
                        ↓                                     ↓
             ┌──────────┴──────────┐                          │
          [Success]             [Station Offline              │
             │                   / Rural Area]                │
             │                         └─── Fallback ─────────┤
             ↓                                                ↓
    CPCB GROUND STATION AQI                           MODELED AIR QUALITY
    - Standard: CPCB NAQI (0–500)                     - Standard: US EPA AQI
    - Source: CPCB Station (e.g. Victoria Memorial)    - Source: Copernicus CAMS Model
    - Categories: Good, Satisfactory, Moderate, etc.  - Badge: [MODELED FORECAST]
    - Prominent Pollutant: PM2.5 / PM10
```

#### TypeScript Abstraction Contract (Proposal):
```ts
export interface UnifiedAirQuality {
  index: number
  standard: 'CPCB' | 'US' | 'EUROPEAN'
  sourceType: 'GROUND_STATION' | 'ATMOSPHERIC_MODEL'
  sourceName: string          // e.g. "CPCB — Victoria Memorial, Kolkata" or "Copernicus CAMS Model"
  level: string               // e.g. "SATISFACTORY" (CPCB) or "MODERATE" (US)
  prominentPollutant?: string // e.g. "PM2.5"
  pm25: number | null
  pm10: number | null
  o3: number | null
  no2: number | null
  timestamp: string
  isFallback: boolean
}
```

---

### H. What Exact Source Should Become Primary for India

* **Primary Candidate**: **CPCB Official CAAQMS Feed via Data.gov.in (or CPCB CCR Open Data)**.
* **Rationale**:
  1. It provides the **official Government of India National Air Quality Index** and prominent pollutant directly calculated by the statutory monitoring body.
  2. The values match the SAMEER mobile app, national media, and pollution control boards exactly.
  3. It carries zero data-license subscription costs (NDSAP Open Access).

---

### I. What Should Remain the Global Fallback

* **Primary Global Source & Indian Fallback**: **Open-Meteo Air Quality (Copernicus CAMS Model)**.
* **Rationale**:
  1. Complete global coverage: Every coordinate on Earth (including rural India, oceans, smaller towns without CAAQMS sensors) returns valid data.
  2. Ultra-high reliability and sub-second response times.
  3. ₹0 recurring-cost compliance.
* **Mandatory Labeling Rule**: When fallback occurs for an Indian location without a local ground station, the UI must explicitly display:
  ```
  MODELED AIR QUALITY · US AQI
  (Station data unavailable in this area)
  ```
  It must **never** pretend model data is a CPCB ground station reading.

---

### J. Implementation Risks & Mitigation Strategy

1. **Risk 1: CPCB Station Density Gaps**:
   * Ground monitoring stations exist in ~250 Indian cities. The remaining 4,000+ towns and rural areas have no CAAQMS monitors within a 25 km radius.
   * *Mitigation*: The service must compute the radial distance to the nearest station. If `distance > 25km`, it must gracefully fall back to the labeled CAMS model rather than returning an irrelevant station 150 km away.
2. **Risk 2: Data.gov.in Downtime & Gateway Latency**:
   * Government servers occasionally fail under load or return HTTP 504.
   * *Mitigation*: Cache station responses in-memory on the Next.js server with a 20-minute TTL. Implement a 4-second timeout that falls back instantly to Open-Meteo without freezing the page.
3. **Risk 3: Station Sensor Outages / Negative Numbers**:
   * Individual physical sensors frequently go offline for calibration or report `-999` / `null` for individual pollutants.
   * *Mitigation*: Validate the minimum CPCB data requirement (at least 3 pollutants, including $PM_{2.5}$ or $PM_{10}$) before accepting a station report as valid. If invalid, trigger the modeled fallback.

---

*No code modifications or provider changes have been made in this step. The current working dashboard, map, and US AQI implementation remain intact and operational.*