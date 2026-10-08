// تستِ گفت‌وگوی کامل: کلِ app.js در vm با DOMِ ساختگی، تاریخِ ثابت و Open-Meteoِ ساختگی.
// اجرا (از ریشه‌ی پروژه):  node tests/convo_test.js assets/app.js   ← خروجِ ۰ = همه پاس
// «امروز» ثابت روی شنبه ۱۱ مهر ۱۴۰۵ است تا هر تاریخ دقیق چک شود. بدونِ شبکه.
const fs = require('fs');
const vm = require('vm');
const APP = process.argv[2] || 'assets/app.js';
const src = fs.readFileSync(APP, 'utf8');

const FIXED = new Date(2026, 9, 3, 12, 0, 0).getTime(); // شنبه ۱۱ مهر ۱۴۰۵
class FakeDate extends Date {
  constructor(...a) { if (a.length === 0) super(FIXED); else super(...a); }
  static now() { return FIXED; }
}
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addD = (n) => { const d = new Date(FIXED); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); };

function mockFetch(log, opts = {}) {
  return async (url) => {
    log.push(url);
    const u = new URL(url);
    const json = (o) => ({ ok: true, json: async () => o });
    if (u.host.startsWith('geocoding')) {
      const name = u.searchParams.get('name');
      const table = {
        'کوهدشت': [{ name: 'کوهدشت', country_code: 'IR', feature_code: 'PPLA2', population: 89091, latitude: 33.53, longitude: 47.6, admin1: 'لرستان' },
                   { name: 'کوهدشت', country_code: 'IR', feature_code: 'PPLX', latitude: 1, longitude: 1 }],
        'میرم': [{ name: 'میرما', country_code: 'FR', feature_code: 'PPL', population: 24173 }, { name: 'میرمنا', country_code: 'IR', feature_code: 'PPL' }],
        'گرمسار': [{ name: 'گرمسار', country_code: 'IR', feature_code: 'PPLA2', latitude: 35.2, longitude: 52.3, admin1: 'سمنان' }],
        'خرم آباد': [{ name: 'خرم آباد', country_code: 'IR', feature_code: 'PPLA', population: 329825, latitude: 33.48, longitude: 48.35, admin1: 'لرستان' }],
        'خبر': [{ name: 'خبر', country_code: 'IR', feature_code: 'PPL', latitude: 5, longitude: 5 }],
        'آذربایجان': [{ name: 'آذربایجان', country_code: 'AZ', feature_code: 'PCLI' }],
      };
      return json(table[name] ? { results: table[name] } : {});
    }
    if (u.host.startsWith('api.')) {
      if (opts.forecastDown) return { ok: false, status: 503, json: async () => ({}) };
      const time = [], daily = { time };
      const M = ['ecmwf_ifs025', 'gfs_seamless', 'icon_seamless'];
      for (const m of M) for (const k of ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum', 'weather_code', 'wind_speed_10m_max', 'wind_gusts_10m_max']) daily[`${k}_${m}`] = [];
      const htime = [], hourly = { time: htime };
      for (const m of M) hourly[`precipitation_${m}`] = [];
      for (let i = 0; i < 16; i++) {
        time.push(iso(addD(i)));
        for (const m of M) {
          const missing = (m === 'icon_seamless' && i >= 7) || (m === 'ecmwf_ifs025' && i >= 15);
          const wet = i % 3 === 1;   // هر سه روز یک روزِ بارونی
          daily[`temperature_2m_max_${m}`].push(missing ? null : 20 + i);
          daily[`temperature_2m_min_${m}`].push(missing ? null : 10 + i);
          daily[`precipitation_sum_${m}`].push(missing ? null : (wet ? 4 : 0));
          daily[`weather_code_${m}`].push(missing ? null : (wet ? 61 : 1));
          daily[`wind_speed_10m_max_${m}`].push(missing ? null : 10);
          daily[`wind_gusts_10m_max_${m}`].push(missing ? null : 20);
        }
        for (let h = 0; h < 24; h++) {
          htime.push(`${iso(addD(i))}T${String(h).padStart(2, '0')}:00`);
          for (const m of M) hourly[`precipitation_${m}`].push(i % 3 === 1 && h >= 14 && h < 18 ? 1 : 0);
        }
      }
      return json({ daily, hourly });
    }
    if (u.host.startsWith('archive')) {
      const s = new Date(u.searchParams.get('start_date') + 'T00:00:00'), e = new Date(u.searchParams.get('end_date') + 'T00:00:00');
      const daily = { time: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_sum: [], weather_code: [], wind_speed_10m_max: [], wind_gusts_10m_max: [] };
      for (let d = new Date(s); d <= e; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
        daily.time.push(iso(d)); daily.temperature_2m_max.push(15); daily.temperature_2m_min.push(5);
        daily.precipitation_sum.push(0); daily.weather_code.push(2);
        daily.wind_speed_10m_max.push(10); daily.wind_gusts_10m_max.push(20);
      }
      return json({ daily });
    }
    throw new Error('unexpected url ' + url);
  };
}

function makeApp(opts) {
  const el = () => ({ addEventListener() {}, appendChild() {}, querySelectorAll: () => [], style: {}, classList: { add() {}, remove() {} }, value: '', innerHTML: '', remove() {}, setAttribute() {}, getAttribute() {} });
  const els = {};
  const document = {
    getElementById: id => (id === 'typing-indicator' ? null : (els[id] ||= el())),
    createElement: () => el(),
    addEventListener: () => {},
  };
  const replies = [], fetchLog = [];
  const ctx = { console: { log() {}, warn() {}, error: (...a) => console.error('APP ERROR', ...a) }, Date: FakeDate, document, setTimeout: (f) => 0, navigator: {}, URL, fetch: mockFetch(fetchLog, opts) };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  ctx.appendAssistantMessage = d => replies.push(d);
  ctx.appendUserMessage = () => {};
  ctx.appendTypingIndicator = () => {};
  return { ask: async q => { const n = replies.length; await ctx.handleUserSubmit(q); return replies[n]; }, fetchLog, ctx };
}

// خلاصه‌ی یک جواب: شهر، بازه (از کارت‌ها)، تعدادِ روز، روزِ برجسته، یادداشت‌ها
function summarize(r) {
  if (!r) return { kind: 'none' };
  const city = (r.cardsHtml.match(/weather-loc-title">([^<(]+)/) || [])[1]?.trim() || null;
  const cards = [...r.cardsHtml.matchAll(/day-card-date">([^<]+)</g)].map(m => m[1]);
  return {
    kind: r.cardsHtml ? 'weather' : 'text',
    city, first: cards[0], last: cards[cards.length - 1], n: cards.length,
    focus: (r.cardsHtml.match(/day-card is-[^"]*is-focus|day-card is-focus/) ? 'yes' : null),
    text: r.text,
    chips: (r.suggestions || []).map(s => (typeof s === 'string' ? s : s.label + '→' + s.query)),
    html: r.cardsHtml,
  };
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}\n     ${detail}`); }
}

(async () => {
  // تقویم: امروز ۱۱ مهر (شنبه). روزها به شکلِ «12 مهر»
  const T = n => { const map = { 0: '11 مهر', 1: '12 مهر', 2: '13 مهر', 3: '14 مهر', 4: '15 مهر', 5: '16 مهر', 6: '17 مهر', 7: '18 مهر', 8: '19 مهر', 13: '24 مهر', 14: '25 مهر', 15: '26 مهر', 16: '27 مهر', 29: '10 آبان', 30: '11 آبان' }; return map[n]; };

  const single = async (title, q, exp) => {
    const app = makeApp();
    const s = summarize(await app.ask(q));
    const got = `kind=${s.kind} city=${s.city} ${s.first}..${s.last} n=${s.n}`;
    const ok = Object.entries(exp).every(([k, v]) => (k === 'textHas' ? s.text.includes(v) : k === 'textLacks' ? !s.text.includes(v) : s[k] === v));
    check(`${title}: «${q}»`, ok, `expected ${JSON.stringify(exp)} got ${got} | text: ${s.text?.slice(0, 160)}`);
    return { s, app };
  };

  console.log('\n== شکایتِ اصلیِ فرزین ==');
  {
    const app = makeApp();
    let s = summarize(await app.ask('فردا چطوره هوا'));
    check('«فردا چطوره هوا» ← می‌پرسد کدوم شهر و فردا را تکرار می‌کند', s.kind === 'text' && s.text.includes('فردا'), s.text);
    s = summarize(await app.ask('رشت'));
    check('بعد «رشت» ← فقط فردا (۱ روز)', s.city === 'رشت' && s.n === 1 && s.first === T(1), JSON.stringify([s.city, s.first, s.n]));
    check('  بی یادداشتِ زائدِ «تاریخ نگفتی» (خودش همین الان گفته بود)', !s.text.includes('تاریخ نگفتی'), s.text);
  }
  {
    const app = makeApp();
    let s = summarize(await app.ask('ی هفته دیگه هوا چطوره'));
    check('«ی هفته دیگه هوا چطوره» ← کدوم شهر', s.kind === 'text', s.text);
    s = summarize(await app.ask('رشت'));
    check('بعد «رشت» ← امروز تا ۷ روز بعد (۸ کارت)، روزِ هفتم برجسته', s.n === 8 && s.first === T(0) && s.last === T(7) && s.focus === 'yes' && s.text.includes('📌'), JSON.stringify([s.first, s.last, s.n, s.focus]));
  }

  console.log('\n== تاریخ با شهر در همان جمله ==');
  await single('فردا', 'فردا رشت چطوره', { city: 'رشت', first: T(1), n: 1 });
  await single('یه هفته دیگه', 'یه هفته دیگه رشت', { first: T(0), last: T(7), n: 8 });
  await single('یک هفته', 'یک هفته تهران', { first: T(0), last: T(6), n: 7 });
  await single('یک هفته آینده', 'یک هفته آینده تهران', { first: T(0), last: T(6), n: 7 });
  await single('۷ روز آینده', '۷ روز آینده تهران', { n: 7 });
  await single('پنج روز آینده', 'پنج روز آینده شیراز', { n: 5, last: T(4) });
  await single('۱۰ روز', '۱۰ روز تهران', { n: 10 });
  await single('دو هفته', 'دو هفته تهران', { n: 14 });
  await single('۱۶ روز', '۱۶ روز رشت', { n: 16, last: T(15) });
  await single('سه‌شنبه با نیم‌فاصله', 'سه‌شنبه تهران', { n: 1, first: T(3) });
  await single('سه شنبه با فاصله', 'سه شنبه تهران', { n: 1, first: T(3) });
  await single('پنجشنبه', 'پنجشنبه تهران بارون میاد؟', { n: 1, first: T(5) });
  await single('شنبه (امروز شنبه است)', 'شنبه تهران', { n: 1, first: T(0) });
  await single('شنبه‌ی بعد', 'شنبه بعد تهران', { n: 1, first: T(7) });
  await single('پس‌فردا', 'پس‌فردا چالوس بارون داریم؟', { n: 1, first: T(2), textHas: 'بارون' });
  await single('۲ تا ۳ روز دیگه (باگِ «دی»)', '۲ تا ۳ روز دیگه تهران', { first: T(2), last: T(3), n: 2 });
  await single('فردا تا ۵ روز دیگه', 'فردا تا ۵ روز دیگه رشت', { first: T(1), last: T(5), n: 5 });
  await single('امروز و فردا', 'امروز و فردا تهران', { first: T(0), last: T(1), n: 2 });
  await single('از فردا تا جمعه', 'از فردا تا جمعه رشت', { first: T(1), last: T(6), n: 6 });
  await single('تا آخر هفته', 'تا آخر هفته رشت', { first: T(0), last: T(6), n: 7 });
  await single('آخر هفته', 'آخر هفته چالوس', { first: T(5), last: T(6), n: 2 });
  await single('هفته بعد', 'هفته بعد تهران', { first: T(7), n: 7 });
  await single('هفته‌ی دیگه', 'هفته‌ی دیگه تهران', { first: T(7), n: 7 });
  await single('این هفته', 'این هفته تهران', { first: T(0), last: T(6), n: 7 });
  await single('۱۵ مهر', '۱۵ مهر رشت', { n: 1, first: T(4) });
  await single('پونزدهم مهر', 'پونزدهم مهر رشت', { n: 1, first: T(4) });
  await single('۱۰ تا ۱۳ مهر (گذشته‌ی جزئی)', '۱۰ تا ۱۳ مهر رشت', { first: T(0), last: T(2), textHas: 'روزهای گذشته' });
  await single('۲۵ مهر تا ۵ آبان (عبور از ۱۶ روز)', '۲۵ مهر تا ۵ آبان رشت', { first: T(14), n: 11, textHas: 'پارسال' });
  await single('یک ماه آینده (ترکیبی)', 'یک ماه آینده رشت', { n: 30, first: T(0), textHas: 'پارسال' });
  await single('دیروز (گذشته)', 'دیروز تهران چطور بود', { kind: 'text', textHas: 'گذشته' });
  await single('۵ مهر (گذشته)', '۵ مهر تهران', { kind: 'text', textHas: 'گذشته' });

  console.log('\n== شهر ==');
  await single('بابلسر نه بابل', 'بابلسر فردا', { city: 'بابلسر' });
  await single('ک عربی', 'كرج فردا', { city: 'کرج' });
  await single('تهرون', 'تهرون فردا', { city: 'تهران' });
  await single('خرم آباد با فاصله', 'خرم آباد فردا', { city: 'خرم‌آباد' });
  await single('بندر عباس با فاصله', 'بندر عباس فردا', { city: 'بندرعباس' });
  await single('کیش (کی+ش نباید دستوری حساب شود)', 'کیش فردا', { city: 'کیش' });
  await single('کوهدشت آنلاین', 'هوای کوهدشت چند درجه است؟', { city: 'کوهدشت', n: 3, textHas: 'دمای' });
  await single('«میرم» نباید روستای میرمنا شود', 'فردا میرم کوهدشت هوا چطوره', { city: 'کوهدشت', n: 1 });
  await single('گرمسار ≠ قصدِ «گرم»', 'گرمسار فردا', { city: 'گرمسار', textLacks: 'اوضاع دمای' });
  await single('آذربایجان ≠ ماهِ آذر', 'هوای آذربایجان فردا', { kind: 'text' });
  await single('«تاریخ» ≠ قصدِ «یخ»', 'تاریخ ۱۵ مهر رشت', { city: 'رشت', textLacks: 'اوضاع دمای' });

  console.log('\n== حافظه‌ی گفت‌وگو ==');
  {
    const app = makeApp();
    let s = summarize(await app.ask('هوای تهران'));
    check('«هوای تهران» ← سه روز + یادداشتِ «تاریخ نگفتی»', s.n === 3 && s.text.includes('تاریخ نگفتی'), s.text);
    s = summarize(await app.ask('فردا چی؟'));
    check('«فردا چی؟» ← تهرانِ فردا، با یادداشتِ شهر', s.city === 'تهران' && s.n === 1 && s.first === T(1) && s.text.includes('شهر نگفتی'), JSON.stringify([s.city, s.first, s.n]));
    s = summarize(await app.ask('اصفهان چی؟'));
    check('«اصفهان چی؟» ← اصفهانِ همان فردا', s.city === 'اصفهان' && s.n === 1 && s.first === T(1) && s.text.includes('سوالِ قبلی'), JSON.stringify([s.city, s.first, s.n]));
    s = summarize(await app.ask('بارون میاد؟'));
    check('«بارون میاد؟» ← اصفهانِ فردا با قصدِ بارون', s.city === 'اصفهان' && s.n === 1 && /بارون/.test(s.text.split('\n')[0]), s.text.slice(0, 120));
    s = summarize(await app.ask('مشهد'));
    check('«مشهد» ← قصدِ بارون می‌ماند', s.city === 'مشهد' && /بارون/.test(s.text.split('\n')[0]), s.text.slice(0, 120));
  }
  {
    const app = makeApp();
    let s = summarize(await app.ask('فردا'));
    check('«فردا» تنها و بی‌حافظه ← «کدوم شهر» (نه «من فقط هوا بلدم»)', s.kind === 'text' && s.text.includes('کدوم شهر'), s.text);
    check('  پیشنهادها اسمِ شهرند', s.chips.includes('تهران'), JSON.stringify(s.chips));
    s = summarize(await app.ask('تهران'));
    check('  کلیکِ «تهران» ← فردا', s.city === 'تهران' && s.n === 1 && s.first === T(1), JSON.stringify([s.city, s.first, s.n]));
  }

  console.log('\n== دکمه‌های بازه ==');
  {
    const app = makeApp();
    let s = summarize(await app.ask('فردا رشت'));
    check('زیرِ جوابِ «فردا» دکمه‌ی «فردا» نیست، «یه هفته» هست', !s.chips.some(c => c.includes('→فردا رشت')) && s.chips.some(c => c.includes('→یه هفته رشت')), JSON.stringify(s.chips));
    s = summarize(await app.ask('یه هفته رشت'));
    check('کلیکِ «یه هفته» ← ۷ روز', s.n === 7, s.n);
  }

  console.log('\n== صداقتِ عدد ==');
  {
    const { s } = await single('۱۶ روز', '۱۶ روز رشت', { n: 16 });
    const cards = s.html.split(/<div class="day-card[ "]/).slice(1);
    const last = cards[cards.length - 1];
    check('روزِ ۱۶ (فقط GFS) درصد ندارد و برچسبِ «فقط GFS» دارد', !/\d+٪/.test(last) && last.includes('فقط GFS'), last.replace(/\s+/g, ' ').slice(0, 300));
    check('روزِ ۸ (دومدلی) درصد دارد (۰/۵۰/۱۰۰)', /(0|50|100)٪/.test(cards[7]), cards[7].replace(/\s+/g, ' ').slice(0, 200));
    check('نشانِ بالا دیگر «سه مدل» نمی‌گوید', !s.html.includes('سه مدل عددی مستقل'), '');
    check('منبع گروه‌بندی شده', s.html.includes('7 روز میانگین ECMWF · GFS · ICON') && s.html.includes('فقط GFS'), (s.html.match(/منبع: [^<]+/) || [])[0]);
  }
  {
    const { s } = await single('۳ روز', '۳ روز رشت', { n: 3 });
    check('بازه‌ی ۳روزه هنوز «سه مدل عددی مستقل» است', s.html.includes('سه مدل عددی مستقل'), '');
  }
  {
    const app = makeApp({ forecastDown: true });
    const s = summarize(await app.ask('فردا رشت'));
    check('اگر پیش‌بینی قطع بود ← هوای سالِ قبل با برچسبِ صادقانه', s.n === 1 && s.html.includes('هوای سالِ قبل'), s.html.slice(0, 200));
    const arch = app.fetchLog.find(u => u.includes('archive'));
    check('  تاریخِ آرشیو دقیقاً یک سال قبلِ فرداست (نه یک روز عقب)', arch && arch.includes('start_date=2025-10-04'), arch);
  }

  console.log('\n== وضعیت باد و راستی‌آزمایی ==');
  {
    const { s } = await single('باد در تهران', 'فردا تهران باد میاد؟', { city: 'تهران', n: 1, textHas: 'باد' });
    check('کارت شامل اطلاعات باد است', s.html.includes('day-card-wind'), '');
    check('برای فردا پنل راستی‌آزمایی مخفی است (هنوز اتفاق نیفتاده)', !s.html.includes('reality-card'), '');
  }
  {
    const { s } = await single('راستی‌آزمایی امروز', 'امروز تهران چطوره', { city: 'تهران', n: 1 });
    check('پنل راستی‌آزمایی فقط برای امروز نمایش داده می‌شود', s.html.includes('reality-card') && s.html.includes('راستی‌آزمایی'), '');
    check('برگه‌های مدل‌ها مستقیماً برای انتخاب طراحی شده‌اند', s.html.includes('model-box') && s.html.includes('model-selection-bar') && s.html.includes('btn-select-none'), '');
    check('دکمه‌های تکراری چیپ از پایین حذف شده‌اند', !s.html.includes('chip-choice'), '');
  }

  console.log('\n== بی‌ربط و احوال‌پرسی ==');
  await single('دلار', 'دلار فردا چنده', { kind: 'text', textHas: 'تخصصم' });
  await single('سلام', 'سلام', { kind: 'text', textHas: 'سلام رفیق' });
  await single('ممنون رفیق', 'ممنون رفیق', { kind: 'text', textHas: 'نوکرتم' });

  console.log(`\n${pass} پاس، ${fail} شکست`);
  process.exit(fail ? 1 : 0);
})();
