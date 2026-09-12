'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Pause, Play, AlertTriangle, RefreshCw } from 'lucide-react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

type MapLibreMap = maplibregl.Map
type MapLibreMarker = maplibregl.Marker
import { Panel } from '@/components/Panel'
import { getRadarTileUrl, type RadarMetadata, type RadarFrame } from '@/lib/rainviewer'

interface RadarCardProps {
  latitude?: number
  longitude?: number
  cityName?: string
  timezone?: string
}

// Light editorial vector base map style from OpenFreeMap (₹0, no API key required)
const OPENFREEMAP_POSITRON_STYLE = 'https://tiles.openfreemap.org/styles/positron'

// Ensure MapLibre Web Worker is loaded from local static path in Next.js
if (typeof window !== 'undefined') {
  maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')
}

// Development-only diagnostic logging guards (zero overhead / no-ops in production)
const isDev = process.env.NODE_ENV !== 'production'
const devLog = (...args: any[]) => {
  if (isDev) console.log(...args)
}
const devWarn = (...args: any[]) => {
  if (isDev) console.warn(...args)
}
const devError = (...args: any[]) => {
  if (isDev) console.error(...args)
}

export function RadarCard({
  latitude = 22.5726,
  longitude = 88.3639,
  cityName = 'KOLKATA',
  timezone,
}: RadarCardProps) {
  const [metadata, setMetadata] = useState<RadarMetadata | null>(null)
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(-1)
  const [playing, setPlaying] = useState<boolean>(false)
  const [layer, setLayer] = useState<string>('RADAR')
  const [loadingRadar, setLoadingRadar] = useState<boolean>(true)
  const [radarError, setRadarError] = useState<string | null>(null)

  const [mapLoaded, setMapLoaded] = useState<boolean>(false)
  const [mapError, setMapError] = useState<string | null>(null)

  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<MapLibreMarker | null>(null)
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initial coordinates ref so map mounts once without recreating on every coordinate update
  const initialCoordsRef = useRef({ latitude, longitude })

  // Lifecycle & Diagnostics
  useEffect(() => {
    devLog('[RADAR DIAG] RADAR COMPONENT MOUNT')
  }, [])

  // WebGL support helper
  const checkWebGL = useCallback(() => {
    if (typeof window === 'undefined') return false
    try {
      const canvas = document.createElement('canvas')
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      )
    } catch {
      return false
    }
  }, [])

  // Fetch RainViewer metadata
  const fetchRadarMetadata = useCallback(async () => {
    setLoadingRadar(true)
    setRadarError(null)
    devLog('[RADAR DIAG] RADAR METADATA REQUEST START')

    try {
      const query = timezone ? `?timezone=${encodeURIComponent(timezone)}` : ''
      const res = await fetch(`/api/radar${query}`)
      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        throw new Error(errJson?.error || `Radar service error (HTTP ${res.status})`)
      }

      const data: RadarMetadata = await res.json()
      if (!data || !Array.isArray(data.frames) || data.frames.length === 0) {
        throw new Error('No radar imagery available')
      }

      devLog('[RADAR DIAG] RADAR METADATA SUCCESS, frame count:', data.frames.length)
      setMetadata(data)
      // Default to the latest available frame
      setActiveFrameIndex(data.frames.length - 1)
      setLoadingRadar(false)
    } catch (err: any) {
      devError('[RADAR DIAG] Radar metadata error:', err)
      setRadarError(err?.message || 'Precipitation radar could not be loaded.')
      setLoadingRadar(false)
    }
  }, [timezone])

  useEffect(() => {
    fetchRadarMetadata()
  }, [fetchRadarMetadata])

  // Initialize MapLibre GL Map (Client-only with container dimension verification)
  useEffect(() => {
    const container = mapContainerRef.current
    if (!container || mapRef.current) return

    if (!checkWebGL()) {
      devError('[RADAR DIAG] WebGL is not available')
      setMapError('MAP RENDERING UNAVAILABLE: WebGL is not supported by your browser.')
      return
    }

    let cancelled = false
    let mapInstance: maplibregl.Map | null = null
    let resizeObserver: ResizeObserver | null = null
    let timeoutGuard: NodeJS.Timeout | null = null

    const initMap = () => {
      if (cancelled || mapRef.current) return

      const clientW = container.clientWidth
      const clientH = container.clientHeight
      devLog('[RADAR DIAG] MAP CONTAINER SIZE:', clientW, clientH)

      if (clientW === 0 || clientH === 0) {
        devWarn('[RADAR DIAG] Map container size is 0, waiting for layout...')
        return
      }

      try {
        devLog('[RADAR DIAG] MAP CONSTRUCTOR START')
        devLog('[RADAR DIAG] MAP STYLE LOAD START:', OPENFREEMAP_POSITRON_STYLE)

        // Strictly limit maxZoom to 7 to ensure RainViewer never requests unsupported z >= 8 tiles
        const map = new maplibregl.Map({
          container: container,
          style: OPENFREEMAP_POSITRON_STYLE,
          center: [initialCoordsRef.current.longitude, initialCoordsRef.current.latitude],
          zoom: 6,
          minZoom: 3,
          maxZoom: 7,
          attributionControl: false,
          trackResize: true,
        })

        mapInstance = map
        mapRef.current = map
        if (isDev && typeof window !== 'undefined') {
          ;(window as any).__radarMap = map
        }
        devLog('[RADAR DIAG] MAP CONSTRUCTOR SUCCESS')

        const enhanceGeographicContext = () => {
          try {
            // 1. Country boundaries: slightly stronger, high-contrast editorial lines
            if (map.getLayer('boundary_2')) {
              map.setPaintProperty('boundary_2', 'line-color', '#333333')
              map.setPaintProperty('boundary_2', 'line-width', [
                'interpolate', ['linear'], ['zoom'],
                3, 1.4,
                5, 1.8,
                7, 2.4,
              ])
              map.setPaintProperty('boundary_2', 'line-opacity', 0.85)
            }

            // 2. State/province administrative boundaries: lighter line, visible at zoom 4-7
            if (map.getLayer('boundary_3')) {
              map.setLayerZoomRange('boundary_3', 4, 24)
              map.setPaintProperty('boundary_3', 'line-color', '#6b7280')
              map.setPaintProperty('boundary_3', 'line-dasharray', [3, 2])
              map.setPaintProperty('boundary_3', 'line-width', [
                'interpolate', ['linear'], ['zoom'],
                4, 0.8,
                6, 1.2,
                8, 1.6,
              ])
              map.setPaintProperty('boundary_3', 'line-opacity', 0.75)
            }

            // 3. City / Town / Place labels: crisp contrast with protective halo
            const labelLayers = [
              'label_city',
              'label_city_capital',
              'label_town',
              'label_state',
              'label_country_1',
              'label_country_2',
              'label_country_3',
            ]
            for (const layerId of labelLayers) {
              if (map.getLayer(layerId)) {
                map.setPaintProperty(layerId, 'text-color', '#111111')
                map.setPaintProperty(layerId, 'text-halo-color', 'rgba(255, 255, 255, 0.95)')
                map.setPaintProperty(layerId, 'text-halo-width', 2.0)
              }
            }

            // Enable major towns / localities at zoom 5+
            if (map.getLayer('label_town')) {
              map.setLayerZoomRange('label_town', 5, 24)
            }
            if (map.getLayer('label_other')) {
              map.setLayerZoomRange('label_other', 6.2, 24)
              map.setPaintProperty('label_other', 'text-color', '#222222')
              map.setPaintProperty('label_other', 'text-halo-color', 'rgba(255, 255, 255, 0.92)')
              map.setPaintProperty('label_other', 'text-halo-width', 1.6)
            }

            // 4. Coastlines / water boundary definition
            if (map.getLayer('water')) {
              map.setPaintProperty('water', 'fill-color', '#c8d6dc')
            }
          } catch (e) {
            devWarn('[RADAR DIAG] Style enhancement notice:', e)
          }
        }

        const setupNaturalEarthBoundaries = () => {
          try {
            const style = map.getStyle()
            if (!style || !style.layers || style.layers.length === 0) return

            // Insertion anchor: before first text/label layer so labels stay on top
            const firstLabelLayerId = map.getLayer('label_other')
              ? 'label_other'
              : (map.getLayer('label_town')
                ? 'label_town'
                : (map.getLayer('label_city') ? 'label_city' : undefined))

            // 1. Static Country Boundaries (Natural Earth Admin 0)
            if (!map.getSource('country-boundaries')) {
              map.addSource('country-boundaries', {
                type: 'geojson',
                data: '/maps/countries.geojson',
              })
              devLog('[RADAR DIAG] country-boundaries source added')
            }

            // 2. Static State / Province Boundaries (Natural Earth Admin 1)
            if (!map.getSource('state-boundaries')) {
              map.addSource('state-boundaries', {
                type: 'geojson',
                data: '/maps/states.geojson',
              })
              devLog('[RADAR DIAG] state-boundaries source added')
            }

            // Add state boundary layer
            if (!map.getLayer('state-boundary-layer')) {
              map.addLayer(
                {
                  id: 'state-boundary-layer',
                  type: 'line',
                  source: 'state-boundaries',
                  minzoom: 3.5,
                  maxzoom: 24,
                  paint: {
                    'line-color': '#6B7280',
                    'line-width': [
                      'interpolate', ['linear'], ['zoom'],
                      4, 0.9,
                      6, 1.3,
                      7, 1.6,
                    ],
                    'line-opacity': 0.70,
                    'line-dasharray': [3, 2],
                  },
                  layout: {
                    'line-cap': 'round',
                    'line-join': 'round',
                  },
                },
                firstLabelLayerId
              )
              devLog('[RADAR DIAG] state-boundary-layer added before:', firstLabelLayerId)
            }

            // Add country boundary layer (sits above state boundaries, below labels)
            if (!map.getLayer('country-boundary-layer')) {
              map.addLayer(
                {
                  id: 'country-boundary-layer',
                  type: 'line',
                  source: 'country-boundaries',
                  minzoom: 0,
                  maxzoom: 24,
                  paint: {
                    'line-color': '#2A2A2A',
                    'line-width': [
                      'interpolate', ['linear'], ['zoom'],
                      3, 1.4,
                      5, 1.8,
                      7, 2.2,
                    ],
                    'line-opacity': 0.85,
                  },
                  layout: {
                    'line-cap': 'round',
                    'line-join': 'round',
                  },
                },
                firstLabelLayerId
              )
              devLog('[RADAR DIAG] country-boundary-layer added before:', firstLabelLayerId)
            }
          } catch (err) {
            devWarn('[RADAR DIAG] Natural Earth boundary setup warning:', err)
          }
        }

        const handleReady = () => {
          if (!container.isConnected || mapRef.current !== map) return
          devLog('[RADAR DIAG] MAP READY -> setting mapLoaded=true')
          enhanceGeographicContext()
          setupNaturalEarthBoundaries()
          setMapLoaded(true)
          setMapError(null)
          map.resize()
        }

        map.on('style.load', () => {
          devLog('[RADAR DIAG] MAP STYLE LOAD SUCCESS')
          handleReady()
        })

        map.on('load', () => {
          devLog('[RADAR DIAG] MAP LOAD EVENT')
          handleReady()
        })

        map.on('error', (e) => {
          devError('[RADAR DIAG] MAP ERROR EVENT:', e)
          const errMsg = e?.error?.message || ''
          const status = (e as any)?.status
          if (errMsg.includes('style') || errMsg.includes('Failed to fetch') || status >= 400) {
            devError('[RADAR DIAG] Failing style/source URL or status:', errMsg, status)
            setMapError('Base map style could not be loaded.')
          }
        })

        // 7. Timeout guard: never spin infinitely
        timeoutGuard = setTimeout(() => {
          if (!container.isConnected || mapRef.current !== map) return
          if (!map.isStyleLoaded() && !map.loaded()) {
            devWarn('[RADAR DIAG] Map loading timeout exceeded (7s)')
            setMapError('MAP LOAD FAILED: Base map request timed out. Please retry.')
          } else {
            handleReady()
          }
        }, 7000)

        // Custom neo-brutalist location marker with city badge
        const markerEl = document.createElement('div')
        markerEl.className = 'radar-custom-marker-wrapper'
        markerEl.setAttribute('aria-label', `Selected location: ${cityName}`)
        markerEl.innerHTML = `
          <div style="display:flex; flex-direction:column; align-items:center; transform:translate(0, -50%); cursor:pointer;">
            <span class="radar-marker-label" style="
              background: var(--ink, #111);
              color: #fff;
              font-family: inherit;
              font-size: 9px;
              font-weight: 900;
              letter-spacing: 0.08em;
              padding: 2px 7px;
              border: 1.5px solid var(--ink, #111);
              box-shadow: 2px 2px 0 rgba(0,0,0,0.25);
              white-space: nowrap;
              margin-bottom: 4px;
              text-transform: uppercase;
            ">
              ${cityName}
            </span>
            <div class="radar-custom-marker" style="margin: 0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          </div>
        `

        const marker = new maplibregl.Marker({ element: markerEl, anchor: 'center' })
          .setLngLat([initialCoordsRef.current.longitude, initialCoordsRef.current.latitude])
          .addTo(map)

        markerRef.current = marker

        // Watch container size changes and keep MapLibre canvas in sync
        resizeObserver = new ResizeObserver(() => {
          if (mapRef.current) {
            mapRef.current.resize()
          }
        })
        resizeObserver.observe(container)

        // Force initial resize after layout pass
        requestAnimationFrame(() => {
          map.resize()
        })
      } catch (err: any) {
        devError('[RADAR DIAG] MapLibre init error:', err)
        setMapError(err?.message || 'MapLibre failed to initialize.')
      }
    }

    // Verify container has real computed dimensions before initializing
    if (container.clientHeight > 0 && container.clientWidth > 0) {
      initMap()
    } else {
      const initialObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.height > 0 && entry.contentRect.width > 0) {
            initialObserver.disconnect()
            initMap()
            break
          }
        }
      })
      initialObserver.observe(container)

      return () => {
        cancelled = true
        if (timeoutGuard) clearTimeout(timeoutGuard)
        initialObserver.disconnect()
        if (resizeObserver) resizeObserver.disconnect()
        if (markerRef.current) {
          markerRef.current.remove()
          markerRef.current = null
        }
        if (mapRef.current) {
          mapRef.current.remove()
          mapRef.current = null
        }
      }
    }

    return () => {
      cancelled = true
      if (timeoutGuard) clearTimeout(timeoutGuard)
      if (resizeObserver) resizeObserver.disconnect()
      if (markerRef.current) {
        markerRef.current.remove()
        markerRef.current = null
      }
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [checkWebGL])

  // Update map center and marker when latitude/longitude/cityName change
  useEffect(() => {
    if (!mapRef.current) return

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    mapRef.current.flyTo({
      center: [longitude, latitude],
      zoom: 6,
      essential: true,
      duration: prefersReducedMotion ? 0 : 900,
    })

    if (markerRef.current) {
      markerRef.current.setLngLat([longitude, latitude])
      const badge = markerRef.current.getElement()?.querySelector('.radar-marker-label')
      if (badge) {
        badge.textContent = cityName.toUpperCase()
      }
    }
  }, [latitude, longitude, cityName])

  // Update RainViewer radar tile overlay when map is loaded, metadata arrives, or frame changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapLoaded || !metadata || activeFrameIndex < 0) return

    const activeFrame = metadata.frames[activeFrameIndex]
    if (!activeFrame) return

    const applyRadarLayer = () => {
      try {
        const style = map.getStyle()
        if (!style || !style.layers || style.layers.length === 0) {
          devLog('[RADAR DIAG] Waiting for style to load before applying radar layer...')
          map.once('style.load', applyRadarLayer)
          map.once('styledata', applyRadarLayer)
          return
        }

        const tileUrl = getRadarTileUrl(metadata.host, activeFrame.path, 256, 2)
        devLog('[RADAR DIAG] RADAR FRAME COUNT:', metadata.frames.length)
        devLog('[RADAR DIAG] RADAR TILE SOURCE URL:', tileUrl)

        const sourceId = 'rainviewer-radar-source'
        const layerId = 'rainviewer-radar-layer'

        if (map.getLayer(layerId)) {
          map.removeLayer(layerId)
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId)
        }

        // Hard maxzoom constraint of 7 for RainViewer free tile service
        map.addSource(sourceId, {
          type: 'raster',
          tiles: [tileUrl],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 7,
        })
        // Ensure static Natural Earth boundary sources and layers are present
        if (!map.getSource('country-boundaries') || !map.getLayer('country-boundary-layer')) {
          if (!map.getSource('country-boundaries')) {
            map.addSource('country-boundaries', {
              type: 'geojson',
              data: '/maps/countries.geojson',
            })
          }
          if (!map.getSource('state-boundaries')) {
            map.addSource('state-boundaries', {
              type: 'geojson',
              data: '/maps/states.geojson',
            })
          }
          const firstLabel = map.getLayer('label_other') ? 'label_other' : (map.getLayer('label_town') ? 'label_town' : undefined)
          if (!map.getLayer('state-boundary-layer')) {
            map.addLayer({
              id: 'state-boundary-layer',
              type: 'line',
              source: 'state-boundaries',
              minzoom: 3.5,
              maxzoom: 24,
              paint: {
                'line-color': '#6B7280',
                'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.9, 6, 1.3, 7, 1.6],
                'line-opacity': 0.70,
                'line-dasharray': [3, 2],
              },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            }, firstLabel)
          }
          if (!map.getLayer('country-boundary-layer')) {
            map.addLayer({
              id: 'country-boundary-layer',
              type: 'line',
              source: 'country-boundaries',
              minzoom: 0,
              maxzoom: 24,
              paint: {
                'line-color': '#2A2A2A',
                'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.4, 5, 1.8, 7, 2.2],
                'line-opacity': 0.85,
              },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            }, firstLabel)
          }
        }

        // Layer order: Base Map -> Radar -> State Boundaries -> Country Boundaries -> Labels -> Marker
        // Inserting before 'state-boundary-layer' places radar directly under boundary lines and labels!
        const beforeLayerId = map.getLayer('state-boundary-layer')
          ? 'state-boundary-layer'
          : (map.getLayer('country-boundary-layer')
            ? 'country-boundary-layer'
            : (map.getLayer('label_other')
              ? 'label_other'
              : (map.getLayer('label_town') ? 'label_town' : undefined)))

        map.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          paint: {
            'raster-opacity': layer === 'PRECIPITATION' ? 0.80 : 0.68,
            'raster-fade-duration': 80,
          },
        }, beforeLayerId)
        devLog('[RADAR DIAG] RADAR LAYER ADDED (placed before:', beforeLayerId, ')')
      } catch (err) {
        devError('[RADAR DIAG] RADAR LAYER ERROR:', err)
      }
    }

    applyRadarLayer()
  }, [mapLoaded, metadata, activeFrameIndex, layer])

  // Timeline Playback loop (respects prefers-reduced-motion)
  useEffect(() => {
    if (!playing || !metadata || metadata.frames.length <= 1) {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current)
      return
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      setPlaying(false)
      return
    }

    const interval = setInterval(() => {
      setActiveFrameIndex((prevIndex) => {
        if (prevIndex >= metadata.frames.length - 1) {
          setPlaying(false)
          return metadata.frames.length - 1
        }
        return prevIndex + 1
      })
    }, 700)

    playIntervalRef.current = interval

    return () => {
      clearInterval(interval)
    }
  }, [playing, metadata])

  const handleRecenter = () => {
    if (!mapRef.current) return
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    mapRef.current.flyTo({
      center: [longitude, latitude],
      zoom: 6,
      essential: true,
      duration: prefersReducedMotion ? 0 : 800,
    })
  }

  const handleZoomIn = () => {
    if (!mapRef.current) return
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const currentZoom = mapRef.current.getZoom()
    if (currentZoom < 7) {
      mapRef.current.zoomTo(Math.min(7, Math.round(currentZoom + 1)), {
        duration: prefersReducedMotion ? 0 : 250,
      })
    }
  }

  const handleZoomOut = () => {
    if (!mapRef.current) return
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const currentZoom = mapRef.current.getZoom()
    if (currentZoom > 3) {
      mapRef.current.zoomTo(Math.max(3, Math.round(currentZoom - 1)), {
        duration: prefersReducedMotion ? 0 : 250,
      })
    }
  }

  const togglePlayback = () => {
    if (!metadata || metadata.frames.length === 0) return

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      // Advance single frame on reduced motion rather than fast looping animation
      setActiveFrameIndex((prevIndex) => (prevIndex + 1) % metadata.frames.length)
      return
    }

    if (playing) {
      setPlaying(false)
    } else {
      if (activeFrameIndex >= metadata.frames.length - 1) {
        setActiveFrameIndex(0)
      }
      setPlaying(true)
    }
  }

  const activeFrame: RadarFrame | undefined = metadata?.frames[activeFrameIndex]
  const timelineProgress =
    metadata && metadata.frames.length > 1 && activeFrameIndex >= 0
      ? (activeFrameIndex / (metadata.frames.length - 1)) * 100
      : 100

  return (
    <Panel className="radar-card">
      <div className="section-heading radar-heading">
        <div>
          <p className="eyebrow">LIVE PRECIPITATION / RADAR</p>
          <h2>{cityName.toUpperCase()} RADAR</h2>
        </div>
        <div className="layer-tabs">
          {['RADAR', 'PRECIPITATION'].map((item) => (
            <button
              type="button"
              className={layer === item ? 'selected' : ''}
              onClick={() => setLayer(item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="radar-map" style={{ position: 'relative' }}>
        {/* MAPLIBRE GL CANVAS CONTAINER */}
        <div
          ref={mapContainerRef}
          className="radar-map-canvas"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />

        {/* MAP INITIALIZATION LOADING SKELETON */}
        {!mapLoaded && !mapError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              background: '#e2f4f5',
              zIndex: 5,
              fontSize: '11px',
              fontWeight: 900,
              letterSpacing: '0.08em',
              color: 'var(--ink)',
            }}
          >
            <RefreshCw size={20} className="animate-spin" />
            <span>INITIALIZING RADAR MAP...</span>
          </div>
        )}

        {/* MAP STYLE ERROR BANNER (BASE MAP FALLBACK) */}
        {mapError && (
          <div
            style={{
              position: 'absolute',
              inset: '20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              background: '#fff3f3',
              border: '2.5px solid var(--ink)',
              boxShadow: '4px 4px 0 var(--ink)',
              zIndex: 15,
              padding: '24px',
              textAlign: 'center',
            }}
          >
            <AlertTriangle size={28} color="#dc2626" />
            <strong style={{ fontSize: '13px', letterSpacing: '0.05em' }}>
              MAP UNAVAILABLE
            </strong>
            <p style={{ margin: 0, fontSize: '11px', color: '#555', maxWidth: '320px', lineHeight: 1.4 }}>
              The interactive base map could not be loaded. Please check your connection and retry.
            </p>
            <button
              type="button"
              onClick={() => {
                setMapError(null)
                if (mapRef.current) {
                  mapRef.current.setStyle(OPENFREEMAP_POSITRON_STYLE)
                }
              }}
              className="primary-btn"
              style={{
                fontSize: '11px',
                height: '32px',
                padding: '0 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '6px',
              }}
            >
              <RefreshCw size={13} /> RETRY MAP
            </button>
          </div>
        )}

        {/* MAP CONTROLS */}
        <div className="map-controls" style={{ zIndex: 10 }}>
          <button type="button" onClick={handleZoomIn} aria-label="Zoom in (Max level 7)" title="Zoom in (Max zoom 7)">
            +
          </button>
          <button type="button" onClick={handleZoomOut} aria-label="Zoom out" title="Zoom out">
            −
          </button>
          <button type="button" className="recenter" onClick={handleRecenter} aria-label="Recenter map">
            RECENTER
          </button>
        </div>

        {/* RADAR ERROR BANNER IF API FAILED */}
        {radarError && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              maxWidth: '320px',
              background: '#ffe5e5',
              border: '2px solid var(--ink)',
              boxShadow: '3px 3px 0 var(--ink)',
              padding: '12px 14px',
              zIndex: 10,
              fontSize: '11px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626', fontWeight: 900 }}>
              <AlertTriangle size={15} />
              <span>RADAR UNAVAILABLE</span>
            </div>
            <p style={{ margin: '4px 0 8px 0', fontSize: '10px', color: '#444' }}>
              Precipitation radar could not be loaded.
            </p>
            <button
              type="button"
              onClick={fetchRadarMetadata}
              className="primary-btn"
              style={{
                fontSize: '10px',
                height: '28px',
                padding: '0 10px',
                marginTop: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RefreshCw size={12} /> RETRY
            </button>
          </div>
        )}

        {/* LIMITED COVERAGE NOTICE IF METADATA EMPTY */}
        {metadata && metadata.frames.length === 0 && !radarError && (
          <div
            style={{
              position: 'absolute',
              top: '16px',
              left: '16px',
              maxWidth: '320px',
              background: '#fff9db',
              border: '2px solid var(--ink)',
              boxShadow: '3px 3px 0 var(--ink)',
              padding: '12px 14px',
              zIndex: 10,
              fontSize: '11px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#854d0e', fontWeight: 900 }}>
              <AlertTriangle size={15} />
              <span>RADAR COVERAGE LIMITED</span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '10px', color: '#444' }}>
              Radar data is not available for this area right now.
            </p>
          </div>
        )}

        {/* RADAR TIMELINE CONTROLLER */}
        {metadata && metadata.frames.length > 0 && !radarError && (
          <div className="radar-timeline" style={{ zIndex: 10 }}>
            <button
              type="button"
              onClick={togglePlayback}
              aria-label={playing ? 'Pause radar animation' : 'Play radar animation'}
            >
              {playing ? <Pause size={13} /> : <Play size={13} />}
            </button>
            <span style={{ minWidth: '42px', fontSize: '10px', fontWeight: 900 }}>
              {metadata.frames[0]?.timeFormatted}
            </span>

            {/* INTERACTIVE TIMELINE SCRUBBER */}
            <div
              className="timeline"
              style={{ cursor: 'pointer', height: '18px', display: 'flex', alignItems: 'center' }}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                const nextIndex = Math.round(ratio * (metadata.frames.length - 1))
                setActiveFrameIndex(nextIndex)
              }}
            >
              <div style={{ width: '100%', height: '5px', background: '#d6d0c2', position: 'relative' }}>
                <i style={{ width: `${timelineProgress}%` }} />
              </div>
            </div>

            <span style={{ minWidth: '55px', textAlign: 'right', fontSize: '10px', fontWeight: 900 }}>
              {activeFrame?.isLatest ? 'LIVE' : activeFrame?.timeFormatted}
            </span>
          </div>
        )}
      </div>

      {/* FOOTER & ATTRIBUTION */}
      <div className="source-note">
        <span>
          WEATHER DATA BY{' '}
          <a
            href="https://www.rainviewer.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'underline', color: 'inherit' }}
          >
            RAINVIEWER
          </a>{' '}
          ·{' '}
          <a
            href="https://openfreemap.org"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'underline', color: 'inherit' }}
          >
            OPENFREEMAP
          </a>{' '}
          ©{' '}
          <a
            href="https://openmaptiles.org"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'underline', color: 'inherit' }}
          >
            OPENMAPTILES
          </a>{' '}
          / <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'underline', color: 'inherit' }}
          >
            OPENSTREETMAP
          </a>{' '}
          · BOUNDARIES BY{' '}
          <a
            href="https://www.naturalearthdata.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'underline', color: 'inherit' }}
          >
            NATURAL EARTH
          </a>
        </span>
        <span>
          {metadata && metadata.frames.length > 0
            ? `UPDATED ${metadata.updatedAgoMinutes} MIN AGO`
            : loadingRadar
            ? 'SYNCING RADAR...'
            : 'RADAR COVERAGE LIMITED'}
        </span>
      </div>
    </Panel>
  )
}
