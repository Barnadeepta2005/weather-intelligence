async function searchWeb() {
  const query = 'site:github.com "api.data.gov.in/resource" "api-key"';
  try {
    const res = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query), {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const html = await res.text();
    const regex = /[a-f0-9]{56}/g;
    const matches = [...new Set(html.match(regex) || [])];
    console.log('Found 56-char hex keys:', matches);
    
    // Also test each key against data.gov.in
    for (const key of matches) {
      const u = `https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69?api-key=${key}&format=json&limit=1`;
      try {
        const r = await fetch(u);
        console.log('Key', key.substring(0, 16) + '...', 'status:', r.status);
      } catch (err) {
        console.log('Key test error:', err.message);
      }
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}
searchWeb();
