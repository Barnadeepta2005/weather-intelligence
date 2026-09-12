async function checkLayers() {
  const res = await fetch('https://tiles.openfreemap.org/styles/positron');
  const style = await res.json();
  const interesting = ['boundary_2', 'boundary_3', 'label_state', 'label_city', 'label_town', 'label_other', 'water'];
  for (const id of interesting) {
    const l = style.layers.find(x => x.id === id);
    if (l) {
      console.log(`\n=== LAYER: ${id} ===`);
      console.log(JSON.stringify(l, null, 2));
    }
  }
}
checkLayers();
