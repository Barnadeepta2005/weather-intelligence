async function testFailureMatrix() {
  const results = {};

  // 1. Invalid coordinates to /api/weather
  try {
    const res = await fetch('http://localhost:3000/api/weather?lat=999&lon=999');
    results.invalidWeatherCoords = { status: res.status, body: await res.json() };
  } catch (e) {
    results.invalidWeatherCoords = { error: e.message };
  }

  // 2. Invalid coordinates to /api/air-quality
  try {
    const res = await fetch('http://localhost:3000/api/air-quality?lat=999&lon=999');
    results.invalidAqiCoords = { status: res.status, body: await res.json() };
  } catch (e) {
    results.invalidAqiCoords = { error: e.message };
  }

  // 3. Invalid coordinates to /api/reverse-geocode
  try {
    const res = await fetch('http://localhost:3000/api/reverse-geocode?lat=999&lon=999');
    results.invalidRevGeocodeCoords = { status: res.status, body: await res.json() };
  } catch (e) {
    results.invalidRevGeocodeCoords = { error: e.message };
  }

  // 4. Empty query to /api/geocode
  try {
    const res = await fetch('http://localhost:3000/api/geocode?q=');
    results.emptyGeocodeQuery = { status: res.status, body: await res.json() };
  } catch (e) {
    results.emptyGeocodeQuery = { error: e.message };
  }

  // 5. Non-existent city query to /api/geocode
  try {
    const res = await fetch('http://localhost:3000/api/geocode?q=xyznonexistentplace987654');
    results.noResultsGeocode = { status: res.status, body: await res.json() };
  } catch (e) {
    results.noResultsGeocode = { error: e.message };
  }

  // 6. Overly long parameter attack
  try {
    const longStr = 'A'.repeat(5000);
    const res = await fetch(`http://localhost:3000/api/weather?lat=22.57&lon=88.36&city=${longStr}`);
    results.longParamSanitized = { status: res.status, ok: res.ok };
  } catch (e) {
    results.longParamSanitized = { error: e.message };
  }

  // 7. Radar route check
  try {
    const res = await fetch('http://localhost:3000/api/radar');
    results.radarRoute = { status: res.status, ok: res.ok };
  } catch (e) {
    results.radarRoute = { error: e.message };
  }

  console.log(JSON.stringify(results, null, 2));
}

testFailureMatrix();
