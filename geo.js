/* WGS84 <-> UTM <-> MGRS. Krueger series (order 3), sub-millimetre inside a zone.
   Limits: no Norway/Svalbard zone exceptions, no polar (UPS) areas. */
(function (g) {
  'use strict';
  const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996, n = f / (2 - f);
  const A = a / (1 + n) * (1 + n * n / 4 + Math.pow(n, 4) / 64);
  const al = [n / 2 - 2 * n * n / 3 + 5 * n ** 3 / 16, 13 * n * n / 48 - 3 * n ** 3 / 5, 61 * n ** 3 / 240];
  const be = [n / 2 - 2 * n * n / 3 + 37 * n ** 3 / 96, n * n / 48 + n ** 3 / 15, 17 * n ** 3 / 480];
  const de = [2 * n - 2 * n * n / 3 - 2 * n ** 3, 7 * n * n / 3 - 8 * n ** 3 / 5, 56 * n ** 3 / 15];
  const R = Math.PI / 180, c2 = 2 * Math.sqrt(n) / (1 + n);
  const BANDS = 'CDEFGHJKLMNPQRSTUVWX';
  const COLS = ['ABCDEFGH', 'JKLMNPQR', 'STUVWXYZ'];
  const ROWS = 'ABCDEFGHJKLMNPQRSTUV';

  function zoneOf(lon) { return Math.min(60, Math.max(1, Math.floor((lon + 180) / 6) + 1)); }

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

  function bandOf(lat) { return BANDS[Math.min(19, Math.floor((lat + 80) / 8))]; }

  // digits = 0..5 per axis (5 = 1 m). Values are truncated, per MGRS convention.
  function toMGRS(lat, lon, digits) {
    if (!(lat >= -80 && lat <= 84) || !(lon >= -180 && lon <= 180)) return null;
    if (digits === undefined) digits = 5;
    const u = toUTM(lat, lon), N = u.n < 0 ? u.n + 1e7 : u.n;
    const ci = Math.floor(u.e / 1e5) - 1;
    if (ci < 0 || ci > 7) return null;
    const col = COLS[(u.zone - 1) % 3][ci];
    const row = ROWS[(Math.floor(N / 1e5) + (u.zone % 2 ? 0 : 5)) % 20];
    const p = Math.pow(10, 5 - digits);
    const e = String(Math.floor((u.e % 1e5) / p)).padStart(digits, '0');
    const nn = String(Math.floor((N % 1e5) / p)).padStart(digits, '0');
    return {
      gzd: String(u.zone).padStart(2, '0') + bandOf(lat), sq: col + row,
      e: digits ? e : '', n: digits ? nn : '',
      text: String(u.zone).padStart(2, '0') + bandOf(lat) + ' ' + col + row + (digits ? ' ' + e + ' ' + nn : '')
    };
  }

  // ctx: optional {gzd, sq} used to complete a short entry (digits only, or square + digits).
  // Returns the grid cell: centre, size in metres and its four corners. Throws on bad input.
  function parseMGRS(str, ctx) {
    let s = String(str).toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (ctx && /^\d+$/.test(s) && s.length % 2 === 0 && s.length >= 2 && s.length <= 10) s = ctx.gzd + ctx.sq + s;
    else if (ctx && /^[A-Z]{2}\d*$/.test(s)) s = ctx.gzd + s;
    const m = /^(\d{1,2})([C-HJ-NP-X])([A-HJ-NP-Z])([A-HJ-NP-V])(\d*)$/.exec(s);
    if (!m) throw new Error('Not a valid MGRS reference');
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
    return {
      lat: best.c.lat, lon: best.c.lon, size: size,
      corners: [q(E, best.raw), q(E + size, best.raw), q(E + size, best.raw + size), q(E, best.raw + size)]
    };
  }

  g.Geo = { zoneOf: zoneOf, toUTM: toUTM, fromUTM: fromUTM, toMGRS: toMGRS, parseMGRS: parseMGRS };
})(typeof window !== 'undefined' ? window : globalThis);
