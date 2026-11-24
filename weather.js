// Vejr via Open-Meteo (gratis, ingen nøgle, virker direkte fra browseren).
// Hver kilde er en vejrmodel fra en national vejrtjeneste.

export const MODELS = [
  { id: 'dmi_seamless', name: 'DMI', desc: 'DMI HARMONIE, 2 km opløsning. De første 2,5 døgn er DMI, derefter suppleret med ECMWF.' },
  { id: 'metno_seamless', name: 'Yr / MET Norge', desc: 'Den norske vejrtjeneste (bruges af Yr), MET Nordic-modellen.' },
  { id: 'icon_seamless', name: 'DWD (Tyskland)', desc: 'Den tyske vejrtjeneste, ICON-modellen.' },
  { id: 'ecmwf_ifs025', name: 'ECMWF', desc: 'Det europæiske vejrcenter, global model.' },
  { id: 'best_match', name: 'Bedste match', desc: 'Open-Meteo vælger selv den bedste model for stedet.' }
];
export const modelName = (id) => (MODELS.find((m) => m.id === id) || MODELS[0]).name;

const cache = {};

export async function getForecast(lat, lon, model) {
  const key = `${lat},${lon},${model}`;
  const c = cache[key];
  if (c && Date.now() - c.t < 15 * 60000) return c.data;
  const p = new URLSearchParams({
    latitude: lat, longitude: lon, timezone: 'Europe/Copenhagen', wind_speed_unit: 'ms', forecast_days: '7',
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,precipitation,is_day,relative_humidity_2m',
    hourly: 'temperature_2m,precipitation,precipitation_probability,weather_code,is_day',
    minutely_15: 'temperature_2m,precipitation,weather_code,is_day', forecast_minutely_15: '64',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset'
  });
  if (model && model !== 'best_match') p.set('models', model);
  const res = await fetch('https://api.open-meteo.com/v1/forecast?' + p.toString());
  if (!res.ok) throw new Error(`Vejret svarede ${res.status}`);
  const j = await res.json();
  const now = Date.now();
  const hours = j.hourly.time.map((t, i) => ({
    time: new Date(t), temp: j.hourly.temperature_2m[i], rain: j.hourly.precipitation[i],
    prob: j.hourly.precipitation_probability ? j.hourly.precipitation_probability[i] : null,
    code: j.hourly.weather_code[i], isDay: j.hourly.is_day ? j.hourly.is_day[i] : 1
  })).filter((h) => h.time.getTime() > now - 3600000 && h.temp !== null);
  // Kvarterer (15 min) til vejrkortets korte intervaller – beregnes ud fra timeværdierne, hvor kilden ikke har dem
  const m = j.minutely_15;
  const quarters = m && m.time ? m.time.map((t, i) => ({
    time: new Date(t), temp: m.temperature_2m[i], rain: m.precipitation ? m.precipitation[i] : 0,
    code: m.weather_code ? m.weather_code[i] : null, isDay: m.is_day ? m.is_day[i] : null
  })).filter((q) => q.time.getTime() > now - 15 * 60000 && q.temp !== null) : [];
  quarters.forEach((q) => {
    const h = hours.find((x) => x.time.getTime() <= q.time.getTime() && q.time.getTime() < x.time.getTime() + 3600000);
    if (q.code === null || q.code === undefined) q.code = h ? h.code : 0;
    if (q.isDay === null || q.isDay === undefined) q.isDay = h ? h.isDay : 1;
  });
  const days = j.daily.time.map((t, i) => ({
    date: new Date(t + 'T12:00'), code: j.daily.weather_code[i], max: j.daily.temperature_2m_max[i], min: j.daily.temperature_2m_min[i],
    rain: j.daily.precipitation_sum[i], prob: j.daily.precipitation_probability_max ? j.daily.precipitation_probability_max[i] : null,
    wind: j.daily.wind_speed_10m_max[i], sunrise: new Date(j.daily.sunrise[i]), sunset: new Date(j.daily.sunset[i])
  })).filter((d) => d.max !== null);
  const cur = j.current;
  const data = {
    model, fetched: new Date(),
    now: { temp: cur.temperature_2m, feels: cur.apparent_temperature, code: cur.weather_code, wind: cur.wind_speed_10m, windDir: cur.wind_direction_10m, rain: cur.precipitation, isDay: cur.is_day, humidity: cur.relative_humidity_2m },
    hours, quarters, days
  };
  cache[key] = { t: Date.now(), data };
  return data;
}

export async function geocode(q) {
  const res = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=6&language=da&name=' + encodeURIComponent(q));
  if (!res.ok) throw new Error('Søgning fejlede');
  const j = await res.json();
  return (j.results || []).map((r) => ({ name: r.name, area: [r.admin1, r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude }));
}

const TEXT = {
  0: 'Klart', 1: 'Overvejende klart', 2: 'Delvis skyet', 3: 'Overskyet', 45: 'Tåge', 48: 'Rimtåge',
  51: 'Let støvregn', 53: 'Støvregn', 55: 'Tæt støvregn', 56: 'Isslag', 57: 'Isslag',
  61: 'Let regn', 63: 'Regn', 65: 'Kraftig regn', 66: 'Isslag', 67: 'Kraftigt isslag',
  71: 'Let sne', 73: 'Sne', 75: 'Kraftig sne', 77: 'Snekorn', 80: 'Lette byger', 81: 'Regnbyger', 82: 'Kraftige byger',
  85: 'Snebyger', 86: 'Kraftige snebyger', 95: 'Torden', 96: 'Torden med hagl', 99: 'Torden med hagl'
};
export const codeText = (c) => TEXT[c] || '–';

function kind(c, isDay) {
  if (c <= 1) return isDay ? 'sun' : 'moon';
  if (c === 2) return isDay ? 'partly' : 'partlyNight';
  if (c === 3) return 'cloud';
  if (c === 45 || c === 48) return 'fog';
  if (c >= 51 && c <= 57) return 'drizzle';
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return 'rain';
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if (c >= 95) return 'thunder';
  return 'cloud';
}

const CLOUD = 'M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 18z';
const SMALL_CLOUD = 'M9 20h8a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.6A2.7 2.7 0 0 0 9 20z';

export function weatherIcon(code, isDay = 1, size = 40) {
  const k = kind(code, isDay);
  const sun = '<circle cx="12" cy="12" r="4" fill="var(--warn)" stroke="none"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="var(--warn)"/>';
  const smallSun = '<circle cx="8" cy="8" r="3.2" fill="var(--warn)" stroke="none"/><path d="M8 1.8v1.4M1.8 8h1.4M3.6 3.6l1 1M12.4 3.6l-1 1" stroke="var(--warn)"/>';
  const moon = '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="var(--muted)" stroke="none"/>';
  const smallMoon = '<path d="M13 9.5A5 5 0 0 1 6.5 3a5 5 0 1 0 6.5 6.5z" fill="var(--muted)" stroke="none"/>';
  const drops = (n, d) => Array.from({ length: n }, (_, i) => `<path d="M${8 + i * 4} 20l-1 ${d}" stroke="var(--accent)"/>`).join('');
  const body = {
    sun, moon,
    partly: smallSun + `<path d="${SMALL_CLOUD}"/>`,
    partlyNight: smallMoon + `<path d="${SMALL_CLOUD}"/>`,
    cloud: `<path d="${CLOUD}"/>`,
    fog: '<path d="M4 9h16M3 13h18M5 17h14"/>',
    drizzle: '<path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 15z"/>' + drops(3, 1.5),
    rain: '<path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 15z"/>' + drops(3, 3),
    snow: '<path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 15z"/><circle cx="8" cy="19" r="1" fill="var(--text)"/><circle cx="12" cy="21" r="1" fill="var(--text)"/><circle cx="16" cy="19" r="1" fill="var(--text)"/>',
    thunder: '<path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 2A3 3 0 0 0 7 15z"/><path d="M12 14l-2 4h3l-2 4" stroke="var(--warn)"/>'
  }[k];
  return `<svg class="wicon" aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="var(--text)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

export const windDirText = (deg) => ['N', 'NØ', 'Ø', 'SØ', 'S', 'SV', 'V', 'NV'][Math.round(((deg % 360) / 45)) % 8];
