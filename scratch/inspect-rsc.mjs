async function inspectRsc() {
  const res = await fetch('https://app.cpcbccr.com/AQI_India/');
  const html = await res.text();
  
  // Extract all self.__next_f pushes
  const regex = /self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g;
  let m;
  let fullText = '';
  while ((m = regex.exec(html)) !== null) {
    // unescape quotes and backslashes
    try {
      const unescaped = JSON.parse('"' + m[1] + '"');
      fullText += unescaped;
    } catch {
      fullText += m[1];
    }
  }
  console.log('Unescaped RSC text length:', fullText.length);
  
  // Find mention of Kolkata or Delhi
  const idx = fullText.indexOf('Kolkata');
  if (idx !== -1) {
    console.log('Context around Kolkata:');
    console.log(fullText.substring(Math.max(0, idx - 200), Math.min(fullText.length, idx + 400)));
  }
}
inspectRsc();
