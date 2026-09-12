/**
 * Central Pollution Control Board (CPCB) Station Registry & Geodetic Distance Matching.
 *
 * Provides verified Continuous Ambient Air Quality Monitoring Station (CAAQMS) coordinates
 * across Indian cities, paired with exact station identifiers from the official Data.gov.in feed.
 */

export interface CPCBStationInfo {
  station: string
  city: string
  state: string
  latitude: number
  longitude: number
}

export interface StationMatch {
  station: CPCBStationInfo
  distanceKm: number
}

/** Configurable proximity threshold in kilometers (default: 25 km) */
export const DEFAULT_PROXIMITY_THRESHOLD_KM = 25

/**
 * Great-circle distance between two geocoordinates using the Haversine formula.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Number((R * c).toFixed(2))
}

/**
 * Curated registry of official CAAQMS stations from the Data.gov.in CPCB dataset.
 * Station strings match the exact naming used by the government API.
 */
export const CPCB_STATIONS: CPCBStationInfo[] = [
  // Kolkata (West Bengal)
  { station: 'Victoria, Kolkata - WBPCB', city: 'Kolkata', state: 'West Bengal', latitude: 22.5448082, longitude: 88.3403691 },
  { station: 'Ballygunge, Kolkata - WBPCB', city: 'Kolkata', state: 'West Bengal', latitude: 22.5367507, longitude: 88.3638022 },
  { station: 'Fort William, Kolkata - WBPCB', city: 'Kolkata', state: 'West Bengal', latitude: 22.55664, longitude: 88.342674 },
  { station: 'Rabindra Sarobar, Kolkata - WBPCB', city: 'Kolkata', state: 'West Bengal', latitude: 22.51106, longitude: 88.35142 },
  { station: 'Rabindra Bharati University, Kolkata - WBPCB', city: 'Kolkata', state: 'West Bengal', latitude: 22.627847, longitude: 88.380669 },
  { station: 'Jadavpur, Kolkata - WBPCB', city: 'Kolkata', state: 'West Bengal', latitude: 22.49927, longitude: 88.3715 },
  { station: 'Bidhannagar, Kolkata - WBPCB', city: 'Kolkata', state: 'West Bengal', latitude: 22.5815, longitude: 88.4107 },
  { station: 'Belur Math, Howrah - WBPCB', city: 'Howrah', state: 'West Bengal', latitude: 22.6288, longitude: 88.3582 },
  { station: 'Ghusuri, Howrah - WBPCB', city: 'Howrah', state: 'West Bengal', latitude: 22.6053, longitude: 88.3491 },

  // Delhi (National Capital Region)
  { station: 'Major Dhyan Chand National Stadium, Delhi - DPCC', city: 'Delhi', state: 'Delhi', latitude: 28.611281, longitude: 77.237738 },
  { station: 'Mandir Marg, Delhi - DPCC', city: 'Delhi', state: 'Delhi', latitude: 28.636429, longitude: 77.201067 },
  { station: 'ITO, Delhi - CPCB', city: 'Delhi', state: 'Delhi', latitude: 28.631694, longitude: 77.249439 },
  { station: 'Lodhi Road, Delhi - IITM', city: 'Delhi', state: 'Delhi', latitude: 28.591828, longitude: 77.227306 },
  { station: 'R K Puram, Delhi - DPCC', city: 'Delhi', state: 'Delhi', latitude: 28.563262, longitude: 77.186937 },
  { station: 'Anand Vihar, Delhi - DPCC', city: 'Delhi', state: 'Delhi', latitude: 28.647622, longitude: 77.315802 },
  { station: 'Punjabi Bagh, Delhi - DPCC', city: 'Delhi', state: 'Delhi', latitude: 28.674045, longitude: 77.131023 },
  { station: 'Narela, Delhi - DPCC', city: 'Delhi', state: 'Delhi', latitude: 28.822836, longitude: 77.101981 },
  { station: 'DTU, Delhi - CPCB', city: 'Delhi', state: 'Delhi', latitude: 28.7500499, longitude: 77.1112615 },
  { station: 'Dwarka-Sector 8, Delhi - DPCC ', city: 'Delhi', state: 'Delhi', latitude: 28.5710274, longitude: 77.0719006 },
  { station: 'Cantonment Area, Delhi - DPCC', city: 'Delhi', state: 'Delhi', latitude: 28.594169, longitude: 77.1251 },

  // Mumbai (Maharashtra)
  { station: 'Kurla, Mumbai - MPCB', city: 'Mumbai', state: 'Maharashtra', latitude: 19.0863, longitude: 72.8888 },
  { station: 'Shivaji Nagar, Mumbai - BMC', city: 'Mumbai', state: 'Maharashtra', latitude: 19.060498, longitude: 72.923356 },
  { station: 'Chakala-Andheri East, Mumbai - IITM', city: 'Mumbai', state: 'Maharashtra', latitude: 19.11074, longitude: 72.86084 },
  { station: 'Navy Nagar-Colaba, Mumbai - IITM', city: 'Mumbai', state: 'Maharashtra', latitude: 18.897756, longitude: 72.81332 },
  { station: 'Bandra Kurla Complex, Mumbai - MPCB', city: 'Mumbai', state: 'Maharashtra', latitude: 19.0652, longitude: 72.8679 },
  { station: 'Worli, Mumbai - MPCB', city: 'Mumbai', state: 'Maharashtra', latitude: 19.0165, longitude: 72.8174 },
  { station: 'Sewri, Mumbai - BMC', city: 'Mumbai', state: 'Maharashtra', latitude: 19.000084, longitude: 72.85673 },
  { station: 'Mindspace-Malad West, Mumbai - MPCB', city: 'Mumbai', state: 'Maharashtra', latitude: 19.1878657, longitude: 72.8304069 },
  { station: 'Mulund West, Mumbai - MPCB', city: 'Mumbai', state: 'Maharashtra', latitude: 19.175, longitude: 72.9419 },
  { station: 'Borivali East, Mumbai - MPCB', city: 'Mumbai', state: 'Maharashtra', latitude: 19.2295, longitude: 72.8609 },

  // Bengaluru (Karnataka)
  { station: 'Silk Board, Bengaluru - KSPCB', city: 'Bengaluru', state: 'Karnataka', latitude: 12.917348, longitude: 77.622813 },
  { station: 'Jayanagar 5th Block, Bengaluru - KSPCB', city: 'Bengaluru', state: 'Karnataka', latitude: 12.920984, longitude: 77.584908 },
  { station: 'City Railway Station, Bengaluru - KSPCB', city: 'Bengaluru', state: 'Karnataka', latitude: 12.9772, longitude: 77.5713 },
  { station: 'Bapuji Nagar, Bengaluru - KSPCB', city: 'Bengaluru', state: 'Karnataka', latitude: 12.951913, longitude: 77.539784 },
  { station: 'Hebbal, Bengaluru - KSPCB', city: 'Bengaluru', state: 'Karnataka', latitude: 13.029152, longitude: 77.585901 },
  { station: 'BTM Layout, Bengaluru - CPCB', city: 'Bengaluru', state: 'Karnataka', latitude: 12.9135, longitude: 77.6101 },
  { station: 'Peenya, Bengaluru - KSPCB', city: 'Bengaluru', state: 'Karnataka', latitude: 13.0271, longitude: 77.5059 },
  { station: 'Saneguruvanahalli, Bengaluru - KSPCB', city: 'Bengaluru', state: 'Karnataka', latitude: 12.9916, longitude: 77.5385 },

  // Chennai (Tamil Nadu)
  { station: 'Manali Village, Chennai - TNPCB', city: 'Chennai', state: 'Tamil Nadu', latitude: 13.1662, longitude: 80.2584 },
  { station: 'Alandur, Chennai - TNPCB', city: 'Chennai', state: 'Tamil Nadu', latitude: 13.0012, longitude: 80.2014 },
  { station: 'Velachery, Chennai - TNPCB', city: 'Chennai', state: 'Tamil Nadu', latitude: 12.9744, longitude: 80.2185 },

  // Hyderabad (Telangana)
  { station: 'Sanathnagar, Hyderabad - TSPCB', city: 'Hyderabad', state: 'Telangana', latitude: 17.4559458, longitude: 78.4332152 },
  { station: 'Zoo Park, Hyderabad - TSPCB', city: 'Hyderabad', state: 'Telangana', latitude: 17.3496, longitude: 78.4515 },

  // Ahmedabad (Gujarat)
  { station: 'Chandkheda, Ahmedabad - IITM', city: 'Ahmedabad', state: 'Gujarat', latitude: 23.107969, longitude: 72.574648 },
  { station: 'Maninagar, Ahmedabad - GPCB', city: 'Ahmedabad', state: 'Gujarat', latitude: 22.9968, longitude: 72.6031 },

  // Pune (Maharashtra)
  { station: 'Mhada Colony, Pune - IITM', city: 'Pune', state: 'Maharashtra', latitude: 18.57304, longitude: 73.927715 },
  { station: 'Shivajinagar, Pune - MPCB', city: 'Pune', state: 'Maharashtra', latitude: 18.5308, longitude: 73.8475 },

  // Jaipur (Rajasthan)
  { station: 'Police Commissionerate, Jaipur - RSPCB', city: 'Jaipur', state: 'Rajasthan', latitude: 26.9164092, longitude: 75.7994901 },
  { station: 'Adarsh Nagar, Jaipur - RSPCB', city: 'Jaipur', state: 'Rajasthan', latitude: 26.8943, longitude: 75.8277 },

  // Lucknow (Uttar Pradesh)
  { station: 'Talkatora District Industries Center, Lucknow - CPCB', city: 'Lucknow', state: 'Uttar Pradesh', latitude: 26.83399722, longitude: 80.8917361 },
  { station: 'Lalbagh, Lucknow - CPCB', city: 'Lucknow', state: 'Uttar Pradesh', latitude: 26.8504, longitude: 80.9392 },

  // Patna (Bihar)
  { station: 'IGSC Planetarium Complex, Patna - BSPCB', city: 'Patna', state: 'Bihar', latitude: 25.610369, longitude: 85.132568 },
  { station: 'Muradpur, Patna - BSPCB', city: 'Patna', state: 'Bihar', latitude: 25.619651, longitude: 85.147382 },
  { station: 'Samanpura, Patna - BSPCB', city: 'Patna', state: 'Bihar', latitude: 25.596727, longitude: 85.085624 },
  { station: 'Rajbansi Nagar, Patna - BSPCB', city: 'Patna', state: 'Bihar', latitude: 25.599486, longitude: 85.113666 },

  // Chandigarh
  { station: 'Sector-25, Chandigarh - CPCC', city: 'Chandigarh', state: 'Chandigarh', latitude: 30.751462, longitude: 76.762879 },
  { station: 'Sector 22, Chandigarh - CPCC', city: 'Chandigarh', state: 'Chandigarh', latitude: 30.7298, longitude: 76.7725 },
]

/**
 * Find candidate CPCB stations within a configurable distance threshold (default: 25 km).
 * Results are sorted nearest-first.
 */
export function findNearbyStations(
  latitude: number,
  longitude: number,
  maxDistanceKm: number = DEFAULT_PROXIMITY_THRESHOLD_KM
): StationMatch[] {
  const matches: StationMatch[] = []

  for (const station of CPCB_STATIONS) {
    const distanceKm = haversineDistanceKm(latitude, longitude, station.latitude, station.longitude)
    if (distanceKm <= maxDistanceKm) {
      matches.push({ station, distanceKm })
    }
  }

  // Sort closest first
  matches.sort((a, b) => a.distanceKm - b.distanceKm)
  return matches
}
