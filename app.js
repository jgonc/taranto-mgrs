/* Taranto MGRS – map, grid overlay, GPS read-out, go-to-grid. Open data only (OpenStreetMap). */
(function () {
  'use strict';
  const G = window.Geo, $ = id => document.getElementById(id);
  const TARANTO = [40.4644, 17.2470], GRID_COLOUR = '#b0005a';
  const store = {
    get(k, d) { try { const v = localStorage.getItem('tmgrs.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('tmgrs.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };

  let digits = store.get('digits', 4);            // per axis: 4 = 8-figure (10 m)
  let gridOn = store.get('grid', true);
  let D = G.datums[store.get('datum', 'WGS84')] || G.datums.WGS84;   // active datum for grid and references
  const view = store.get('view', null);

  const map = L.map('map', { zoomControl: false }).setView(view ? [view[0], view[1]] : TARANTO, view ? view[2] : 13);
  const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const bases = {
    Street: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, crossOrigin: 'anonymous', attribution: OSM_ATTR }),
    // Contours and hill shading. Native tiles stop at zoom 17; closer zooms are enlarged, not sharper.
    Topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { subdomains: 'abc', maxZoom: 19, maxNativeZoom: 17,
      attribution: 'Map data: ' + OSM_ATTR + ', SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)' })
  };
  let baseName = bases[store.get('base', 'Street')] ? store.get('base', 'Street') : 'Street';
  bases[baseName].addTo(map);
  function baseUi() { $('bmap').textContent = 'Map: ' + baseName; $('bmap').classList.toggle('alt', baseName !== 'Street'); }
  $('bmap').addEventListener('click', () => {
    map.removeLayer(bases[baseName]); baseName = baseName === 'Street' ? 'Topo' : 'Street';
    bases[baseName].addTo(map).bringToBack(); store.set('base', baseName); baseUi();
  });
  baseUi();
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  const gridLayer = L.layerGroup().addTo(map), markLayer = L.layerGroup().addTo(map);

  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1600); }
  function copy(text) {
    if (D.name !== 'WGS84') text += ' (' + D.name + ')';
    try { navigator.clipboard.writeText(text).then(() => toast('Copied ' + text), () => toast('Copy not available')); }
    catch (e) { toast('Copy not available'); }
  }
  const mgrs = (ll, d) => { const m = D.toMGRS(ll.lat, ll.lng, Math.min(d === undefined ? digits : d, D.maxDigits)); return m ? m.text : 'outside MGRS'; };

  /* ---------- HUD ---------- */
  function updateCentre() { $('cv').textContent = mgrs(map.getCenter()); }
  $('rowc').addEventListener('click', () => copy($('cv').textContent));
  $('rowg').addEventListener('click', () => { if (lastFix) copy($('gpsv').textContent); });

  /* ---------- Grid overlay ---------- */
  function label(latlng, text, cls) {
    L.marker(latlng, { interactive: false, keyboard: false, icon: L.divIcon({ className: '', html: '<div class="glab ' + (cls || '') + '" style="color:' + D.labelColour + '">' + text + '</div>', iconSize: [0, 0] }) }).addTo(gridLayer);
  }
  function drawGrid() {
    gridLayer.clearLayers();
    if (!gridOn) return;
    const b = map.getBounds(), sz = map.getSize();
    const S = Math.max(b.getSouth(), -80), N = Math.min(b.getNorth(), 84), W = b.getWest(), Ea = b.getEast();
    if (S >= N || Ea - W > 18 || W < -180 || Ea > 180) return;
    const mid = (S + N) / 2, widthM = map.distance([mid, W], [mid, Ea]);
    const iv = [10, 100, 1000, 10000, 100000].find(i => widthM / i <= 10) || 100000;
    const nd = 5 - Math.round(Math.log10(iv));
    const dg = v => String(Math.floor((((v % 1e5) + 1e5) % 1e5) / iv + 1e-6)).padStart(nd, '0');
    const style = v => ({ color: D.colour, weight: Math.abs(v % (iv * 10)) < 1e-6 ? 2.2 : 1, opacity: .7, interactive: false });
    const labLat = map.containerPointToLatLng([0, sz.y - 92]).lat, topLat = map.containerPointToLatLng([0, $('hud').offsetHeight + 10]).lat, labLon = map.containerPointToLatLng([14, 0]).lng;
    const STEPS = 8;

    for (let z = D.zoneOf(mid, W); z <= D.zoneOf(mid, Ea); z++) {
      const zw = (z - 1) * 6 - 180, ze = zw + 6, w = Math.max(W, zw), e = Math.min(Ea, ze);
      if (e <= w) continue;
      let e0 = Infinity, e1 = -Infinity, n0 = Infinity, n1 = -Infinity;
      [S, mid, N].forEach(la => [w, (w + e) / 2, e].forEach(lo => {
        const u = D.toUTM(la, lo, z);
        e0 = Math.min(e0, u.e); e1 = Math.max(e1, u.e); n0 = Math.min(n0, u.n); n1 = Math.max(n1, u.n);
      }));
      const inZone = p => p.llon >= zw - 1e-9 && p.llon <= ze + 1e-9;
      const nLab = D.toUTM(labLat, (w + e) / 2, z).n;
      const eLab = labLon >= zw && labLon < ze ? D.toUTM(mid, labLon, z).e : null;

      for (let E = Math.ceil(e0 / iv) * iv; E <= e1; E += iv) {
        const pts = [];
        for (let i = 0; i <= STEPS; i++) { const p = D.fromUTM(z, E, n0 + (n1 - n0) * i / STEPS); if (inZone(p)) pts.push([p.lat, p.lon]); }
        if (pts.length > 1) L.polyline(pts, style(E)).addTo(gridLayer);
        if (iv < 1e5) { const p = D.fromUTM(z, E, nLab); if (inZone(p) && p.lon > W && p.lon < Ea) label([labLat, p.lon], dg(E)); }
      }
      for (let Nn = Math.ceil(n0 / iv) * iv; Nn <= n1; Nn += iv) {
        const pts = [];
        for (let i = 0; i <= STEPS; i++) { const p = D.fromUTM(z, e0 + (e1 - e0) * i / STEPS, Nn); if (inZone(p)) pts.push([p.lat, p.lon]); }
        if (pts.length > 1) L.polyline(pts, style(Nn)).addTo(gridLayer);
        if (iv < 1e5 && eLab !== null) { const p = D.fromUTM(z, eLab, Nn); if (p.lat > labLat && p.lat < topLat) label([p.lat, labLon], dg(Nn)); }
      }
      if (iv === 1e5) {
        for (let E = Math.floor(e0 / 1e5) * 1e5; E <= e1; E += 1e5) for (let Nn = Math.floor(n0 / 1e5) * 1e5; Nn <= n1; Nn += 1e5) {
          const p = D.fromUTM(z, E + 5e4, Nn + 5e4);
          if (!inZone(p) || !b.contains([p.lat, p.lon])) continue;
          const m = D.toMGRS(p.lat, p.lon, 0); if (m) label([p.lat, p.lon], m.sq, 'sq');
        }
      }
    }
  }

  map.on('move', updateCentre);
  map.on('moveend', () => { drawGrid(); const c = map.getCenter(); store.set('view', [c.lat, c.lng, map.getZoom()]); });

  /* ---------- Tap for a reference ---------- */
  function popupFor(latlng, title) {
    const ref = mgrs(latlng, 5);
    const el = document.createElement('div'); el.className = 'pop';
    el.innerHTML = (title ? '<div>' + title + '</div>' : '') + '<b class="mono">' + ref + '</b><span class="mono">' +
      latlng.lat.toFixed(6) + ', ' + latlng.lng.toFixed(6) + '</span><br>' +
      (D.name === 'WGS84' ? '' : '<span>Grid: ' + D.name + ' · lat/long: WGS84</span><br>');
    const btn = document.createElement('button'); btn.textContent = 'Copy grid'; btn.addEventListener('click', () => copy(ref)); el.appendChild(btn);
    L.popup({ offset: [0, -4] }).setLatLng(latlng).setContent(el).openOn(map);
  }
  map.on('click', ev => { if (routeOn) addWp(ev.latlng.lat, ev.latlng.lng); else popupFor(ev.latlng); });

  /* ---------- GPS ---------- */
  let watchId = null, follow = false, lastFix = null, dot = null, ring = null;
  function gpsUi() {
    $('bgps').classList.toggle('on', watchId !== null);
    $('bgps').textContent = watchId === null ? 'GPS' : (follow ? 'GPS ●' : 'GPS ○');
    if (watchId === null) { $('gpsv').textContent = 'off'; $('gpsv').classList.add('off'); $('gpsx').textContent = ''; }
  }
  function onFix(pos) {
    const ll = L.latLng(pos.coords.latitude, pos.coords.longitude), acc = pos.coords.accuracy;
    lastFix = ll;
    $('gpsv').classList.remove('off'); $('gpsv').textContent = mgrs(ll); $('gpsx').textContent = '± ' + Math.round(acc) + ' m';
    if (!dot) {
      ring = L.circle(ll, { radius: acc, color: '#1976d2', weight: 1, fillOpacity: .12, interactive: false }).addTo(map);
      dot = L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: '#1976d2', fillOpacity: 1, interactive: false }).addTo(map);
    } else { dot.setLatLng(ll); ring.setLatLng(ll).setRadius(acc); }
    if (follow) map.setView(ll, Math.max(map.getZoom(), 16), { animate: true });
    routeHud();
  }
  function onErr(err) {
    const why = err.code === 1 ? 'Location permission denied' : err.code === 2 ? 'No position available' : 'Position timed out';
    $('gpsv').classList.add('off'); $('gpsv').textContent = why; $('gpsx').textContent = '';
    if (err.code === 1) stopGps(true);
  }
  function stopGps(keepMsg) {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null; follow = false; lastFix = null;
    if (dot) { map.removeLayer(dot); map.removeLayer(ring); dot = ring = null; }
    const msg = $('gpsv').textContent; gpsUi(); if (keepMsg) $('gpsv').textContent = msg;
    routeHud();
  }
  $('bgps').addEventListener('click', () => {
    if (!('geolocation' in navigator)) { toast('No location service in this browser'); return; }
    if (watchId === null) {
      follow = true; $('gpsv').classList.add('off'); $('gpsv').textContent = 'acquiring…';
      watchId = navigator.geolocation.watchPosition(onFix, onErr, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
    } else if (!follow) { follow = true; if (lastFix) map.setView(lastFix, Math.max(map.getZoom(), 16)); }
    else { stopGps(); return; }
    gpsUi();
  });
  map.on('dragstart', () => { if (follow) { follow = false; gpsUi(); } });

  /* ---------- Go to grid ---------- */
  function closeGoto() { $('goto').classList.remove('show'); $('gin').blur(); }
  $('bgo').addEventListener('click', () => { $('gerr').textContent = ''; $('goto').classList.add('show'); $('gin').focus(); $('gin').select(); });
  $('gcancel').addEventListener('click', closeGoto);
  $('gform').addEventListener('submit', ev => {
    ev.preventDefault();
    const c = map.getCenter(), ctx = D.toMGRS(c.lat, c.lng, 0);
    let cell;
    try { cell = D.parseMGRS($('gin').value, ctx || undefined); } catch (e) { $('gerr').textContent = e.message; return; }
    closeGoto(); follow = false; gpsUi();
    markLayer.clearLayers();
    L.polygon(cell.corners, { color: '#ff6f00', weight: 2, fillOpacity: .15, interactive: false }).addTo(markLayer);
    const zoom = cell.size >= 1e5 ? 9 : cell.size >= 1e4 ? 12 : cell.size >= 1e3 ? 15 : cell.size >= 100 ? 17 : 19;
    const ll = L.latLng(cell.lat, cell.lon);
    map.setView(ll, zoom);
    popupFor(ll, 'Centre of the ' + (cell.size >= 1000 ? cell.size / 1000 + ' km' : cell.size + ' m') + ' square');
  });

  /* ---------- Route: waypoints, leg distances, grid bearings ---------- */
  let route = store.get('route', []), routeOn = false, rline = null, clearArmed = 0;
  const routeLayer = L.layerGroup().addTo(map);
  const fmtD = m => m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.round(m) + ' m';
  function gridBrg(p, q) {               // bearing from grid north, in the UTM zone of the leg's start point
    const z = D.zoneOf(p[0], p[1]), u = D.toUTM(p[0], p[1], z), v = D.toUTM(q[0], q[1], z);
    const d = Math.atan2(v.e - u.e, v.n - u.n) * 180 / Math.PI;
    return String(Math.round(d + 360) % 360).padStart(3, '0') + '°';
  }
  function legs() {
    let tot = 0;
    const rows = route.map((p, i) => {
      const d = i ? G.distance(route[i - 1][0], route[i - 1][1], p[0], p[1]) : 0; tot += d;
      return { i: i, ref: mgrs({ lat: p[0], lng: p[1] }), d: d, b: i ? gridBrg(route[i - 1], p) : '', cum: tot };
    });
    return { rows: rows, tot: tot };
  }
  function progress(ll, L) {              // nearest point on the route: distance off it and distance left along it
    let best = null;
    for (let i = 1; i < route.length; i++) {
      const p = route[i - 1], q = route[i], z = D.zoneOf(p[0], p[1]);
      const A = D.toUTM(p[0], p[1], z), B = D.toUTM(q[0], q[1], z), P = D.toUTM(ll.lat, ll.lng, z);
      const dx = B.e - A.e, dy = B.n - A.n, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((P.e - A.e) * dx + (P.n - A.n) * dy) / l2)) : 0;
      const off = Math.hypot(P.e - (A.e + t * dx), P.n - (A.n + t * dy));
      if (!best || off < best.off) best = { off: off, rem: L.tot - (L.rows[i - 1].cum + t * L.rows[i].d) };
    }
    return best;
  }
  function routeHud(L) {
    if (route.length < 2) { $('rowr').classList.remove('show'); return; }
    L = L || legs();
    let t = fmtD(L.tot);
    if (lastFix) { const p = progress(lastFix, L); t += ' · left ' + fmtD(p.rem) + ' · off ' + fmtD(p.off); }
    $('rv').textContent = t; $('rowr').classList.add('show');
  }
  function renderPanel() {
    const L = legs();
    $('rhint').style.display = route.length ? 'none' : 'block';
    $('rtab').innerHTML = !route.length ? '' : '<tr><th>#</th><th>Grid</th><th>Leg</th><th>Brg (grid)</th><th>Total</th></tr>' +
      L.rows.map(r => '<tr><td>' + (r.i + 1) + '</td><td class="mono">' + r.ref + '</td><td>' + (r.i ? fmtD(r.d) : '–') + '</td><td>' +
        (r.i ? r.b : '–') + '</td><td>' + fmtD(r.cum) + '</td></tr>').join('');
    routeHud(L);
  }
  function drawRoute() {
    routeLayer.clearLayers();
    rline = L.polyline(route, { color: '#ff6f00', weight: 4, opacity: .9, interactive: false }).addTo(routeLayer);
    route.forEach((p, i) => {
      const m = L.marker(p, { draggable: routeOn, interactive: routeOn, keyboard: false,
        icon: L.divIcon({ className: '', html: '<div class="wp">' + (i + 1) + '</div>', iconSize: [0, 0] }) }).addTo(routeLayer);
      m.on('drag', () => { const ll = m.getLatLng(); route[i] = [ll.lat, ll.lng]; rline.setLatLngs(route); renderPanel(); });
      m.on('dragend', () => store.set('route', route));
    });
    renderPanel();
  }
  function addWp(lat, lon) { route.push([lat, lon]); store.set('route', route); drawRoute(); }

  $('broute').addEventListener('click', () => {
    routeOn = !routeOn; $('broute').classList.toggle('on', routeOn);
    $('rpanel').style.bottom = $('bar').offsetHeight + 'px'; $('rpanel').classList.toggle('show', routeOn);
    map.closePopup(); drawRoute();
  });
  $('radd').addEventListener('click', () => { const c = map.getCenter(); addWp(c.lat, c.lng); });
  $('rundo').addEventListener('click', () => { if (route.length) { route.pop(); store.set('route', route); drawRoute(); } });
  $('rclear').addEventListener('click', () => {
    if (!route.length) return;
    if (Date.now() - clearArmed < 3000) { route = []; clearArmed = 0; $('rclear').textContent = 'Clear'; store.set('route', route); drawRoute(); }
    else { clearArmed = Date.now(); $('rclear').textContent = 'Sure?'; setTimeout(() => { $('rclear').textContent = 'Clear'; }, 3000); }
  });
  const closeList = () => { $('rlist').classList.remove('show'); $('rin').blur(); };
  $('rgrids').addEventListener('click', () => { $('rerr').textContent = ''; $('rlist').classList.add('show'); $('rin').focus(); });
  $('rcancel').addEventListener('click', closeList);
  $('rform').addEventListener('submit', ev => {
    ev.preventDefault();
    const c = map.getCenter(), ctx = D.toMGRS(c.lat, c.lng, 0) || undefined;
    const lines = $('rin').value.split(/[\n,;]+/).map(x => x.trim()).filter(Boolean), pts = [];
    if (!lines.length) { $('rerr').textContent = 'Enter at least one reference'; return; }
    for (let i = 0; i < lines.length; i++) {
      try { const cell = D.parseMGRS(lines[i], ctx); pts.push([cell.lat, cell.lon]); }
      catch (e) { $('rerr').textContent = 'Line ' + (i + 1) + ' (' + lines[i] + '): ' + e.message; return; }
    }
    route = route.concat(pts); store.set('route', route); $('rin').value = ''; closeList(); drawRoute();
    follow = false; gpsUi();
    if (route.length > 1) map.fitBounds(L.latLngBounds(route), { paddingTopLeft: [30, 110], paddingBottomRight: [30, 260] }); else map.setView(route[0], 15);
  });

  /* ---------- Precision and grid toggles ---------- */
  function digUi() { const d = Math.min(digits, D.maxDigits); $('bdig').textContent = d * 2 + ' fig'; $('cx').textContent = D.name + ' · ' + ['100 km', '10 km', '1 km', '100 m', '10 m', '1 m'][d]; }
  $('bdig').addEventListener('click', () => {
    digits = digits >= D.maxDigits ? 2 : digits + 1; store.set('digits', digits); digUi(); updateCentre();
    if (lastFix) $('gpsv').textContent = mgrs(lastFix);
    renderPanel();
  });
  $('bgrid').addEventListener('click', () => { gridOn = !gridOn; store.set('grid', gridOn); $('bgrid').classList.toggle('on', gridOn); drawGrid(); });

  /* ---------- Instructions and limits: shown until acknowledged, and again when the text changes ---------- */
  const INFO_VERSION = 1;
  function infoUi(first) { $('iok').textContent = first ? 'I understand' : 'Close'; $('info').classList.add('show'); $('info').scrollTop = 0; }
  $('binfo').addEventListener('click', () => infoUi(false));
  $('iok').addEventListener('click', () => { store.set('ack', INFO_VERSION); $('info').classList.remove('show'); });
  if (store.get('ack', 0) !== INFO_VERSION) infoUi(true);

  /* ---------- Datum switch ---------- */
  function datUi() {
    const alt = D.name !== 'WGS84';
    $('bdat').textContent = D.name; $('bdat').classList.toggle('alt', alt); $('hud').classList.toggle('alt', alt);
    $('gdat').textContent = D.name; $('rdat').textContent = D.name;
  }
  $('bdat').addEventListener('click', () => {
    D = G.datums[D.name === 'WGS84' ? 'ED50' : 'WGS84']; store.set('datum', D.name);
    map.closePopup(); datUi(); digUi(); updateCentre();
    if (lastFix) $('gpsv').textContent = mgrs(lastFix);
    drawGrid(); renderPanel(); toast('Datum: ' + D.name);
  });

  $('bgrid').classList.toggle('on', gridOn); datUi(); digUi(); gpsUi(); updateCentre(); drawGrid(); drawRoute();

  if ('serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* offline cache unavailable */ }); });
})();
