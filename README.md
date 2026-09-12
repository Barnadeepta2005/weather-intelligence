# Atmos — Weather Intelligence

> A precision weather intelligence dashboard built with an editorial, high-contrast neo-brutalist aesthetic and an India-first air quality engine.

---

## 1. Overview

Atmos provides real-time meteorological observations, interactive precipitation radar, and high-accuracy air quality monitoring across global cities with dedicated ground telemetry for Indian urban centers. 

The application adheres to an uncompromising **real-time data integrity** principle: live failures produce explicit, structured error states and never fabricate mock observations.

---

## 2. Technology Stack

- **Framework**: Next.js 16 (App Router, Server Route Handlers)
- **UI & State**: React 19, TypeScript 5.7
- **Styling**: Vanilla CSS custom design system (Tailwind CSS 4 utility bridge)
- **Mapping & GIS**: MapLibre GL JS v6, OpenFreeMap Positron vector tiles, Natural Earth vector boundary geometry
- **Radar**: RainViewer Weather Maps API (Raster tile pipeline)
- **Deployment**: Vercel Serverless / Edge compatible (₹0 recurring infrastructure cost)

---

## 3. Architecture

```
Client (Browser)
       │
       ▼
Next.js Server API Routes (/api/weather, /api/air-quality, /api/radar, /api/geocode, /api/reverse-geocode)
       │
       ├────────────────────────┬─────────────────────────┬────────────────────────┐
       ▼                        ▼                         ▼                        ▼
  Open-Meteo              Data.gov.in (CPCB)          RainViewer               BigDataCloud /
Weather & CAMS           Official Ground AQI        Weather Maps API             Nominatim
```

### India-First Air Quality Architecture
1. **India Ground Data**: Coordinates within India are checked against a curated registry of official Central Pollution Control Board (CPCB) CAAQMS stations within a 25 km threshold. Live telemetry is retrieved via the official Data.gov.in Open Government Data API, calculated according to the Indian National Air Quality Index (NAQI) sub-index interpolation formulas.
2. **India Labeled Fallback**: If a location in India is outside station proximity or the monitoring station is offline, the system gracefully falls back to Open-Meteo Copernicus CAMS atmospheric dispersion model, explicitly labeled as `MODELED AIR QUALITY (FALLBACK)`.
3. **International Locations**: Global cities outside India automatically receive Copernicus CAMS atmospheric dispersion modeled data, labeled as `MODELED AIR QUALITY` under the US AQI standard.

### Interactive Radar Architecture
- MapLibre GL JS raster overlay consuming live RainViewer tile timestamps.
- RainViewer free tier constraints: Past ~2 hours historical radar at 10-minute intervals + latest live frame.
- Zoom constrained strictly between 3 and 7 to prevent requesting unsupported tile levels.
- Natural Earth Admin-0 (countries) and Admin-1 (states/provinces) static vector boundaries for geopolitical context.

---

## 4. Free / Open Services Used

| Service | Purpose | License / Terms |
| :--- | :--- | :--- |
| **Open-Meteo** | Weather forecast, hourly/daily trends, UV index, Copernicus CAMS model | Non-commercial / Attribution required |
| **Data.gov.in / CPCB** | India Continuous Ambient Air Quality Monitoring Station (CAAQMS) | Government Open Data License - India (GODL) |
| **RainViewer** | Global weather radar precipitation tiles | Free tier for personal / educational use |
| **OpenFreeMap** | Base map vector tile hosting (Positron style) | OpenFreeMap / OpenStreetMap contributors |
| **Natural Earth** | Country and state/province boundary GeoJSON geometry | Public Domain |
| **BigDataCloud** | Reverse geocoding for browser geolocation | Free client-side API |
| **OSM Nominatim** | Fallback reverse geocoding | ODbL / OpenStreetMap contributors |

> **Non-Commercial / Fair Use Notice**:
> This product architecture is engineered for personal, educational, and small-scale community use under the respective free tier terms of the upstream data providers. It is **not** an unlimited commercial service. Commercial deployments require individual enterprise licensing with Open-Meteo, RainViewer, and vector tile infrastructure providers.

---

## 5. Local Development

### Prerequisites
- Node.js 18.17+ or Node.js 20+
- `pnpm` (recommended) or `npm`

### Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd weather
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   Add your Data.gov.in API key in `.env.local`:
   ```env
   DATA_GOV_IN_API_KEY=your_api_key_here
   ```
   *(If left blank, the application will automatically fall back to Open-Meteo CAMS modeled AQI for Indian locations).*

4. **Start the development server**:
   ```bash
   pnpm dev
   # or
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Type Checking & Production Build**:
   ```bash
   npx tsc --noEmit
   pnpm build
   ```

---

## 6. Vercel Deployment Readiness

- **Stateless Serverless Execution**: All server routes (`/api/weather`, `/api/air-quality`, `/api/radar`, `/api/geocode`, `/api/reverse-geocode`) execute as stateless serverless functions without persistent process dependencies or disk writes.
- **Instance-Local Caching Note**: In-memory caching for CPCB observations and geocode results operates on a **best-effort, instance-local** basis within individual serverless function container lifecycles. It does not assume a globally shared or persistent cache between cold starts or multiple concurrent regional execution instances.
- **Environment Isolation**: The only secret is `DATA_GOV_IN_API_KEY`, which is strictly server-side and never prefixed with `NEXT_PUBLIC_`, ensuring zero credential leakage into client JavaScript bundles.
- **Relative Path Calls**: All client data fetches use relative API routes (e.g. `/api/weather`), eliminating any dependency on hardcoded localhost URLs.
- **MapLibre Dynamic Import**: MapLibre GL JS and WebGL rendering pipelines are client-side only and guarded against Node.js server-side rendering (SSR) execution.

---

## 7. Known Limitations

1. **RainViewer Tile Zoom Ceiling**: The free RainViewer precipitation tile service is capped at zoom level 7. MapLibre is explicitly constrained with `maxZoom: 7` on the radar map to prevent requesting unsupported tiles (which return error tiles).
2. **Browser Geolocation in Non-HTTPS**: Modern web browsers restrict `navigator.geolocation` strictly to HTTPS origins (or `localhost`). If deployed to HTTP or an untrusted IP, geolocation will trigger a neo-brutalist advisory notice instructing the user to use HTTPS or search manually.
3. **Windows Geolocation Service (lfsvc)**: On Windows desktop environments, desktop browser geolocation may time out if the underlying Windows Location Service (`lfsvc`) is disabled in Windows Settings > Privacy & security > Location. The app handles this with a dedicated diagnostic warning.
4. **CPCB Station Radius**: Official CPCB ground station air quality telemetry requires the target location to be within 25 km of an active CAAQMS ground monitor in India. Locations beyond this radius or during station outages gracefully fall back to the Copernicus CAMS atmospheric model with an explicit `STATION DATA UNAVAILABLE` badge.
5. **Non-Commercial Fair Use Limits**: Upstream providers (Open-Meteo, RainViewer, Data.gov.in) enforce rate limits on free tiers (e.g. 10,000 calls/day on Open-Meteo). This software is designed for personal and educational use; high-traffic commercial operations require paid enterprise keys.

