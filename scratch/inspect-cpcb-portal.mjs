async function inspectCpcbPortal() {
  try {
    const res = await fetch('https://app.cpcbccr.com/AQI_India/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    const html = await res.text();
    console.log('HTML length:', html.length);
    // Search for API calls or endpoints or ajax
    const matches = html.match(/(?:fetch|ajax|\/caaqms\/|http[s]?:\/\/[^"'\s]+)/gi) || [];
    console.log('Sample matched urls/endpoints:', [...new Set(matches)].slice(0, 20));
    
    // Check for script tags
    const scriptSrcs = html.match(/src=["']([^"']+)["']/gi) || [];
    console.log('Script srcs:', scriptSrcs.slice(0, 15));
  } catch (e) {
    console.log('Error:', e.message);
  }
}
inspectCpcbPortal();
