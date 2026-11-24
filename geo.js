/* WGS84 and ED50 <-> UTM <-> MGRS. Krueger series (order 3), sub-millimetre inside a zone.
   ED50: International 1924 ellipsoid, geocentric translation EPSG:1133 'ED50 to WGS 84 (1)'
   (-87, -98, -121 m; DMA TR8350.2; area of use includes Italy; stated accuracy 10 m).
   100 km square letters use the standard (AA) scheme on both datums.
   Limits: no Norway/Svalbard zone exceptions, no polar (UPS) areas. */
(function (g) {
  'use strict';
  const k0 = 0.9996, R = Math.PI / 180;
  const BANDS = 'CDEFGHJKLMNPQRSTUVWX';
  const COLS = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'];
  const ROWS = 'ABCDEFGHJKLMNPQRSTUV';

  function zoneOf(lon) { return Math.min(60, Math.max(1, Math.floor((lon + 180) / 6) + 1)); }
  function bandOf(lat) { return BANDS[Math.min(19, Math.floor((lat + 80) / 8))]; }

  // All functions returned here work in the ellipsoid's own (datum-local) latitude and longitude.
  function ellipsoid(a, invf) {
    const f = 1 / invf, n = f / (2 - f);
    const A = a / (1 + n) * (1 + n * n / 4 + Math.pow(n, 4) / 64);
    const al = [n / 2 - 2 * n * n / 3 + 5 * n ** 3 / 16, 13 * n * n / 48 - 3 * n ** 3 / 5, 61 * n ** 3 / 240];
    const be = [n / 2 - 2 * n * n / 3 + 37 * n ** 3 / 96, n * n / 48 + n ** 3 / 15, 17 * n ** 3 / 480];
    const de = [2 * n - 2 * n * n / 3 - 2 * n ** 3, 7 * n * n / 3 - 8 * n ** 3 / 5, 56 * n ** 3 / 15];
    const c2 = 2 * Math.sqrt(n) / (1 + n);

    // Northing is returned raw: negative south of the equator (no false northing).
    function toUTM(lat, lon, zone) {
      zone = zone || zoneOf(lon);
      const l0 = ((zone - 1) * 6 - 177) * R, s = Math.sin(lat * R), dl = lon * R - l0;
      const t = Math.sinh(Math.atanh(s) - c2 * Math.atanh(c2 * s));
      const xi = Math.atan2(t, Math.cos(dl)), eta = Math.atanh(Math.sin(dl) / Math.sqrt(1 + t * t));
      let E = eta, N = xi;
      for (let j = 1; j <= 3; j++) {
        E += al[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
        N += al[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
      }
      return { zone: zone, e: 500000 + k0 * A * E, n: k0 * A * N };
    }

    function fromUTM(zone, e, nRaw) {
      const xi = nRaw / (k0 * A), eta = (e - 500000) / (k0 * A);
      let x = xi, h = eta;
      for (let j = 1; j <= 3; j++) {
        x -= be[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
        h -= be[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
      }
      const chi = Math.asin(Math.sin(x) / Math.cosh(h));
      let phi = chi;
      for (let j = 1; j <= 3; j++) phi += de[j - 1] * Math.sin(2 * j * chi);
      const lam = ((zone - 1) * 6 - 177) * R + Math.atan2(Math.sinh(h), Math.cos(x));
      return { lat: phi / R, lon: lam / R };
    }

    // digits = 0..5 per axis (5 = 1 m). Values are truncated, per MGRS convention.
    function toMGRS(lat, lon, digits) {
      if (!(lat >= -80 && lat <= 84) || !(lon >= -180 && lon <= 180)) return null;
      if (digits === undefined) digits = 5;
      const u = toUTM(lat, lon);
      u.e += 1e-3; u.n += 1e-3;                  // 1 mm guard so a square's centre does not truncate one digit low
      const N = u.n < 0 ? u.n + 1e7 : u.n;
      const ci = Math.floor(u.e / 1e5) - 1;
      if (ci < 0 || ci > 7) return null;
      const col = COLS[(u.zone - 1) % 3][ci];
      const row = ROWS[(Math.floor(N / 1e5) + (u.zone % 2 ? 0 : 5)) % 20];
      const p = Math.pow(10, 5 - digits);
      const e = String(Math.floor((u.e % 1e5) / p)).padStart(digits, '0');
      const nn = String(Math.floor((N % 1e5) / p)).padStart(digits, '0');
      const gzd = String(u.zone).padStart(2, '0') + bandOf(lat);
      return { gzd: gzd, sq: col + row, e: digits ? e : '', n: digits ? nn : '',
        text: gzd + ' ' + col + row + (digits ? ' ' + e + ' ' + nn : '') };
    }

    // ctx: optional {gzd, sq} used to complete a short entry (digits only, or square + digits).
    // Returns the grid cell: centre, size in metres and its four corners. Throws on bad input.
    function parseMGRS(str, ctx) {
      let s = String(str).toUpperCase().replace(/[^0-9A-Z]/g, '');
      if (ctx && /^\d+$/.test(s) && s.length % 2 === 0 && s.length >= 2 && s.length <= 10) s = ctx.gzd + ctx.sq + s;
      else if (ctx && /^[A-Z]{2}\d*$/.test(s)) s = ctx.gzd + s;
      const m = /^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z])([A-HJ-NP-V])(\d*)$/.exec(s);
      if (!m) throw new Error('Not a valid grid reference');
      const zone = +m[1], band = m[2], d = m[5].length / 2;
      if (zone < 1 || zone > 60) throw new Error('Zone must be 1 to 60');
      if (m[5].length % 2 || d > 5) throw new Error('Digits must be an even count, up to 10');
      const ci = COLS[(zone - 1) % 3].indexOf(m[3]);
      if (ci < 0) throw new Error('Square ' + m[3] + m[4] + ' does not exist in zone ' + zone);
      const size = Math.pow(10, 5 - d);
      const E = (ci + 1) * 1e5 + (d ? +m[5].slice(0, d) * size : 0);
      const ri = (ROWS.indexOf(m[4]) - (zone % 2 ? 0 : 5) + 20) % 20;
      const base = ri * 1e5 + (d ? +m[5].slice(d) * size : 0);
      const south = band < 'N', bandMid = -80 + 8 * BANDS.indexOf(band) + (band === 'X' ? 6 : 4);
      let best = null;
      for (let k = 0; k < 5; k++) {
        const raw = base + k * 2e6 - (south ? 1e7 : 0);
        const c = fromUTM(zone, E + size / 2, raw + size / 2), sc = Math.abs(c.lat - bandMid);
        if (!best || sc < best.sc) best = { sc: sc, raw: raw, c: c };
      }
      const chk = toMGRS(best.c.lat, best.c.lon, 0);
      if (!chk || chk.gzd !== String(zone).padStart(2, '0') + band || chk.sq !== m[3] + m[4])
        throw new Error('Square ' + m[3] + m[4] + ' does not exist in ' + zone + band);
      const q = (x, y) => { const p = fromUTM(zone, x, y); return [p.lat, p.lon]; };
      return { lat: best.c.lat, lon: best.c.lon, size: size,
        corners: [q(E, best.raw), q(E + size, best.raw), q(E + size, best.raw + size), q(E, best.raw + size)] };
    }

    return { a: a, f: f, toUTM: toUTM, fromUTM: fromUTM, toMGRS: toMGRS, parseMGRS: parseMGRS };
  }

  const WGS = ellipsoid(6378137, 298.257223563), INTL = ellipsoid(6378388, 297);

  // Geodetic position on ellipsoid 'from' -> on ellipsoid 'to', adding d (metres) to the geocentric X, Y, Z. Height taken as 0.
  function shift(lat, lon, from, to, d) {
    const e2 = from.f * (2 - from.f), s = Math.sin(lat * R), c = Math.cos(lat * R), N = from.a / Math.sqrt(1 - e2 * s * s);
    const X = N * c * Math.cos(lon * R) + d[0], Y = N * c * Math.sin(lon * R) + d[1], Z = N * (1 - e2) * s + d[2];
    const e2b = to.f * (2 - to.f), p = Math.hypot(X, Y);
    let phi = Math.atan2(Z, p * (1 - e2b));
    for (let i = 0; i < 6; i++) { const sp = Math.sin(phi); phi = Math.atan2(Z + e2b * to.a / Math.sqrt(1 - e2b * sp * sp) * sp, p); }
    return { lat: phi / R, lon: Math.atan2(Y, X) / R };
  }

  // A datum takes and returns WGS84 latitude/longitude; grid values are in the datum itself.
  // toWgs84: geocentric translation from the datum to WGS84 (null for WGS84).
  function datum(name, el, toWgs84, maxDigits, colour, labelColour) {
    const d = toWgs84, same = (lat, lon) => ({ lat: lat, lon: lon });
    const toLocal = d ? (lat, lon) => shift(lat, lon, WGS, el, [-d[0], -d[1], -d[2]]) : same;
    const toWgs = d ? (lat, lon) => shift(lat, lon, el, WGS, d) : same;
    return {
      name: name, maxDigits: maxDigits, colour: colour, labelColour: labelColour, toLocal: toLocal, toWgs: toWgs,
      zoneOf: (lat, lon) => zoneOf(toLocal(lat, lon).lon),
      toUTM: (lat, lon, zone) => { const p = toLocal(lat, lon); return el.toUTM(p.lat, p.lon, zone); },
      // llon = longitude in the datum itself, for zone-boundary tests
      fromUTM: (zone, e, n) => { const p = el.fromUTM(zone, e, n), w = toWgs(p.lat, p.lon); return { lat: w.lat, lon: w.lon, llon: p.lon }; },
      toMGRS: (lat, lon, digits) => { const p = toLocal(lat, lon); return el.toMGRS(p.lat, p.lon, digits); },
      parseMGRS: (str, ctx) => {
        const c = el.parseMGRS(str, ctx), w = toWgs(c.lat, c.lon);
        return { lat: w.lat, lon: w.lon, size: c.size, corners: c.corners.map(q => { const x = toWgs(q[0], q[1]); return [x.lat, x.lon]; }) };
      }
    };
  }

  // Ellipsoidal distance in metres (Vincenty inverse, WGS84).
  function distance(lat1, lon1, lat2, lon2) {
    if (lat1 === lat2 && lon1 === lon2) return 0;
    const a = WGS.a, f = WGS.f, b = a * (1 - f), L = (lon2 - lon1) * R;
    const U1 = Math.atan((1 - f) * Math.tan(lat1 * R)), U2 = Math.atan((1 - f) * Math.tan(lat2 * R));
    const sU1 = Math.sin(U1), cU1 = Math.cos(U1), sU2 = Math.sin(U2), cU2 = Math.cos(U2);
    let lam = L, sS = 0, cS = 0, sig = 0, c2A = 0, c2m = 0;
    for (let i = 0; i < 100; i++) {
      const sl = Math.sin(lam), cl = Math.cos(lam);
      sS = Math.sqrt(Math.pow(cU2 * sl, 2) + Math.pow(cU1 * sU2 - sU1 * cU2 * cl, 2));
      if (sS === 0) return 0;
      cS = sU1 * sU2 + cU1 * cU2 * cl; sig = Math.atan2(sS, cS);
      const sA = cU1 * cU2 * sl / sS; c2A = 1 - sA * sA; c2m = c2A ? cS - 2 * sU1 * sU2 / c2A : 0;
      const C = f / 16 * c2A * (4 + f * (4 - 3 * c2A)), prev = lam;
      lam = L + (1 - C) * f * sA * (sig + C * sS * (c2m + C * cS * (-1 + 2 * c2m * c2m)));
      if (Math.abs(lam - prev) < 1e-12) break;
    }
    const u2 = c2A * (a * a - b * b) / (b * b);
    const AA = 1 + u2 / 16384 * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
    const BB = u2 / 1024 * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
    const dS = BB * sS * (c2m + BB / 4 * (cS * (-1 + 2 * c2m * c2m) - BB / 6 * c2m * (-3 + 4 * sS * sS) * (-3 + 4 * c2m * c2m)));
    return b * AA * (sig - dS);
  }

  g.Geo = {
    distance: distance,
    datums: {
      WGS84: datum('WGS84', WGS, null, 5, '#b0005a', '#8a0046'),
      ED50: datum('ED50', INTL, [-87, -98, -121], 4, '#0b57d0', '#0842a0')
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
