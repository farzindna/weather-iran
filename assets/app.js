/* هوای ایران — نقشه‌ی زنده‌ی بارش و ابر
   داده: Open-Meteo (بدون کلید) · سه مدل عددی مستقل
   ECMWF IFS (اروپا) · GFS (آمریکا) · ICON (آلمان) */
'use strict';

/* ══════════ پیکربندی ══════════ */

const CITIES = [
  // مختصات با geocoding API خود Open-Meteo تأیید شده‌اند
  { id:'tehran',   fa:'تهران',   lat:35.69439, lon:51.42151, group:'ثابت' },
  { id:'kuhdasht', fa:'کوهدشت',  lat:33.5333,  lon:47.6100,  group:'ثابت' },
  { id:'rasht',    fa:'رشت',     lat:37.27611, lon:49.58862, group:'شمال' },
  { id:'ramsar',   fa:'رامسر',   lat:36.91796, lon:50.64802, group:'شمال' },
  { id:'chalus',   fa:'چالوس',   lat:36.6550,  lon:51.4204,  group:'شمال' },
  { id:'sari',     fa:'ساری',    lat:36.5633,  lon:53.0601,  group:'شمال' },
];

const MODELS = [
  { key:'ecmwf_ifs025',  fa:'ECMWF',  sub:'اروپا',  color:'#4cc9f0' },
  { key:'gfs_seamless',  fa:'GFS',    sub:'آمریکا', color:'#f7b267' },
  { key:'icon_seamless', fa:'ICON',   sub:'آلمان',  color:'#c77dff' },
];

const GRID = { lat0:25, lat1:40, lon0:44, lon1:64, step:0.6 };  // ≈ ۶۶ کیلومتر
const HOURS = 72;                    // افق انیمیشن
const CACHE_MS = 20 * 60 * 1000;     // ۲۰ دقیقه
const API = 'https://api.open-meteo.com/v1/forecast';

/* ══════════ وضعیت ══════════ */

const S = {
  map:null, layer:null, markers:{},
  sel:null,            // {lat, lon, name}
  point:null,          // پاسخ API برای نقطه
  grid:null,           // {times, precip:[][], cloud:[][], nx, ny}
  gridPts:[],
  hour:0,
  mode:'precip',
  playing:false, timer:null,
  pinMarker:null,
};

/* ══════════ کمکی ══════════ */

const $ = s => document.querySelector(s);
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const pad2 = n => String(n).padStart(2,'0');

const fmtDay = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn',
  { weekday:'long', day:'numeric', month:'long' });
const fmtDayShort = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn',
  { weekday:'long' });

function toast(msg, isErr){
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'show' + (isErr ? ' err' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.className = '', isErr ? 5200 : 3000);
}

/* کدهای هواشناسی WMO */
const WMO = {
  0:['☀️','صاف'], 1:['🌤️','کمی ابری'], 2:['⛅','نیمه‌ابری'], 3:['☁️','ابری'],
  45:['🌫️','مه'], 48:['🌫️','مه یخ‌زده'],
  51:['🌦️','نم‌نم سبک'], 53:['🌦️','نم‌نم'], 55:['🌧️','نم‌نم شدید'],
  56:['🌧️','نم‌نم یخ‌زده'], 57:['🌧️','نم‌نم یخ‌زده‌ی شدید'],
  61:['🌦️','باران سبک'], 63:['🌧️','باران'], 65:['🌧️','باران شدید'],
  66:['🌧️','باران یخ‌زده'], 67:['🌧️','باران یخ‌زده‌ی شدید'],
  71:['🌨️','برف سبک'], 73:['🌨️','برف'], 75:['❄️','برف سنگین'], 77:['🌨️','دانه‌ی برف'],
  80:['🌦️','رگبار سبک'], 81:['🌧️','رگبار'], 82:['⛈️','رگبار شدید'],
  85:['🌨️','رگبار برف'], 86:['❄️','رگبار برف سنگین'],
  95:['⛈️','رعد و برق'], 96:['⛈️','رعد و برق با تگرگ'], 99:['⛈️','رعد و برق و تگرگ درشت'],
};
const wmo = c => WMO[c] || ['🌡️','—'];

/* مقیاس رنگ بارش (mm در ساعت) */
function precipColor(mm){
  if (mm < 0.05) return null;
  const stops = [
    [0.05, 120,180,255,  60],
    [0.3,   70,150,250, 130],
    [1.0,   55,110,240, 180],
    [3.0,  110, 80,230, 205],
    [7.0,  185, 70,190, 225],
    [15,   235, 70,110, 240],
    [30,   255,140, 60, 250],
  ];
  if (mm >= 30) return [255,190,70,250];
  for (let i=0; i<stops.length-1; i++){
    const a = stops[i], b = stops[i+1];
    if (mm <= b[0]){
      const t = (mm - a[0]) / (b[0] - a[0]);
      return [a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t, a[3]+(b[3]-a[3])*t, a[4]+(b[4]-a[4])*t];
    }
  }
  return null;
}
function cloudColor(pct){
  if (pct < 8) return null;
  const t = clamp(pct/100, 0, 1);
  const g = 190 + 55*t;
  return [g, g+4, 255, 22 + 145*t];
}

/* ══════════ شبکه ══════════ */

function buildGridPoints(){
  const lats = [], lons = [];
  for (let la = GRID.lat1; la >= GRID.lat0 - 1e-9; la -= GRID.step) lats.push(+la.toFixed(3));
  for (let lo = GRID.lon0; lo <= GRID.lon1 + 1e-9; lo += GRID.step) lons.push(+lo.toFixed(3));
  const pts = [];
  for (const la of lats) for (const lo of lons) pts.push([la, lo]);
  return { pts, lats, lons };
}

async function fetchGrid(){
  const { pts, lats, lons } = buildGridPoints();
  const half = Math.ceil(pts.length / 2);
  const chunks = [pts.slice(0, half), pts.slice(half)];

  // سقف نرخ Open-Meteo: بیش از دو درخواست هم‌زمان → HTTP 429
  const parts = await Promise.all(chunks.map(ch => {
    const u = new URL(API);
    u.searchParams.set('latitude',  ch.map(p => p[0]).join(','));
    u.searchParams.set('longitude', ch.map(p => p[1]).join(','));
    u.searchParams.set('hourly', 'precipitation,cloud_cover');
    u.searchParams.set('models', 'ecmwf_ifs025');
    u.searchParams.set('forecast_days', '3');
    u.searchParams.set('timezone', 'Asia/Tehran');
    return getJSON(u);
  }));

  const locs = parts.flat();
  if (locs.length !== pts.length) throw new Error('شبکه ناقص برگشت');

  const times  = locs[0].hourly.time.slice(0, HOURS);
  const nx = lons.length, ny = lats.length;
  const precip = [], cloud = [];
  for (let h = 0; h < times.length; h++){
    precip.push(new Float32Array(nx * ny));
    cloud.push(new Float32Array(nx * ny));
  }
  for (let i = 0; i < locs.length; i++){
    const hh = locs[i].hourly;
    for (let h = 0; h < times.length; h++){
      precip[h][i] = hh.precipitation[h] ?? 0;
      cloud[h][i]  = hh.cloud_cover[h] ?? 0;
    }
  }
  return { times, precip, cloud, nx, ny, lats, lons };
}

/* ══════════ لایه‌ی canvas روی نقشه ══════════ */

const mercY = lat => Math.log(Math.tan(Math.PI/4 + lat*Math.PI/360));

const GridLayer = L.Layer.extend({
  onAdd(map){
    this._map = map;
    const c = this._c = L.DomUtil.create('canvas', 'grid-canvas');
    c.style.position = 'absolute';
    c.style.pointerEvents = 'none';
    map.getPanes().overlayPane.appendChild(c);
    map.on('moveend zoomend resize', this._draw, this);
    map.on('zoomanim', this._onZoomAnim, this);
    this._draw();
  },
  onRemove(map){
    map.off('moveend zoomend resize', this._draw, this);
    map.off('zoomanim', this._onZoomAnim, this);
    L.DomUtil.remove(this._c);
  },
  _onZoomAnim(){
    // در حین انیمیشن زوم لایه محو می‌ماند تا نلرزد؛ _draw دوباره نشانش می‌دهد
    this._c.style.opacity = '0';
  },
  redraw(){ this._draw(); },

  _draw(){
    const map = this._map, g = S.grid, c = this._c;
    if (!c) return;
    const size = map.getSize();
    const dpr  = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size.x * dpr; c.height = size.y * dpr;
    c.style.width = size.x + 'px'; c.style.height = size.y + 'px';
    L.DomUtil.setPosition(c, map.containerPointToLayerPoint([0, 0]));
    // زوم تمام شد؛ ولی هرچه نزدیک‌تر، شبکه نسبت به تصویر درشت‌تر است
    const z = map.getZoom();
    c.style.opacity = z >= 9 ? '.35' : z >= 8 ? '.6' : '';

    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    if (!g || S.mode === 'none') return;

    const vals = (S.mode === 'precip' ? g.precip : g.cloud)[clamp(S.hour, 0, g.times.length-1)];
    if (!vals) return;
    const colorOf = S.mode === 'precip' ? precipColor : cloudColor;

    /* بافت کمکی در فضای مرکاتور — درون‌یابی دو-خطی را خود مرورگر
       با imageSmoothing انجام می‌دهد، پس فقط باید ردیف‌ها را
       از فضای عرض جغرافیایی به فضای مرکاتور بازنمونه‌برداری کرد. */
    const nx = g.nx, ny = g.ny;
    const OY = ny * 4;
    // نامِ _off ممنوع است: L.Evented خودش متدی به همین نام دارد، پس
    // this._off هرگز undefined نمی‌شود و به جای canvas یک تابع برمی‌گرداند
    const buf = this._buf || (this._buf = document.createElement('canvas'));
    buf.width = nx; buf.height = OY;
    const octx = buf.getContext('2d');
    const img = octx.createImageData(nx, OY);
    const d = img.data;

    const yTop = mercY(g.lats[0]), yBot = mercY(g.lats[ny-1]);
    for (let oy = 0; oy < OY; oy++){
      const my = yTop + (yBot - yTop) * (oy / (OY - 1));
      const lat = (Math.atan(Math.exp(my)) - Math.PI/4) * 360/Math.PI;
      // موقعیت کسری میان ردیف‌های شبکه (شبکه در lat یکنواخت است)
      let fr = (g.lats[0] - lat) / GRID.step;
      fr = clamp(fr, 0, ny - 1.0001);
      const r0 = Math.floor(fr), t = fr - r0, r1 = Math.min(r0 + 1, ny - 1);
      for (let x = 0; x < nx; x++){
        const v = vals[r0*nx + x] * (1 - t) + vals[r1*nx + x] * t;
        const col = colorOf(v);
        const p = (oy*nx + x) * 4;
        if (col){ d[p]=col[0]; d[p+1]=col[1]; d[p+2]=col[2]; d[p+3]=col[3]; }
      }
    }
    octx.putImageData(img, 0, 0);

    // بافت از مرکزِ گوشه‌ی بالا-راست تا مرکزِ گوشه‌ی پایین-چپِ شبکه کشیده می‌شود؛
    // همان بازه‌ای که در فضای مرکاتور نمونه‌برداری شد، پس بدون اعوجاج است
    const tl = map.latLngToContainerPoint([g.lats[0], g.lons[0]]);
    const br = map.latLngToContainerPoint([g.lats[ny-1], g.lons[nx-1]]);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(buf, tl.x*dpr, tl.y*dpr, (br.x-tl.x)*dpr, (br.y-tl.y)*dpr);
  },
});

/* ══════════ داده‌ی یک نقطه ══════════ */

async function fetchPoint(lat, lon){
  const u = new URL(API);
  u.searchParams.set('latitude',  lat.toFixed(4));
  u.searchParams.set('longitude', lon.toFixed(4));
  u.searchParams.set('current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,precipitation,is_day');
  u.searchParams.set('hourly', 'precipitation,weather_code');
  u.searchParams.set('daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max');
  u.searchParams.set('models', MODELS.map(m => m.key).join(','));
  u.searchParams.set('timezone', 'Asia/Tehran');
  u.searchParams.set('forecast_days', '7');
  return getJSON(u);
}

/* Open-Meteo سقف نرخ دارد؛ یک بار با مکث دوباره تلاش می‌کنیم و
   خطایش را به زبان آدمیزاد ترجمه می‌کنیم */
async function getJSON(u, retried){
  let r;
  try { r = await fetch(u); }
  catch { throw new Error('اینترنت وصل نیست یا Open-Meteo در دسترس نیست'); }
  if (r.status === 429){
    if (!retried){
      await new Promise(res => setTimeout(res, 2500));
      return getJSON(u, true);
    }
    throw new Error('سقف نرخ Open-Meteo پر شده — چند دقیقه بعد دوباره امتحان کن');
  }
  if (!r.ok) throw new Error('پاسخ سرور: HTTP ' + r.status);
  return r.json();
}

/* نزدیک‌ترین بارش: اولین ساعتی که دست‌کم دو مدل از سه مدل
   بارشِ معنادار (≥ ۰٫۲ میلی‌متر) می‌بینند */
function nextRain(hourly){
  const times = hourly.time;
  const series = MODELS.map(m => hourly['precipitation_' + m.key] || []);
  const now = Date.now();
  for (let i = 0; i < times.length; i++){
    const t = new Date(times[i] + '+03:30').getTime();
    if (t < now - 3600e3) continue;
    const votes = series.map(s => (s[i] ?? 0) >= 0.2);
    const n = votes.filter(Boolean).length;
    if (n >= 2){
      const mm = series.map(s => s[i] ?? 0).reduce((a,b) => a+b, 0) / 3;
      // تا کِی ادامه دارد
      let j = i;
      while (j < times.length &&
             series.map(s => (s[j] ?? 0) >= 0.2).filter(Boolean).length >= 2) j++;
      return { i, t, votes, n, mm, hours: j - i };
    }
  }
  return null;
}

/* ══════════ رندر پنل ══════════ */

function renderPanel(){
  const d = S.point, sel = S.sel;
  if (!d || !sel) return;
  const cur = d.current, [ci, ctxt] = wmo(cur.weather_code);
  const rain = nextRain(d.hourly);

  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-direction:column;gap:13px';

  /* ── الان ── */
  const now = document.createElement('div');
  now.className = 'card';
  now.innerHTML = `
    <div class="now-place">
      <h2>${sel.name}</h2>
      <span class="coord">${sel.lat.toFixed(2)}°N ${sel.lon.toFixed(2)}°E</span>
    </div>
    <div class="now-main">
      <div class="now-icon">${ci}</div>
      <div>
        <div class="now-temp">${Math.round(cur.temperature_2m)}°</div>
        <div class="now-desc">${ctxt}</div>
        <div class="now-feels">حس می‌شود ${Math.round(cur.apparent_temperature)}°</div>
      </div>
    </div>
    <div class="now-stats">
      <div class="stat"><div class="stat-v">${Math.round(cur.relative_humidity_2m)}%</div><div class="stat-k">رطوبت</div></div>
      <div class="stat"><div class="stat-v">${Math.round(cur.wind_speed_10m)}</div><div class="stat-k">باد km/h</div></div>
      <div class="stat"><div class="stat-v">${(cur.precipitation ?? 0).toFixed(1)}</div><div class="stat-k">بارش mm</div></div>
    </div>`;
  el.appendChild(now);

  /* ── کی بارون میاد ── */
  const rc = document.createElement('div');
  rc.className = 'card';
  if (rain){
    const dt = new Date(rain.t);
    const hh = pad2(dt.getHours());
    const dayTxt = sameDay(dt, new Date()) ? 'امروز'
                 : sameDay(dt, new Date(Date.now()+864e5)) ? 'فردا'
                 : fmtDay.format(dt);
    const dur = rain.hours >= 24 ? `حدود ${Math.round(rain.hours/24)} روز`
                                 : `حدود ${rain.hours} ساعت`;
    rc.innerHTML = `
      <div class="card-title">کِی باران می‌آید؟</div>
      <div class="rain-answer">
        <div class="big-icon">🌧️</div>
        <div>
          <div class="rain-when rain-soon">${dayTxt} ساعت ${hh}</div>
          <div class="rain-detail">${dur} · حدود ${rain.mm.toFixed(1)} میلی‌متر در ساعت</div>
        </div>
      </div>
      <div class="agree">
        <div class="dots">${rain.votes.map(v => `<span class="dot${v?' on':''}"></span>`).join('')}</div>
        <span>${rain.n} مدل از ۳ مدل موافق‌اند${rain.n === 3 ? ' — اطمینان بالا' : ' — با احتیاط'}</span>
      </div>`;
  } else {
    rc.innerHTML = `
      <div class="card-title">کِی باران می‌آید؟</div>
      <div class="rain-answer">
        <div class="big-icon">☀️</div>
        <div>
          <div class="rain-when rain-none">تا ۷ روز آینده باران قابل‌توجهی نیست</div>
          <div class="rain-detail">هیچ‌کدام از سه مدل بارش معناداری پیش‌بینی نمی‌کنند</div>
        </div>
      </div>`;
  }
  el.appendChild(rc);

  /* ── نمودار ۴۸ ساعته ── */
  const ch = document.createElement('div');
  ch.className = 'card';
  ch.innerHTML = `
    <div class="card-title">بارش ۴۸ ساعت آینده — سه مدل کنار هم</div>
    ${sparkSVG(d.hourly)}
    <div class="chart-legend">
      ${MODELS.map(m => `<span><i style="background:${m.color}"></i>${m.fa} <span style="opacity:.6">(${m.sub})</span></span>`).join('')}
    </div>`;
  el.appendChild(ch);

  /* ── ۷ روز ── */
  const dd = d.daily;
  const maxSum = Math.max(0.6, ...MODELS.map(m =>
    Math.max(...(dd['precipitation_sum_' + m.key] || [0]).map(v => v ?? 0))));
  const rows = dd.time.map((ds, i) => {
    const dt = new Date(ds + 'T12:00:00+03:30');
    const isToday = sameDay(dt, new Date());
    const code = dd['weather_code_ecmwf_ifs025'][i];
    const [ic] = wmo(code);
    const tmax = dd['temperature_2m_max_ecmwf_ifs025'][i];
    const tmin = dd['temperature_2m_min_ecmwf_ifs025'][i];
    const sums = MODELS.map(m => dd['precipitation_sum_' + m.key]?.[i] ?? 0);
    const avg  = sums.reduce((a,b) => a+b, 0) / sums.length;
    return `<div class="day${isToday ? ' is-today' : ''}">
      <div class="d-name">${isToday ? 'امروز' : fmtDayShort.format(dt)}</div>
      <div class="d-icon">${ic}</div>
      <div>
        <div class="d-bar"><span style="width:${clamp(avg/maxSum*100,0,100).toFixed(0)}%"></span></div>
        ${avg >= 0.2 ? `<div class="d-mm">${avg.toFixed(1)} mm</div>` : ''}
      </div>
      <div class="d-temp"><b>${Math.round(tmax)}°</b><i>${Math.round(tmin)}°</i></div>
    </div>`;
  }).join('');
  const dc = document.createElement('div');
  dc.className = 'card';
  dc.innerHTML = `<div class="card-title">۷ روز آینده</div><div class="days">${rows}</div>`;
  el.appendChild(dc);

  const inner = $('#panel-inner');
  inner.innerHTML = '';
  inner.appendChild(el);
}

const sameDay = (a,b) => a.getFullYear()===b.getFullYear()
                      && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();

/* نمودار خطی بارش ۴۸ ساعته، سه مدل */
function sparkSVG(hourly){
  const N = 48, W = 320, H = 118, PB = 18, PT = 6;
  const times = hourly.time.slice(0, N);
  const series = MODELS.map(m => (hourly['precipitation_' + m.key] || []).slice(0, N).map(v => v ?? 0));
  const peak = Math.max(0.6, ...series.flat());
  const x = i => (i / (N - 1)) * W;
  const y = v => PT + (1 - v / peak) * (H - PB - PT);

  const paths = series.map((s, k) => {
    const dstr = s.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
    return `<path d="${dstr}" fill="none" stroke="${MODELS[k].color}" stroke-width="1.9"
            stroke-linejoin="round" stroke-linecap="round" opacity=".92"/>`;
  }).join('');

  // خط‌های شبکه‌ی روزانه و برچسب ساعت
  let ticks = '';
  for (let i = 0; i < N; i += 6){
    const dt = new Date(times[i] + '+03:30');
    ticks += `<line x1="${x(i)}" y1="${PT}" x2="${x(i)}" y2="${H-PB}" stroke="rgba(255,255,255,.055)" stroke-width="1"/>`
           + `<text x="${x(i)}" y="${H-5}" fill="#65718a" font-size="9" text-anchor="middle"
              font-family="Vazirmatn,sans-serif">${pad2(dt.getHours())}</text>`;
  }
  const nowLine = `<line x1="0" y1="${PT}" x2="0" y2="${H-PB}" stroke="#4cc9f0" stroke-width="1" opacity=".4" stroke-dasharray="2 2"/>`;

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
           aria-label="نمودار بارش ۴۸ ساعت آینده بر پایه‌ی سه مدل">
    ${ticks}${nowLine}${paths}
    <text x="${W-2}" y="${PT+9}" fill="#65718a" font-size="9" text-anchor="end"
      font-family="Vazirmatn,sans-serif" direction="ltr">${peak.toFixed(1)} mm/h</text>
  </svg>`;
}

/* ══════════ نقشه ══════════ */

function initMap(){
  const map = S.map = L.map('map', {
    center:[32.4, 53.5], zoom:5, minZoom:4, maxZoom:11,
    zoomControl:true, attributionControl:true, worldCopyJump:false,
  });
  map.zoomControl.setPosition('bottomright');
  // قاب اولیه روی نیمه‌ی شمال‌غربی — جایی که هر سه مقصدِ ثابت هستند
  map.fitBounds([[30.0, 44.0], [39.6, 56.5]], { padding:[16,16], animate:false });

  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/';
  L.tileLayer(ESRI + 'World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
    attribution:'© Esri · پیش‌بینی: Open-Meteo (ECMWF · GFS · ICON)',
    maxZoom:16,
  }).addTo(map);

  S.layer = new GridLayer().addTo(map);

  // برچسب مرز و شهر بالای لایه‌ی بارش تا خوانا بماند
  L.tileLayer(ESRI + 'World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
    maxZoom:16, pane:'shadowPane', opacity:.55,
  }).addTo(map);

  for (const c of CITIES){
    const m = L.marker([c.lat, c.lon], {
      icon: L.divIcon({ className:'',
        html:`<div class="city-pin" data-city="${c.id}" data-group="${c.group}"
                   title="${c.fa}">${c.fa}</div>`,
        iconSize:[0,0], iconAnchor:[0,0] }),
    }).addTo(map);
    m.on('click', () => select(c.lat, c.lon, c.fa, c.id));
    S.markers[c.id] = m;
  }
  map.on('zoomend', updatePins);
  updatePins();

  map.on('click', e => {
    const { lat, lng } = e.latlng;
    select(lat, lng, `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`, null);
    $('#map-hint').classList.add('is-hidden');
  });
}

/* شهرهای شمال آن‌قدر به هم نزدیک‌اند که در زوم دور برچسب‌هاشان
   روی هم می‌افتد؛ آن‌جا فقط یک نقطه نشان می‌دهیم */
function updatePins(){
  const far = S.map.getZoom() < 7;
  document.querySelectorAll('.city-pin').forEach(p =>
    p.classList.toggle('is-dot', far && p.dataset.group === 'شمال'));
}

function markPin(lat, lon){
  if (S.pinMarker) S.map.removeLayer(S.pinMarker);
  S.pinMarker = L.circleMarker([lat, lon], {
    radius:6, color:'#4cc9f0', weight:2.5, fillColor:'#4cc9f0', fillOpacity:.35,
  }).addTo(S.map);
}

/* ══════════ انتخاب نقطه ══════════ */

let selSeq = 0;
async function select(lat, lon, name, cityId){
  const seq = ++selSeq;
  S.sel = { lat, lon, name };

  document.querySelectorAll('.chip').forEach(c =>
    c.classList.toggle('is-active', c.dataset.city === cityId));
  document.querySelectorAll('.city-pin').forEach(p =>
    p.classList.toggle('is-sel', p.dataset.city === cityId));
  updatePins();
  markPin(lat, lon);

  $('#panel-inner').innerHTML =
    '<div class="skeleton-block"><div class="sk sk-lg"></div><div class="sk"></div><div class="sk"></div></div>';

  try {
    const key = `pt:${lat.toFixed(3)},${lon.toFixed(3)}`;
    S.point = await cached(key, () => fetchPoint(lat, lon), true);
    if (seq !== selSeq) return;            // انتخاب تازه‌تری رسیده
    renderPanel();
  } catch (err){
    if (seq !== selSeq) return;
    $('#panel-inner').innerHTML =
      `<div class="card"><div class="card-title">داده نیامد</div>
       <div style="font-size:13px;color:var(--ink-dim)">${err.message}</div>
       <div style="font-size:12px;color:var(--ink-faint);margin-top:8px">
       دوباره روی نقطه بزن یا دکمه‌ی ⟳ را فشار بده.</div></div>`;
    toast('دریافت داده‌ی این نقطه ناموفق بود: ' + err.message, true);
  }
}

/* کش کوتاه‌مدت در حافظه‌ی مرورگر — تا به سقف نرخ نخوریم */
const memCache = new Map();
const LS_PREFIX = 'wx:';

async function cached(key, fn, persist){
  const hit = memCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.v;

  if (persist){
    try {
      const raw = localStorage.getItem(LS_PREFIX + key);
      if (raw){
        const o = JSON.parse(raw);
        if (Date.now() - o.at < CACHE_MS){
          memCache.set(key, o);
          return o.v;
        }
      }
    } catch {}   // حالت ناشناس یا حافظه‌ی پر — بی‌خیال کش
  }

  const v = await fn();
  const rec = { v, at: Date.now() };
  memCache.set(key, rec);
  if (persist){
    try { localStorage.setItem(LS_PREFIX + key, JSON.stringify(rec)); }
    catch { try { pruneLS(); } catch {} }
  }
  return v;
}

function pruneLS(){
  for (const k of Object.keys(localStorage))
    if (k.startsWith(LS_PREFIX)) localStorage.removeItem(k);
}

/* ══════════ نوار زمان ══════════ */

function setHour(h){
  const g = S.grid;
  S.hour = clamp(h, 0, (g ? g.times.length : HOURS) - 1);
  $('#time-slider').value = S.hour;
  if (g){
    const dt = new Date(g.times[S.hour] + '+03:30');
    const isNow = S.hour === 0;
    $('#time-label .t-main').textContent =
      isNow ? 'همین حالا' : `ساعت ${pad2(dt.getHours())}:00`;
    $('#time-label .t-sub').textContent =
      sameDay(dt, new Date()) ? 'امروز' : fmtDay.format(dt);
    S.layer.redraw();
  }
}

function togglePlay(){
  S.playing = !S.playing;
  $('#btn-play').textContent = S.playing ? '❚❚' : '▶';
  $('#btn-play').setAttribute('aria-label', S.playing ? 'توقف' : 'پخش انیمیشن');
  clearInterval(S.timer);
  if (S.playing){
    S.timer = setInterval(() => {
      const n = S.grid ? S.grid.times.length : HOURS;
      setHour((S.hour + 1) % n);
    }, 380);
  }
}

function renderLegend(){
  const el = $('#legend');
  if (S.mode === 'none'){ el.style.display = 'none'; return; }
  el.style.display = '';
  if (S.mode === 'precip'){
    const stops = [0.1, 0.5, 1, 3, 7, 15, 30];
    const grad = stops.map((mm, i) => {
      const c = precipColor(mm);
      return `rgba(${c[0]|0},${c[1]|0},${c[2]|0},${(c[3]/255).toFixed(2)}) ${(i/(stops.length-1)*100).toFixed(0)}%`;
    }).join(',');
    el.innerHTML = `<div class="legend-bar" style="width:146px;background:linear-gradient(90deg,${grad})"></div>
      <div class="legend-ticks"><span>0.1</span><span>3</span><span>30 mm/h</span></div>`;
  } else {
    el.innerHTML = `<div class="legend-bar" style="width:146px;background:linear-gradient(90deg,rgba(190,194,255,.08),rgba(245,249,255,.92))"></div>
      <div class="legend-ticks"><span>0</span><span>50</span><span>100٪</span></div>`;
  }
}

/* ══════════ راه‌اندازی ══════════ */

function buildChips(){
  const nav = $('#city-chips');
  nav.innerHTML = CITIES.map(c =>
    `<button class="chip" data-city="${c.id}">${c.fa}</button>`).join('');
  nav.addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const c = CITIES.find(x => x.id === b.dataset.city);
    S.map.setView([c.lat, c.lon], Math.max(S.map.getZoom(), 7), { animate:true });
    select(c.lat, c.lon, c.fa, c.id);
  });
}

async function loadGrid(showToast){
  const btn = $('#btn-refresh');
  btn.classList.add('is-busy');
  try {
    S.grid = await cached('grid', fetchGrid);
    $('#time-slider').max = S.grid.times.length - 1;
    setHour(S.hour);
    S.layer.redraw();
    if (showToast) toast('نقشه به‌روز شد');
  } catch (err){
    toast('لایه‌ی نقشه بارگذاری نشد: ' + err.message, true);
  } finally {
    btn.classList.remove('is-busy');
  }
}

async function boot(){
  initMap();
  buildChips();
  renderLegend();

  // اول کارت تهران، بعد شبکه — پشت سر هم، نه هم‌زمان،
  // تا مجموع درخواست‌های هم‌زمان از سقف نرخ نگذرد
  const tehran = CITIES[0];
  await select(tehran.lat, tehran.lon, tehran.fa, tehran.id);
  await loadGrid(false);

  $('#time-slider').addEventListener('input', e => setHour(+e.target.value));
  $('#btn-play').addEventListener('click', togglePlay);
  $('#btn-refresh').addEventListener('click', () => {
    memCache.clear();
    try { pruneLS(); } catch {}
    loadGrid(true);
    if (S.sel) select(S.sel.lat, S.sel.lon, S.sel.name,
      CITIES.find(c => c.lat === S.sel.lat && c.lon === S.sel.lon)?.id ?? null);
  });

  document.querySelectorAll('.seg-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.seg-btn').forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active');
      S.mode = b.dataset.layer;
      renderLegend();
      S.layer.redraw();
    });
  });

  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' && e.key !== 'Escape') return;
    if (e.key === ' '){ e.preventDefault(); togglePlay(); }
    if (e.key === 'ArrowRight') setHour(S.hour - 1);   // RTL: راست = عقب
    if (e.key === 'ArrowLeft')  setHour(S.hour + 1);
  });

  setTimeout(() => $('#map-hint').classList.add('is-hidden'), 7000);
}

document.addEventListener('DOMContentLoaded', boot);
