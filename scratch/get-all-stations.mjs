async function getAllStations() {
  const apiKey = '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';
  // We can fetch page by page or fetch distinct stations
  // Let's test how fast we can get stations or if we can fetch 50 records at a time
  const u = `https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69?api-key=${apiKey}&format=json&limit=10`;
  const res = await fetch(u);
  const data = await res.json();
  console.log('Total records:', data.total);
}
getAllStations();
