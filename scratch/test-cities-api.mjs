async function testCity(name, lat, lon, tz) {
  const res = await fetch(`http://localhost:3000/api/weather?latitude=${lat}&longitude=${lon}&city=${encodeURIComponent(name)}&country=TEST&timezone=${encodeURIComponent(tz)}`);
  const data = await res.json();
  console.log('--------------------------------------------------');
  console.log(`CITY: ${data.location.city} (${data.location.country})`);
  console.log('Coordinates:', `lat=${lat}, lon=${lon}`);
  console.log('Local time:', data.location.localTime, 'Timezone:', tz);
  console.log('Current Temp:', data.currentConditions.temperature + '°C', data.currentConditions.condition);
  console.log('AQI:', `Standard=${data.airQuality.standard}`, `Index=${data.airQuality.index}`, `Level=${data.airQuality.level}`, `Timestamp=${data.airQuality.timestamp}`);
  console.log('Pollutants:', `PM2.5=${data.airQuality.pm25}`, `PM10=${data.airQuality.pm10}`, `O3=${data.airQuality.o3}`, `NO2=${data.airQuality.no2}`);
  console.log('UV:', `Current=${data.uv.index}`, `PeakToday=${data.uv.maxToday}`, `Level=${data.uv.level}`, `Timestamp=${data.uv.timestamp}`);
}

async function run() {
  await testCity('Kolkata', 22.5726, 88.3639, 'Asia/Kolkata');
  await testCity('Mumbai', 19.0760, 72.8777, 'Asia/Kolkata');
  await testCity('London', 51.5074, -0.1278, 'Europe/London');
  await testCity('Tokyo', 35.6895, 139.6917, 'Asia/Tokyo');
}
run();
