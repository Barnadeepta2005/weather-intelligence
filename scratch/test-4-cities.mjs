async function testCities() {
  const cities = ['Kolkata', 'Delhi', 'Mumbai', 'Bengaluru'];
  for (const city of cities) {
    const u = `https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69?api-key=579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b&format=json&limit=10&filters[city]=${encodeURIComponent(city)}`;
    try {
      const res = await fetch(u);
      if (res.ok) {
        const data = await res.json();
        console.log(`=== ${city} (Total records: ${data.total}, returned: ${data.records?.length}) ===`);
        // Group by station
        const stations = {};
        for (const r of (data.records || [])) {
          if (!stations[r.station]) {
            stations[r.station] = {
              lat: r.latitude,
              lon: r.longitude,
              last_update: r.last_update,
              pollutants: {}
            };
          }
          stations[r.station].pollutants[r.pollutant_id] = {
            min: r.min_value,
            max: r.max_value,
            avg: r.avg_value
          };
        }
        for (const [stName, stInfo] of Object.entries(stations)) {
          console.log(`Station: "${stName}" @ (${stInfo.lat}, ${stInfo.lon}) - Updated: ${stInfo.last_update}`);
          console.log(`Pollutants:`, stInfo.pollutants);
        }
      } else {
        console.log(`${city} HTTP ${res.status}`);
      }
    } catch (e) {
      console.log(`${city} error:`, e.message);
    }
    // Small delay to avoid rate limit
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}
testCities();
