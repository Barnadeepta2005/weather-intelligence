async function testLocation(name, lat, lon, tz) {
  const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi,european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone&hourly=us_aqi,european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone&timezone=${encodeURIComponent(tz)}`;
  const fcUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,uv_index&hourly=uv_index&daily=uv_index_max&timezone=${encodeURIComponent(tz)}`;
  
  const [aqRes, fcRes] = await Promise.all([fetch(aqUrl), fetch(fcUrl)]);
  const aq = await aqRes.json();
  const fc = await fcRes.json();
  
  console.log(`\n========================================`);
  console.log(`CITY: ${name} (${tz})`);
  console.log(`Coordinates: lat=${lat}, lon=${lon}`);
  console.log(`AQI API current time: ${aq.current?.time}`);
  console.log(`Forecast API current time: ${fc.current?.time}`);
  console.log(`US AQI (current): ${aq.current?.us_aqi}`);
  console.log(`European AQI (current): ${aq.current?.european_aqi}`);
  console.log(`PM2.5: ${aq.current?.pm2_5}, PM10: ${aq.current?.pm10}, O3: ${aq.current?.ozone}, NO2: ${aq.current?.nitrogen_dioxide}`);
  console.log(`Current UV Index: ${fc.current?.uv_index}`);
  console.log(`Daily Max UV Today: ${fc.daily?.uv_index_max?.[0]}`);
  
  // Find current hour in hourly UV
  const currentHourIso = fc.current?.time?.substring(0, 13);
  const hourlyIdx = fc.hourly?.time?.findIndex(t => t.startsWith(currentHourIso));
  console.log(`Hourly UV at current hour (${fc.hourly?.time?.[hourlyIdx]}): ${fc.hourly?.uv_index?.[hourlyIdx]}`);
}

async function run() {
  await testLocation('Kolkata', 22.5726, 88.3639, 'Asia/Kolkata');
  await testLocation('Mumbai', 19.0760, 72.8777, 'Asia/Kolkata');
  await testLocation('London', 51.5074, -0.1278, 'Europe/London');
  await testLocation('Tokyo', 35.6895, 139.6917, 'Asia/Tokyo');
}
run();
