async function checkEndpoints() {
  const urls = [
    'https://cpcb.nic.in/caaqms.php',
    'https://app.cpcbccr.com/AQI_India/',
    'https://app.cpcbccr.com/caaqms/caaqms_landing_map_all',
    'https://api.openaq.org/v3/locations?countries_id=IN&limit=3'
  ];
  for (const u of urls) {
    try {
      const res = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
      console.log(u, '->', res.status);
    } catch (e) {
      console.log(u, '-> error:', e.message);
    }
  }
}
checkEndpoints();
