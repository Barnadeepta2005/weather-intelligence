'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Root Global Error Boundary]:', error)
    }
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#f3efe6',
          fontFamily: 'Arial, Helvetica, sans-serif',
          color: '#111',
        }}
      >
        <div
          style={{
            maxWidth: '500px',
            width: '100%',
            background: '#fffdf7',
            border: '3px solid #111',
            boxShadow: '6px 6px 0 #111',
            padding: '32px',
          }}
        >
          <p
            style={{
              margin: '0 0 4px 0',
              fontSize: '10px',
              fontWeight: 900,
              letterSpacing: '0.14em',
              color: '#5d5a52',
            }}
          >
            ATMOS WEATHER / ROOT RECOVERY
          </p>
          <h1
            style={{
              margin: '0 0 16px 0',
              fontSize: '28px',
              fontWeight: 900,
              letterSpacing: '-0.04em',
            }}
          >
            SOMETHING WENT WRONG
          </h1>
          <p
            style={{
              margin: '0 0 24px 0',
              fontSize: '13px',
              lineHeight: 1.5,
              color: '#333',
            }}
          >
            A critical rendering failure occurred. Please retry or reload the page.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              height: '42px',
              padding: '0 20px',
              fontSize: '11px',
              fontWeight: 900,
              letterSpacing: '0.06em',
              background: '#c9ff4a',
              border: '2px solid #111',
              boxShadow: '3px 3px 0 #111',
              cursor: 'pointer',
            }}
          >
            TRY AGAIN
          </button>
        </div>
      </body>
    </html>
  )
}
