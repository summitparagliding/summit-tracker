<script>
  import { onMount, onDestroy } from 'svelte';
  export let geojson;
  export let takeoffLat = null, takeoffLon = null;
  export let landingLat = null, landingLon = null;
  export let height = '380px';

  let mapEl, map;
  onMount(async () => {
    const L = (await import('leaflet')).default;
    await import('leaflet/dist/leaflet.css');
    const parsed = typeof geojson === 'string' ? JSON.parse(geojson) : geojson;
    const coords = parsed?.geometry?.coordinates ?? [];
    if (!coords.length) return;
    const latLngs = coords.map(([lon,lat]) => [lat,lon]);
    map = L.map(mapEl, { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:'© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom:18
    }).addTo(map);
    const line = L.polyline(latLngs, { color:'#0ea5e9', weight:3, opacity:.9 }).addTo(map);
    L.polyline(latLngs, { color:'#7dd3fc', weight:1, opacity:.35 }).addTo(map);
    const mkIcon = (bg,lbl) => L.divIcon({
      html:`<div style="background:${bg};border:2px solid #fff;width:16px;height:16px;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700">${lbl}</div>`,
      className:'', iconSize:[16,16], iconAnchor:[8,8]
    });
    L.marker([takeoffLat??latLngs[0][0], takeoffLon??latLngs[0][1]], {icon:mkIcon('#22c55e','T')}).bindPopup('<b>Takeoff</b>').addTo(map);
    L.marker([landingLat??latLngs[latLngs.length-1][0], landingLon??latLngs[latLngs.length-1][1]], {icon:mkIcon('#ef4444','L')}).bindPopup('<b>Landing</b>').addTo(map);
    map.fitBounds(line.getBounds(), { padding:[24,24] });
  });
  onDestroy(() => { if (map) map.remove(); });
</script>
<div bind:this={mapEl} style="width:100%;height:{height};border-radius:var(--r-md);overflow:hidden;"></div>
<style>
  :global(.leaflet-container){background:#0a1520!important}
  :global(.leaflet-popup-content-wrapper){background:var(--bg-card);color:var(--txt);border:1px solid var(--border);border-radius:var(--r-sm)}
  :global(.leaflet-popup-tip){background:var(--bg-card)}
  :global(.leaflet-control-attribution){background:rgba(10,21,32,.8)!important;color:var(--txt-3)!important;font-size:10px}
  :global(.leaflet-control-attribution a){color:var(--sky)!important}
  :global(.leaflet-control-zoom a){background:var(--bg-card)!important;color:var(--txt)!important;border-color:var(--border)!important}
</style>
