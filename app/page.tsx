import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { AtmosWeatherMark } from '@/components/weather-icons/AtmosWeatherMark'

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <div className="landing-card" role="region" aria-label="ATMOS WEATHER Welcome">
        {/* 1. ATMOS WEATHER LOGO / MARK */}
        <div className="landing-mark-wrapper" aria-hidden="true">
          <AtmosWeatherMark size={72} />
        </div>

        {/* 2. ATMOS WEATHER BRAND TITLE */}
        <h1 className="landing-title">ATMOS WEATHER</h1>

        {/* 3. BRIEF DESCRIPTION */}
        <p className="landing-desc">
          Real-time weather, air quality, radar and official weather alerts — intelligently brought together.
        </p>

        {/* 4. ONE PRIMARY BUTTON TO ENTER THE APP */}
        <Link
          href="/app"
          className="landing-enter-btn"
          id="enter-app-button"
          aria-label="Enter ATMOS WEATHER application"
        >
          <span>ENTER ATMOS WEATHER</span>
          <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </div>
    </main>
  )
}
