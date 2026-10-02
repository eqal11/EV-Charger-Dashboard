// EV Monitor JB — application logic. Reads STATIONS from js/data.js.
const TOTAL = STATIONS.length;

function typeColor(t){ if(t==='DC')return '#2563eb'; if(t==='AC')return '#16a34a'; if(t==='DC / AC')return '#f97316'; return '#94a3b8'; }
function typeClass(t){ if(t==='DC')return 'tp-dc'; if(t==='AC')return 'tp-ac'; if(t==='DC / AC')return 'tp-dcac'; return ''; }
function countBy(key){ const c={}; STATIONS.forEach(s=>{c[s[key]]=(c[s[key]]||0)+1;}); return c; }
function kwNum(s){ const m=String(s.power).match(/\d+/); return m?+m[0]:0; }

// Haversine distance (km)
function distKm(a,b,c,d){
  const R=6371,r=Math.PI/180, dLat=(c-a)*r, dLng=(d-b)*r;
  const x=Math.sin(dLat/2)**2 + Math.cos(a*r)*Math.cos(c*r)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

/* ---------- THEME (dark mode) ---------- */
const TILES={
  standard:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
};
const tileRefs={main:null,full:null};
function makeTiles(map,which){
  // Reuse tiles on theme changes; dark styling is handled by CSS.
  if(tileRefs[which]) return;
  tileRefs[which]=L.tileLayer(TILES.standard,{
    maxZoom:19,
    maxNativeZoom:18,
    className:'ev-basemap',
    attribution:'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Sources: Esri, DeLorme, HERE, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), MapmyIndia, TomTom'
  }).addTo(map);
}
function toggleTheme(){
  const html=document.documentElement;
  const dark=html.getAttribute('data-theme')==='dark';
  html.setAttribute('data-theme',dark?'light':'dark');
  document.getElementById('theme-btn').innerHTML=dark?'&#127769;':'&#9728;';
  if(tileRefs.main)makeTiles(mainMap,'main');
  if(fullMapInit)makeTiles(fullMap,'full');
}

/* ---------- mobile sidebar ---------- */
function toggleSidebar(){
  document.querySelector('.sidebar').classList.toggle('open');
  document.getElementById('backdrop').classList.toggle('show');
}

/* ---------- KPI + count-up ---------- */
const uniqueOps=new Set(STATIONS.map(s=>s.operator));
const uniqueAreas=new Set(STATIONS.map(s=>s.area));
document.getElementById('kpi-ops').dataset.count=uniqueOps.size;
document.getElementById('kpi-areas').dataset.count=uniqueAreas.size;
document.getElementById('kpi-ops-sub').textContent=[...uniqueOps].slice(0,3).join(', ')+' & more';
function countUp(el){ const tgt=+el.dataset.count||0,t0=performance.now();
  (function step(n){ const p=Math.min((n-t0)/700,1); el.textContent=Math.round(tgt*(1-Math.pow(1-p,3))); if(p<1)requestAnimationFrame(step); })(t0); }
document.querySelectorAll('.kpi-val[data-count]').forEach(countUp);

/* ---------- DIRECTIONS MODAL ---------- */
function openDir(id){
  const s=STATIONS.find(x=>x.id===id); if(!s)return;
  const d=s.lat+','+s.lng;
  document.getElementById('dir-title').textContent='Directions';
  document.getElementById('dir-sub').textContent='Open "'+s.name+'" in your maps app.';
  document.getElementById('dir-actions').innerHTML=
    '<a class="dir-opt" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination='+d+'&travelmode=driving"><span class="ic">&#128506;</span> Google Maps <small>Open</small></a>'+
    '<a class="dir-opt" target="_blank" rel="noopener" href="https://waze.com/ul?ll='+d+'&navigate=yes"><span class="ic">&#128663;</span> Waze <small>Open</small></a>'+
    '<a class="dir-opt" target="_blank" rel="noopener" href="https://maps.apple.com/?daddr='+d+'&dirflg=d"><span class="ic">&#63743;</span> Apple Maps <small>Open</small></a>'+
    '<a class="dir-opt" target="_blank" rel="noopener" href="geo:'+d+'?q='+d+'('+encodeURIComponent(s.name)+')"><span class="ic">&#128241;</span> Default map app <small>Open</small></a>';
  document.getElementById('dir-modal').style.display='flex';
}
function closeDir(){ document.getElementById('dir-modal').style.display='none'; }
document.getElementById('dir-modal').addEventListener('click',e=>{ if(e.target.id==='dir-modal')closeDir(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){closeDir();closeNear();} });

/* ---------- POPUP ---------- */
function popupHtml(s){
  const col=typeColor(s.type);
  const am=(s.amenities&&s.amenities.length)?('<br>&#10024; '+s.amenities.slice(0,4).join(' &middot; ')):'';
  return '<div class="ev-popup"><div class="ep-name">'+s.name+'</div>'+
    '<div class="ep-row"><span style="background:'+col+'22;color:'+col+';padding:1px 7px;border-radius:10px;font-size:10px;font-weight:600">'+s.type+'</span>'+
    '<span style="background:#f1f5f9;color:#475569;padding:1px 7px;border-radius:10px;font-size:10px">'+s.operator+'</span></div>'+
    '<div class="ep-info">&#9889; <b>'+s.power+'</b> &nbsp;|&nbsp; &#128268; '+s.connector+'<br>&#128176; <span class="ep-price">'+s.pricing+'</span><br>&#128336; '+s.hours+' &nbsp;|&nbsp; &#128205; '+s.area+am+'</div>'+
    '<button class="ep-dir" onclick="openDir('+s.id+')">&#128663; Get Directions</button></div>';
}
function makeIcon(col,size){ const b=size||16; return L.divIcon({html:'<div style="width:'+b+'px;height:'+b+'px;border-radius:50%;background:'+col+';border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.35)"></div>',className:'',iconSize:[b,b],iconAnchor:[b/2,b/2]}); }

/* cluster support with graceful fallback if the plugin CDN fails */
const CLUSTER = (typeof L.markerClusterGroup === 'function');
function makeGroup(){ return CLUSTER ? L.markerClusterGroup({maxClusterRadius:48,spiderfyOnMaxZoom:true,showCoverageOnHover:false}) : L.layerGroup(); }

/* ---------- MAP: dashboard ---------- */
const mainMap=L.map('main-map',{center:[1.47,103.70],zoom:11,zoomControl:true});
makeTiles(mainMap,'main');
const mainMarkers=[]; const mainGroup=makeGroup().addTo(mainMap);
STATIONS.forEach(s=>{ const m=L.marker([s.lat,s.lng],{icon:makeIcon(typeColor(s.type),16)}); m.bindPopup(popupHtml(s),{maxWidth:260}); mainMarkers.push({marker:m,station:s}); mainGroup.addLayer(m); });
function filterMap(type,btn){
  document.querySelectorAll('.map-filter-row .mfchip').forEach(b=>b.classList.remove('on')); if(btn)btn.classList.add('on');
  mainGroup.clearLayers();
  mainMarkers.forEach(({marker,station})=>{ if(type==='all'||station.type===type)mainGroup.addLayer(marker); });
}

/* ---------- MAP: full page ---------- */
let fullMapInit=false,fullMap,fullMarkers=[],fullGroup;
let fmType='all';
function initFullMap(){
  if(fullMapInit)return; fullMapInit=true;
  fullMap=L.map('full-map',{center:[1.47,103.70],zoom:11});
  makeTiles(fullMap,'full');
  fullGroup=makeGroup().addTo(fullMap);
  STATIONS.forEach(s=>{ const m=L.marker([s.lat,s.lng],{icon:makeIcon(typeColor(s.type),18)}); m.bindPopup(popupHtml(s),{maxWidth:260}); fullMarkers.push({marker:m,station:s}); fullGroup.addLayer(m); });
  // populate operator filter
  const opSel=document.getElementById('fm-op');
  [...new Set(STATIONS.map(s=>s.operator))].sort().forEach(o=>{const el=document.createElement('option');el.value=el.textContent=o;opSel.appendChild(el);});
}
function filterFullMap(type,btn){
  fmType=type;
  document.querySelectorAll('.full-map-controls .mfchip').forEach(b=>b.classList.remove('on')); if(btn)btn.classList.add('on');
  applyFullFilters();
}
function applyFullFilters(){
  if(!fullMapInit)return;
  const op=document.getElementById('fm-op').value;
  const kw=document.getElementById('fm-kw').value;
  let lo=0,hi=1e9; if(kw){const p=kw.split('-');lo=+p[0];hi=+p[1];}
  fullGroup.clearLayers();
  fullMarkers.forEach(({marker,station})=>{
    if(fmType!=='all' && station.type!==fmType) return;
    if(op && station.operator!==op) return;
    const k=kwNum(station); if(k<lo||k>hi) return;
    fullGroup.addLayer(marker);
  });
}

/* ---------- LOCATE ME + NEAREST EV + ROUTE LINE ---------- */
let meMarker={main:null,full:null}, routeLine={main:null,full:null};
function activeMap(which){ return which==='full'?fullMap:mainMap; }
function activeMarkers(which){ return which==='full'?fullMarkers:mainMarkers; }
function activeGroup(which){ return which==='full'?fullGroup:mainGroup; }
function locateMe(which){
  if(!navigator.geolocation){ alert('Geolocation not supported on this device.'); return; }
  if(which==='full'){ initFullMap(); fullMap.invalidateSize(); }
  navigator.geolocation.getCurrentPosition(p=>{
    const lat=p.coords.latitude, lng=p.coords.longitude, map=activeMap(which);
    if(meMarker[which]) map.removeLayer(meMarker[which]);
    meMarker[which]=L.circleMarker([lat,lng],{radius:9,color:'#2563eb',weight:3,fillColor:'#3b82f6',fillOpacity:.9}).addTo(map).bindPopup('You are here');
    const ranked=STATIONS.map(s=>({s,d:distKm(lat,lng,s.lat,s.lng)})).sort((a,b)=>a.d-b.d);
    const nearest=ranked.slice(0,5);
    // route line to #1 nearest
    if(routeLine[which]) map.removeLayer(routeLine[which]);
    routeLine[which]=L.polyline([[lat,lng],[nearest[0].s.lat,nearest[0].s.lng]],{color:'#2563eb',weight:3,dashArray:'7,8',opacity:.75}).addTo(map);
    map.flyToBounds(L.latLngBounds([[lat,lng]].concat(nearest.map(n=>[n.s.lat,n.s.lng]))),{padding:[60,60],maxZoom:14});
    showNearest(nearest,which);
    meMarker[which].openPopup();
  }, ()=>{
    alert('Could not get your location. Allow location permission, and run via a local server or GitHub Pages (https) for best results.');
  }, {enableHighAccuracy:true,timeout:9000});
}
function showNearest(list,which){
  document.getElementById('near-list').innerHTML=list.map((n,i)=>{
    const km=n.d<1?Math.round(n.d*1000)+' m':n.d.toFixed(1)+' km';
    return '<div class="near-item" onclick="focusStation('+n.s.id+',\''+which+'\')"><div class="near-rank">'+(i+1)+'</div><div class="near-main"><div class="near-name">'+n.s.name+'</div><div class="near-meta">'+n.s.type+' &middot; '+n.s.power+' &middot; '+n.s.operator+'</div></div><div class="near-dist">'+km+'</div></div>';
  }).join('');
  document.getElementById('near-panel').style.display='block';
}
function closeNear(){ document.getElementById('near-panel').style.display='none'; }
function focusStation(id,which){
  const map=activeMap(which), mk=activeMarkers(which).find(m=>m.station.id===id); if(!mk)return;
  const grp=activeGroup(which);
  const done=()=>setTimeout(()=>mk.marker.openPopup(),350);
  map.flyTo([mk.station.lat,mk.station.lng],16);
  if(CLUSTER && grp.zoomToShowLayer){ grp.zoomToShowLayer(mk.marker,done); } else { if(!map.hasLayer(mk.marker))grp.addLayer(mk.marker); done(); }
}

/* ---------- DONUT ---------- */
const typeCount=countBy('type');
const tLabels=['DC','AC','DC / AC'];
const tData=tLabels.map(k=>typeCount[k]||0);
const tColors=tLabels.map(typeColor);
const tNames=['DC CCS','AC Type 2','DC + AC'];
new Chart(document.getElementById('donut-chart'),{type:'doughnut',data:{labels:tNames,datasets:[{data:tData,backgroundColor:tColors,borderWidth:4,borderColor:'#fff',hoverOffset:5}]},options:{cutout:'68%',plugins:{legend:{display:false}},animation:{duration:800}}});
const typeLeg=document.getElementById('type-legend');
tLabels.forEach((t,i)=>{ const pct=Math.round(tData[i]/TOTAL*100);
  typeLeg.innerHTML+='<div class="tleg-row"><div class="tleg-dot" style="background:'+tColors[i]+'"></div><div class="tleg-name">'+tNames[i]+'</div><div class="tleg-val">'+pct+'% &middot; '+tData[i]+' stations</div></div>'; });
new Chart(document.getElementById('charger-donut'),{type:'doughnut',data:{labels:tNames,datasets:[{data:tData,backgroundColor:tColors,borderWidth:4,borderColor:'#fff',hoverOffset:5}]},options:{cutout:'60%',plugins:{legend:{display:false}},animation:{duration:800}}});
const cLeg=document.getElementById('charger-legend');
tLabels.forEach((t,i)=>{ cLeg.innerHTML+='<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-2)"><div style="width:14px;height:14px;border-radius:4px;background:'+tColors[i]+';flex-shrink:0"></div><div style="flex:1;font-size:14px;font-weight:500;color:var(--text)">'+tNames[i]+'</div><div style="font-size:18px;font-weight:700;color:'+tColors[i]+'">'+tData[i]+'</div><div style="font-size:12px;color:var(--muted);width:50px;text-align:right">'+Math.round(tData[i]/TOTAL*100)+'%</div></div>'; });

/* ---------- AREA bar (dashboard) ---------- */
const areaCount=countBy('area');
const areaTop=Object.entries(areaCount).sort((a,b)=>b[1]-a[1]).slice(0,8);
new Chart(document.getElementById('area-bar'),{type:'bar',data:{labels:areaTop.map(a=>a[0]),datasets:[{data:areaTop.map(a=>a[1]),backgroundColor:'#3b82f6',borderRadius:5,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>' '+c.parsed.y+' stations'}}},scales:{x:{grid:{display:false},ticks:{color:'#94a3b8',font:{size:10,family:'Inter'},maxRotation:35}},y:{beginAtZero:true,grid:{color:'rgba(148,163,184,.15)'},ticks:{color:'#94a3b8',font:{size:10},stepSize:2}}}}});

/* ---------- STATS charts ---------- */
const areaAll=Object.entries(areaCount).sort((a,b)=>b[1]-a[1]).slice(0,12);
new Chart(document.getElementById('big-area-bar'),{type:'bar',data:{labels:areaAll.map(a=>a[0]),datasets:[{data:areaAll.map(a=>a[1]),backgroundColor:areaAll.map((_,i)=>i===0?'#1d4ed8':'#3b82f6'),borderRadius:5,borderSkipped:false}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{grid:{display:false},ticks:{color:'#94a3b8',font:{size:10,family:'Inter'},maxRotation:40}},y:{beginAtZero:true,grid:{color:'rgba(148,163,184,.15)'},ticks:{color:'#94a3b8',font:{size:10}}}}}});
const opCount=countBy('operator');
const opColors={}; STATIONS.forEach(s=>{if(!opColors[s.operator])opColors[s.operator]=s.color;});
const opTop=Object.entries(opCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
new Chart(document.getElementById('op-bar'),{type:'bar',data:{labels:opTop.map(o=>o[0]),datasets:[{data:opTop.map(o=>o[1]),backgroundColor:opTop.map(o=>opColors[o[0]]||'#94a3b8'),borderRadius:5,borderSkipped:false}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'rgba(148,163,184,.15)'},ticks:{color:'#94a3b8',font:{size:10}}},y:{grid:{display:false},ticks:{color:'#94a3b8',font:{size:11,family:'Inter'}}}}}});
const locCount=countBy('loc_type');
const locTop=Object.entries(locCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
const locColors=['#3b82f6','#22c55e','#f97316','#a855f7','#ef4444','#f59e0b','#06b6d4','#84cc16','#ec4899','#8b5cf6'];
new Chart(document.getElementById('loc-bar'),{type:'bar',data:{labels:locTop.map(l=>l[0]),datasets:[{data:locTop.map(l=>l[1]),backgroundColor:locColors,borderRadius:5,borderSkipped:false}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{beginAtZero:true,grid:{color:'rgba(148,163,184,.15)'},ticks:{color:'#94a3b8',font:{size:10}}},y:{grid:{display:false},ticks:{color:'#94a3b8',font:{size:10,family:'Inter'}}}}}});
const areaRankEl=document.getElementById('area-rank');
const maxA=areaAll[0][1];
areaAll.forEach(([name,n])=>{ areaRankEl.innerHTML+='<div class="ab-row"><div class="ab-label">'+name+'</div><div class="ab-bg"><div class="ab-bar" style="width:'+Math.round(n/maxA*100)+'%"></div></div><div class="ab-num">'+n+'</div></div>'; });

/* ---------- Charger cards ---------- */
const ctCards=document.getElementById('charger-type-cards');
tLabels.forEach((t,i)=>{ ctCards.innerHTML+='<div class="card" style="margin-bottom:0"><div class="card-hd"><div class="card-title"><span style="color:'+tColors[i]+'">&#9889;</span> '+tNames[i]+'</div></div><div class="card-body"><div style="font-size:40px;font-weight:800;color:'+tColors[i]+';margin-bottom:4px">'+tData[i]+'</div><div style="font-size:12px;color:var(--text-2)">stations &middot; '+Math.round(tData[i]/TOTAL*100)+'% of total</div><div style="margin-top:12px;height:6px;background:var(--border-2);border-radius:3px"><div style="width:'+Math.round(tData[i]/TOTAL*100)+'%;height:6px;border-radius:3px;background:'+tColors[i]+'"></div></div></div></div>'; });

/* ---------- DASHBOARD LIST ---------- */
const areaSelDash=document.getElementById('dash-area-sel');
[...new Set(STATIONS.map(s=>s.area))].sort().forEach(a=>{const o=document.createElement('option');o.value=o.textContent=a;areaSelDash.appendChild(o);});
function renderDashList(data){
  document.getElementById('dash-list-count').textContent=data.length+' stations';
  document.getElementById('dash-slist').innerHTML=data.map(s=>'<div class="slist-item" onclick="focusStation('+s.id+',\'main\')"><div class="sl-name">'+s.name+'</div><div style="font-size:12px;color:var(--text-2);width:110px">'+s.area+'</div><div style="width:84px"><span class="type-pill '+typeClass(s.type)+'">'+s.type+'</span></div><div><span class="op-pill">'+s.operator+'</span></div></div>').join('');
}
renderDashList(STATIONS);
function filterDashList(){
  const q=document.getElementById('dash-search').value.toLowerCase();
  const ar=document.getElementById('dash-area-sel').value;
  renderDashList(STATIONS.filter(s=>{ if(q&&!s.name.toLowerCase().includes(q))return false; if(ar&&s.area!==ar)return false; return true; }));
}

/* ---------- TABLE ---------- */
const tblOpSel=document.getElementById('tbl-op'), tblAreaSel=document.getElementById('tbl-area');
[...new Set(STATIONS.map(s=>s.operator))].sort().forEach(o=>{const el=document.createElement('option');el.value=el.textContent=o;tblOpSel.appendChild(el);});
[...new Set(STATIONS.map(s=>s.area))].sort().forEach(a=>{const el=document.createElement('option');el.value=el.textContent=a;tblAreaSel.appendChild(el);});
function renderTable(data){
  ['tbl-count','tbl-count2'].forEach(id=>{document.getElementById(id).textContent=data.length+' stations';});
  document.getElementById('tbl-body').innerHTML=data.map(s=>'<tr><td style="color:var(--muted)">'+s.id+'</td><td style="font-weight:500;max-width:220px">'+s.name+'</td><td style="color:var(--text-2)">'+s.area+'</td><td><span class="type-pill '+typeClass(s.type)+'">'+s.type+'</span></td><td style="font-weight:600">'+s.power+'</td><td><span class="op-pill" style="border-left:3px solid '+s.color+'">'+s.operator+'</span></td><td style="font-size:12px">'+s.pricing+'</td><td style="font-size:12px;color:var(--text-2)">'+s.hours+'</td><td style="font-weight:600;text-align:center">'+s.bays+'</td><td><button class="dir-link" onclick="openDir('+s.id+')">&#128663; Directions</button></td></tr>').join('');
}
renderTable(STATIONS);
function filterTable(){
  const q=document.getElementById('tbl-search').value.toLowerCase();
  const tp=document.getElementById('tbl-type').value, op=document.getElementById('tbl-op').value, ar=document.getElementById('tbl-area').value;
  renderTable(STATIONS.filter(s=>{ if(q&&!s.name.toLowerCase().includes(q)&&!s.area.toLowerCase().includes(q)&&!s.operator.toLowerCase().includes(q))return false; if(tp&&s.type!==tp)return false; if(op&&s.operator!==op)return false; if(ar&&s.area!==ar)return false; return true; }));
}

/* ---------- NAV ---------- */
function showPage(name){
  document.querySelectorAll('.page').forEach(p=>{p.classList.remove('active');p.style.display='none';});
  document.querySelectorAll('.sb-item').forEach(i=>i.classList.remove('active'));
  const pg=document.getElementById('page-'+name);
  pg.classList.add('active');
  if(name==='map'){pg.style.display='flex';setTimeout(()=>{initFullMap();fullMap.invalidateSize();},50);} else {pg.style.display='block';}
  const idx={'dashboard':0,'map':1,'stats':2,'chargers':3,'stations':4};
  const items=document.querySelectorAll('.sb-item'); if(idx[name]!==undefined)items[idx[name]].classList.add('active');
  if(name==='dashboard')setTimeout(()=>mainMap.invalidateSize(),50);
  // close mobile sidebar after nav
  if(window.innerWidth<=760){ document.querySelector('.sidebar').classList.remove('open'); document.getElementById('backdrop').classList.remove('show'); }
}
document.getElementById('page-dashboard').style.display='block';
