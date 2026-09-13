import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import 'maplibre-gl/dist/maplibre-gl.css'
import './globals.css'
import { PWAProvider } from '@/components/PWAProvider'

export const metadata: Metadata = {
  title: 'ATMOS WEATHER',
  description: 'Real-time weather, air quality, radar and official weather alerts — intelligently brought together.',
  applicationName: 'ATMOS WEATHER',
  manifest: '/manifest.webmanifest',
  generator: 'ATMOS WEATHER',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ATMOS WEATHER',
  },
  openGraph: {
    title: 'ATMOS WEATHER',
    description: 'Real-time weather, air quality, radar and official weather alerts — intelligently brought together.',
    siteName: 'ATMOS WEATHER',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'ATMOS WEATHER',
    description: 'Real-time weather, air quality, radar and official weather alerts — intelligently brought together.',
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
