async function inspectPositron() {
  const res = await fetch('https://tiles.openfreemap.org/styles/positron');
  const style = await res.json();
  console.log('Total layers:', style.layers.length);
  for (let i = 0; i < style.layers.length; i++) {
    const l = style.layers[i];
    console.log(`[${i}] id: ${l.id} | type: ${l.type} | source-layer: ${l['source-layer']} | minzoom: ${l.minzoom} | maxzoom: ${l.maxzoom}`);
    if (l.id.includes('boundary') || l.id.includes('label') || l.id.includes('place') || l.id.includes('admin')) {
      console.log('    paint:', JSON.stringify(l.paint));
      console.log('    layout:', JSON.stringify(l.layout));
    }
  }
}
inspectPositron();
