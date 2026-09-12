'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Development-only diagnostic logging
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Application Error Boundary caught error]:', error)
    }
  }, [error])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--bg, #f3efe6)',
        backgroundImage:
          'linear-gradient(rgba(17,17,17,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,0.035) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    >
      <div
        style={{
          maxWidth: '520px',
          width: '100%',
          background: 'var(--surface, #fffdf7)',
          border: '3px solid var(--ink, #111)',
          boxShadow: '6px 6px 0 var(--ink, #111)',
          padding: '36px 32px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              background: '#ffe5e5',
              border: '2px solid var(--ink, #111)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '2px 2px 0 var(--ink, #111)',
            }}
          >
            <AlertTriangle size={24} color="#dc2626" />
          </div>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: '10px',
                fontWeight: 900,
                letterSpacing: '0.14em',
                color: 'var(--muted, #5d5a52)',
              }}
            >
              WEATHER INTELLIGENCE / RECOVERY
            </p>
            <h1
              style={{
                margin: '2px 0 0 0',
                fontSize: '26px',
                fontWeight: 900,
                letterSpacing: '-0.04em',
                lineHeight: 1.1,
              }}
            >
              SOMETHING WENT WRONG
            </h1>
          </div>
        </div>

        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '13px',
            lineHeight: 1.5,
            color: '#333',
          }}
        >
          An unexpected application error occurred while rendering the dashboard. No corrupted data was saved.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => reset()}
            className="primary-btn"
            style={{
              margin: 0,
              height: '42px',
              padding: '0 18px',
              fontSize: '11px',
              fontWeight: 900,
              letterSpacing: '0.06em',
              background: 'var(--acid, #c9ff4a)',
              border: '2px solid var(--ink, #111)',
              boxShadow: '3px 3px 0 var(--ink, #111)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> TRY AGAIN
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/'
              }
            }}
            className="secondary-btn"
            style={{
              margin: 0,
              height: '42px',
              padding: '0 18px',
              fontSize: '11px',
              fontWeight: 900,
              letterSpacing: '0.06em',
              background: 'var(--surface, #fffdf7)',
              border: '2px solid var(--ink, #111)',
              boxShadow: '3px 3px 0 var(--ink, #111)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <Home size={14} /> RELOAD DASHBOARD
          </button>
        </div>
      </div>
    </div>
  )
}
