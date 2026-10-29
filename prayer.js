// Gebetszeiten-Berechnung (astronomisches Standardverfahren, vgl. praytimes.org)
// Ergebnis: Date-Objekte in lokaler Zeit des Geräts.
(function (root) {
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const sin = d => Math.sin(rad(d)), cos = d => Math.cos(rad(d)), tan = d => Math.tan(rad(d));
  const asin = x => deg(Math.asin(x)), acos = x => deg(Math.acos(x)), atan2 = (y, x) => deg(Math.atan2(y, x));
  const acot = x => deg(Math.atan(1 / x));
  const fix = (a, b) => { a = a - b * Math.floor(a / b); return a < 0 ? a + b : a; };

  const METHODS = {
    diyanet: { name: 'Diyanet (Türkei)', fajr: 18, isha: 17, adj: { sunrise: -7, dhuhr: 5, asr: 4, maghrib: 7, isha: 0 } },
    mwl:     { name: 'Muslim World League', fajr: 18, isha: 17, adj: { dhuhr: 1 } },
    isna:    { name: 'ISNA (Nordamerika)', fajr: 15, isha: 15, adj: { dhuhr: 1 } },
    uoif:    { name: 'UOIF (Frankreich)', fajr: 12, isha: 12, adj: { dhuhr: 1 } },
  };

  function julian(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  function sunPos(jd) {
    const D = jd - 2451545.0;
    const g = fix(357.529 + 0.98560028 * D, 360);
    const q = fix(280.459 + 0.98564736 * D, 360);
    const L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
    const e = 23.439 - 0.00000036 * D;
    const RA = atan2(cos(e) * sin(L), cos(L)) / 15;
    return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - fix(RA, 24) };
  }

  function compute(date, lat, lng, methodKey, hanafi) {
    const m = METHODS[methodKey] || METHODS.diyanet;
    const y = date.getFullYear(), mo = date.getMonth() + 1, d = date.getDate();
    const tz = -new Date(y, mo - 1, d, 12).getTimezoneOffset() / 60;
    const jd = julian(y, mo, d) - lng / (15 * 24);

    const midDay = t => fix(12 - sunPos(jd + t).eqt, 24);
    const angleTime = (angle, t, ccw) => {
      const decl = sunPos(jd + t).decl, noon = midDay(t);
      const T = acos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
      return noon + (ccw ? -T : T);
    };
    const asrTime = (factor, t) => {
      const decl = sunPos(jd + t).decl;
      return angleTime(-acot(factor + tan(Math.abs(lat - decl))), t);
    };

    // Startwerte, dann eine Verfeinerung mit Tagesanteil
    let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, maghrib: 18, isha: 18 };
    for (let i = 0; i < 2; i++) {
      const p = k => t[k] / 24;
      t = {
        fajr: angleTime(m.fajr, p('fajr'), true),
        sunrise: angleTime(0.833, p('sunrise'), true),
        dhuhr: midDay(p('dhuhr')),
        asr: asrTime(hanafi ? 2 : 1, p('asr')),
        maghrib: angleTime(0.833, p('maghrib')),
        isha: angleTime(m.isha, p('isha')),
      };
    }
    // Hohe Breiten (z. B. Sommer in Deutschland): Winkel-basierte Begrenzung
    const night = fix(t.sunrise - t.maghrib, 24);
    const limit = (time, base, angle, ccw) => {
      const portion = angle / 60 * night;
      const diff = ccw ? fix(base - time, 24) : fix(time - base, 24);
      return (isNaN(time) || diff > portion) ? base + (ccw ? -portion : portion) : time;
    };
    t.fajr = limit(t.fajr, t.sunrise, m.fajr, true);
    t.isha = limit(t.isha, t.maghrib, m.isha, false);

    const out = {};
    for (const k of Object.keys(t)) {
      const h = t[k] + tz - lng / 15 + ((m.adj[k] || 0) / 60);
      const ms = Math.round(h * 3600) * 1000;
      out[k] = new Date(y, mo - 1, d, 0, 0, 0, ms);
    }
    return out;
  }

  root.PrayerCalc = { compute, METHODS };
})(typeof window !== 'undefined' ? window : globalThis);
