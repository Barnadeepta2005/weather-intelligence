async function inspectChunk() {
  const url = 'https://app.cpcbccr.com/_next/static/chunks/app/AQI_India/page-a1a4b647a6f370e3.js';
  const res = await fetch(url);
  const text = await res.text();
  console.log('Chunk length:', text.length);
  // Look for API endpoints, fetches, urls
  const apiMatches = text.match(/\/api\/[a-zA-Z0-9_\-\/]+/g) || [];
  console.log('API routes in chunk:', [...new Set(apiMatches)]);
  const fetchMatches = text.match(/https?:\/\/[a-zA-Z0-9_\-\.\/]+/g) || [];
  console.log('URLs in chunk:', [...new Set(fetchMatches)].slice(0, 10));
}
inspectChunk();
