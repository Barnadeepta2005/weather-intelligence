import { Sun, CloudLightning, CloudRain, CloudSun } from 'lucide-react'
import type { WeatherIconType } from '@/lib/types'

interface WeatherIconProps {
  type: WeatherIconType
  size?: number
}

export function WeatherIcon({ type, size = 36 }: WeatherIconProps) {
  if (type === 'sun') return <Sun size={size} />
  if (type === 'storm') return <CloudLightning size={size} />
  if (type === 'rain') return <CloudRain size={size} />
  return <CloudSun size={size} />
}
