export function parseIGC(content) {
  const lines = content.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  let date='', pilot='', gliderType='', site='';
  const fixes = [];

  for (const line of lines) {
    if (/^H[FO]DTE/i.test(line)) {
      const m = line.match(/(\d{2})(\d{2})(\d{2})\s*$/);
      if (m) { const yr=+m[3]>50?`19${m[3]}`:`20${m[3]}`; date=`${yr}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; }
    } else if (/^H.PLT/i.test(line)) pilot = line.split(':').slice(1).join(':').trim();
    else if (/^H.GTY/i.test(line)) gliderType = line.split(':').slice(1).join(':').trim();
    else if (/^H.SIT/i.test(line)) site = line.split(':').slice(1).join(':').trim();
    if (line[0]==='B' && line.length>=35) { const f=parseBRecord(line); if(f) fixes.push(f); }
  }
  if (!fixes.length) throw new Error('No GPS fixes found in IGC file');

  const sampled = downsample(fixes, 600);
  return buildResult(sampled, date||new Date().toISOString().slice(0,10), pilot, gliderType, site, content);
}

export function parseKML(content) {
  const blocks = [...content.matchAll(/<coordinates[^>]*>([\s\S]*?)<\/coordinates>/gi)];
  if (!blocks.length) throw new Error('No coordinates in KML');
  const fixes = [];
  for (const b of blocks) {
    for (const pt of b[1].trim().split(/\s+/)) {
      const [lon,lat,alt] = pt.split(',').map(Number);
      if (!isNaN(lat)&&!isNaN(lon)) fixes.push({lat,lon,gpsAlt:alt||0,pressureAlt:0,h:0,m:0,s:0});
    }
  }
  const whenMatches = [...content.matchAll(/<when>(.*?)<\/when>/gi)];
  whenMatches.forEach((w,i) => {
    if (fixes[i]) { const d=new Date(w[1]); fixes[i].h=d.getUTCHours(); fixes[i].m=d.getUTCMinutes(); fixes[i].s=d.getUTCSeconds(); }
  });
  const dateMatch = whenMatches[0]?.[1]?.slice(0,10) || new Date().toISOString().slice(0,10);
  if (!fixes.length) throw new Error('No valid KML coordinates');
  const sampled = downsample(fixes, 600);
  return buildResult(sampled, dateMatch, '', '', '', '');
}

function parseBRecord(line) {
  try {
    const h=+line.slice(1,3),m=+line.slice(3,5),s=+line.slice(5,7);
    const latDeg=+line.slice(7,9),latMin=+line.slice(9,11),latFrac=+line.slice(11,14),latH=line[14].toUpperCase();
    const lonDeg=+line.slice(15,18),lonMin=+line.slice(18,20),lonFrac=+line.slice(20,23),lonH=line[23].toUpperCase();
    const pressureAlt=+line.slice(25,30), gpsAlt=+line.slice(30,35);
    let lat=latDeg+(latMin+latFrac/1000)/60; if(latH==='S')lat=-lat;
    let lon=lonDeg+(lonMin+lonFrac/1000)/60; if(lonH==='W')lon=-lon;
    if(!isFinite(lat)||!isFinite(lon)) return null;
    return {lat,lon,gpsAlt,pressureAlt,h,m,s};
  } catch { return null; }
}

function buildResult(fixes, date, pilot, gliderType, site, raw) {
  const takeoff=fixes[0], landing=fixes[fixes.length-1];
  const duration=calcDuration(fixes), distance=Math.round(calcDistance(fixes)*100)/100;
  const maxAlt=Math.max(...fixes.map(f=>f.gpsAlt||f.pressureAlt||0));
  return {
    fixes, date, pilot, gliderType, site,
    takeoff, landing, duration_seconds:duration,
    distance_km:distance, max_altitude_m:maxAlt,
    track_geojson:JSON.stringify(toGeoJSON(fixes))
  };
}

function calcDuration(fixes) {
  if (fixes.length<2) return 0;
  const f=fixes[0],l=fixes[fixes.length-1];
  let start=f.h*3600+f.m*60+f.s, end=l.h*3600+l.m*60+l.s;
  if(end<start)end+=86400; return Math.max(0,end-start);
}
function haversine(lat1,lon1,lat2,lon2){
  const R=6371,φ1=lat1*Math.PI/180,φ2=lat2*Math.PI/180;
  const Δφ=(lat2-lat1)*Math.PI/180,Δλ=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(Δφ/2)**2+Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function calcDistance(fixes){let d=0;for(let i=1;i<fixes.length;i++)d+=haversine(fixes[i-1].lat,fixes[i-1].lon,fixes[i].lat,fixes[i].lon);return d;}
function downsample(fixes,max){if(fixes.length<=max)return fixes;const step=Math.ceil(fixes.length/max);const out=[];for(let i=0;i<fixes.length;i+=step)out.push(fixes[i]);if(out[out.length-1]!==fixes[fixes.length-1])out.push(fixes[fixes.length-1]);return out;}
function toGeoJSON(fixes){return {type:'Feature',geometry:{type:'LineString',coordinates:fixes.map(f=>[Math.round(f.lon*1e5)/1e5,Math.round(f.lat*1e5)/1e5,Math.round(f.gpsAlt||0)])},properties:{}};}

export function fmtDuration(s){
  if(!s)return '—';
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);
  if(h>0)return `${h}h ${m.toString().padStart(2,'0')}m`;
  return `${m}m ${(s%60).toString().padStart(2,'0')}s`;
}
