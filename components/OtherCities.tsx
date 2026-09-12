import { ChevronRight, Plus } from 'lucide-react'
import { WeatherIcon } from '@/components/WeatherIcon'
import type { CityWeather } from '@/lib/types'

interface OtherCitiesProps {
  cities: CityWeather[]
  onSelectCity?: (city: string) => void
  onAddLocation?: () => void
}

export function OtherCities({ cities, onSelectCity, onAddLocation }: OtherCitiesProps) {
  return (
    <section className="places-section wide-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">MY LOCATIONS</p>
          <h2>Other cities</h2>
        </div>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            const savedSection = document.querySelector('.saved-locations')
            savedSection?.scrollIntoView({ behavior: 'smooth' })
          }}
        >
          MANAGE <ChevronRight size={14} />
        </button>
      </div>
      <div className="city-row">
        {cities.map((city, index) => (
          <div
            className={`city-card ${city.colorClass}`}
            key={`other-city-${city.city.toLowerCase()}-${city.country.toLowerCase()}-${index}`}
            onClick={() => onSelectCity?.(city.city)}
            style={{ cursor: onSelectCity ? 'pointer' : 'default' }}
            role={onSelectCity ? 'button' : undefined}
            tabIndex={onSelectCity ? 0 : undefined}
          >
            <div>
              <span className="city-country">{city.country}</span>
              <h3>{city.city}</h3>
              <p>{city.description}</p>
            </div>
            <WeatherIcon type={city.iconType} size={32} />
            <strong>{city.temperature}</strong>
          </div>
        ))}
        <button
          type="button"
          className="add-city"
          onClick={onAddLocation}
          aria-label="Search and add a location"
        >
          <Plus size={20} />
          <span>ADD LOCATION</span>
        </button>
      </div>
    </section>
  )
}
