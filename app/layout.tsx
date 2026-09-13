import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import 'maplibre-gl/dist/maplibre-gl.css'
import './globals.css'
import { PWAProvider } from '@/components/PWAProvider'

export const metadata: Metadata = {
  title: 'Weather Intelligence',
  description: 'Intelligent weather, air quality, radar and alerts.',
  applicationName: 'Weather Intelligence',
  manifest: '/manifest.webmanifest',
  generator: 'Weather Intelligence',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Weather Intelligence',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    apple: [
      {
        url: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: [{ color: '#f3efe6' }],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PWAProvider>{children}</PWAProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
