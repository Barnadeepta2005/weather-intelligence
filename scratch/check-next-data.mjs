async function checkNextData() {
  const res = await fetch('https://app.cpcbccr.com/AQI_India/');
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (match) {
    console.log('Found __NEXT_DATA__! Length:', match[1].length);
    const data = JSON.parse(match[1]);
    console.log('Props keys:', Object.keys(data.props || {}));
    console.log('PageProps keys:', Object.keys(data.props?.pageProps || {}));
  } else {
    // Check for self.__next_f
    const rsc = html.match(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g);
    console.log('RSC chunks:', rsc?.length);
    if (rsc) {
      // Look for station data or cities in RSC chunks
      const combined = rsc.join('');
      console.log('Contains Kolkata?', combined.includes('Kolkata'));
      console.log('Contains Delhi?', combined.includes('Delhi'));
    }
  }
}
checkNextData();
