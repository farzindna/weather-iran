/**
 * هوای ایران — دستیار هوشمند هواشناسی (نسخه‌ی تمام چت‌بیس)
 * قابلیت درک زبان طبیعی، پشتیبانی از شهرهای ایران و پیش‌بینی دقیق ۱ تا ۳۰ روزه
 */

// ==========================================
// 1. تقویم جلالی و ابزارهای تاریخ
// ==========================================
function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  let jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

function jalaliToGregorian(jy, jm, jd) {
  jy += 1595;
  let days = -355668 + (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return { gy, gm, gd, iso: `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}` };
}

const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const PERSIAN_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];

function getJalaliDateStr(dateObj) {
  const j = gregorianToJalali(dateObj.getFullYear(), dateObj.getMonth() + 1, dateObj.getDate());
  const wDay = PERSIAN_WEEKDAYS[dateObj.getDay()];
  return {
    ...j,
    weekday: wDay,
    full: `${wDay} ${j.jd} ${PERSIAN_MONTHS[j.jm - 1]}`,
    short: `${j.jd} ${PERSIAN_MONTHS[j.jm - 1]}`
  };
}

// --- حسابِ روز بدونِ دردسرِ ساعت و منطقه‌ی زمانی ---
const DAY_MS = 24 * 3600 * 1000;
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);

function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // اسفند فقط در سالِ کبیسه ۳۰ روزه است: اگر «۳۰ اسفند» به فروردین برگشت، ۲۹ روزه است
  const g = jalaliToGregorian(jy, 12, 30);
  return gregorianToJalali(g.gy, g.gm, g.gd).jm === 12 ? 30 : 29;
}

function jalaliToDate(jy, jm, jd) {
  const g = jalaliToGregorian(jy, jm, Math.min(jd, jalaliMonthLength(jy, jm)));
  return new Date(g.gy, g.gm - 1, g.gd);
}

// «امروز / فردا / پس‌فردا» برای روزهای نزدیک — تا جواب صریح بگوید کدام روز را فهمیده
function relativeDayWord(d, today) {
  const n = daysBetween(today, d);
  return n === 0 ? 'امروز' : n === 1 ? 'فردا' : n === 2 ? 'پس‌فردا' : null;
}

// ==========================================
// 2. دیتابیس شهرهای ایران + قابلیت ژئوکودینگ پویا
// ==========================================
const POPULAR_CITIES = [
  { name: 'چالوس', lat: 36.6550, lon: 51.4204, province: 'مازندران' },
  { name: 'نوشهر', lat: 36.6486, lon: 51.4961, province: 'مازندران' },
  { name: 'رامسر', lat: 36.9180, lon: 50.6480, province: 'مازندران' },
  { name: 'کلاردشت', lat: 36.4914, lon: 51.1558, province: 'مازندران' },
  { name: 'رشت', lat: 37.2809, lon: 49.5924, province: 'گیلان' },
  { name: 'انزلی', lat: 37.4747, lon: 49.4589, province: 'گیلان', aliases: ['بندر انزلی'] },
  { name: 'لاهیجان', lat: 37.2070, lon: 50.0031, province: 'گیلان' },
  { name: 'ساری', lat: 36.5659, lon: 53.0586, province: 'مازندران' },
  { name: 'بابل', lat: 36.5419, lon: 52.6782, province: 'مازندران' },
  { name: 'آمل', lat: 36.4696, lon: 52.3507, province: 'مازندران' },
  { name: 'شمال تهران', lat: 35.8050, lon: 51.4250, province: 'تهران', aliases: ['شمال تهرون', 'شمیران', 'شمیرانات', 'تجریش', 'ولنجک', 'نیاوران'] },
  { name: 'غرب تهران', lat: 35.7300, lon: 51.2500, province: 'تهران', aliases: ['غرب تهرون', 'چیتگر', 'صادقیه', 'شهرک غرب'] },
  { name: 'شرق تهران', lat: 35.7350, lon: 51.5300, province: 'تهران', aliases: ['شرق تهرون', 'تهرانپارس', 'لویزان', 'سرخه حصار'] },
  { name: 'جنوب تهران', lat: 35.5900, lon: 51.4200, province: 'تهران', aliases: ['جنوب تهرون', 'شهر ری', 'شهرری', 'نازی آباد'] },
  { name: 'مرکز تهران', lat: 35.6892, lon: 51.3890, province: 'تهران', aliases: ['مرکز تهرون'] },
  { name: 'تهران', lat: 35.6892, lon: 51.3890, province: 'تهران', aliases: ['تهرون', 'کل تهران'] },
  { name: 'عظیمیه کرج', lat: 35.8600, lon: 51.0150, province: 'البرز', aliases: ['عظیمیه', 'شمال کرج'] },
  { name: 'گوهردشت کرج', lat: 35.8650, lon: 50.9700, province: 'البرز', aliases: ['گوهردشت', 'رجایی شهر', 'رجایی‌شهر'] },
  { name: 'مهرشهر کرج', lat: 35.8050, lon: 50.9100, province: 'البرز', aliases: ['مهرشهر', 'مهر شهر', 'جنوب کرج'] },
  { name: 'کرج', lat: 35.8327, lon: 50.9915, province: 'البرز', aliases: ['مرکز کرج'] },
  { name: 'طرقبه', lat: 36.3117, lon: 59.3736, province: 'خراسان رضوی', aliases: ['طرقبه مشهد', 'شاندیز', 'شاندیز مشهد'] },
  { name: 'وکیل‌آباد مشهد', lat: 36.3450, lon: 59.4850, province: 'خراسان رضوی', aliases: ['وکیل آباد', 'وکیل آباد مشهد', 'پارک ملت مشهد'] },
  { name: 'قاسم‌آباد مشهد', lat: 36.3650, lon: 59.5100, province: 'خراسان رضوی', aliases: ['قاسم آباد', 'قاسم آباد مشهد', 'غرب مشهد'] },
  { name: 'مشهد', lat: 36.2972, lon: 59.6067, province: 'خراسان رضوی', aliases: ['حرم', 'حرم امام رضا'] },
  { name: 'کوه صفه اصفهان', lat: 32.5800, lon: 51.6600, province: 'اصفهان', aliases: ['کوه صفه', 'صفه اصفهان', 'سپاهان شهر', 'سپاهان‌شهر', 'جنوب اصفهان'] },
  { name: 'ناژوان اصفهان', lat: 32.6450, lon: 51.5900, province: 'اصفهان', aliases: ['ناژوان', 'پارک ناژوان', 'آتشگاه اصفهان', 'آتشگاه', 'غرب اصفهان'] },
  { name: 'شاهین‌شهر', lat: 32.8600, lon: 51.5600, province: 'اصفهان', aliases: ['شاهین شهر', 'شمال اصفهان'] },
  { name: 'شرق اصفهان', lat: 32.7500, lon: 51.8600, province: 'اصفهان', aliases: ['فرودگاه اصفهان'] },
  { name: 'اصفهان', lat: 32.6546, lon: 51.6680, province: 'اصفهان', aliases: ['میدان نقش جهان', 'مرکز اصفهان'] },
  { name: 'شهر جدید صدرا', lat: 29.8100, lon: 52.3600, province: 'فارس', aliases: ['صدرا', 'صدرا شیراز', 'شمال غرب شیراز'] },
  { name: 'قصرالدشت شیراز', lat: 29.6500, lon: 52.4850, province: 'فارس', aliases: ['قصرالدشت', 'قصر دشت', 'ارم شیراز', 'باغ ارم'] },
  { name: 'جنوب شیراز', lat: 29.5400, lon: 52.5900, province: 'فارس', aliases: ['فرودگاه شیراز'] },
  { name: 'شیراز', lat: 29.5918, lon: 52.5837, province: 'فارس', aliases: ['حافظیه', 'مرکز شیراز'] },
  { name: 'ائل‌گلی تبریز', lat: 38.0250, lon: 46.3650, province: 'آذربایجان شرقی', aliases: ['ائل گلی', 'ایل گلی', 'ائل‌گلی', 'شاه گلی', 'جنوب شرق تبریز'] },
  { name: 'غرب تبریز', lat: 38.1250, lon: 46.2350, province: 'آذربایجان شرقی', aliases: ['فرودگاه تبریز'] },
  { name: 'تبریز', lat: 38.0800, lon: 46.2919, province: 'آذربایجان شرقی', aliases: ['مرکز تبریز', 'بازار تبریز'] },
  { name: 'اهواز', lat: 31.3183, lon: 48.6706, province: 'خوزستان' },
  { name: 'کیش', lat: 26.5578, lon: 53.9799, province: 'هرمزگان' },
  { name: 'قشم', lat: 26.9581, lon: 56.2719, province: 'هرمزگان' },
  { name: 'بندرعباس', lat: 27.1832, lon: 56.2666, province: 'هرمزگان', aliases: ['بندر عباس'] },
  { name: 'بوشهر', lat: 28.9234, lon: 50.8203, province: 'بوشهر' },
  { name: 'یزد', lat: 31.8974, lon: 54.3569, province: 'یزد' },
  { name: 'کرمان', lat: 30.2839, lon: 57.0834, province: 'کرمان' },
  { name: 'کرمانشاه', lat: 34.3142, lon: 47.0650, province: 'کرمانشاه' },
  { name: 'همدان', lat: 34.7989, lon: 48.5150, province: 'همدان' },
  { name: 'ارومیه', lat: 37.5527, lon: 45.0761, province: 'آذربایجان غربی' },
  { name: 'اردبیل', lat: 38.2498, lon: 48.2933, province: 'اردبیل' },
  { name: 'سنندج', lat: 35.3219, lon: 46.9862, province: 'کردستان' },
  { name: 'خرم‌آباد', lat: 33.4878, lon: 48.3558, province: 'لرستان' },
  { name: 'زنجان', lat: 36.6736, lon: 48.4787, province: 'زنجان' },
  { name: 'قم', lat: 34.6401, lon: 50.8764, province: 'قم' },
  { name: 'قزوین', lat: 36.2797, lon: 50.0049, province: 'قزوین' },
  { name: 'گرگان', lat: 36.8427, lon: 54.4439, province: 'گلستان' },
  { name: 'اراک', lat: 34.0917, lon: 49.6892, province: 'مرکزی' },
  { name: 'کاشان', lat: 33.9850, lon: 51.4100, province: 'اصفهان' },
  { name: 'بابلسر', lat: 36.7027, lon: 52.6575, province: 'مازندران' },
  { name: 'متل قو', lat: 36.7061, lon: 51.2158, province: 'مازندران' },
  { name: 'سلمان‌شهر', lat: 36.7061, lon: 51.2158, province: 'مازندران' },
  { name: 'ماسال', lat: 37.3629, lon: 49.1327, province: 'گیلان' },
  { name: 'فومن', lat: 37.2241, lon: 49.3125, province: 'گیلان' },
  { name: 'چابهار', lat: 25.2919, lon: 60.6430, province: 'سیستان و بلوچستان' },
  { name: 'زاهدان', lat: 29.4963, lon: 60.8629, province: 'سیستان و بلوچستان' },
  { name: 'ایلام', lat: 33.6374, lon: 46.4227, province: 'ایلام' },
  { name: 'شهرکرد', lat: 32.3256, lon: 50.8644, province: 'چهارمحال و بختیاری' },
  { name: 'یاسوج', lat: 30.6684, lon: 51.5876, province: 'کهگیلویه و بویراحمد' },
  { name: 'سمنان', lat: 35.5769, lon: 53.3953, province: 'سمنان' },
  { name: 'بجنورد', lat: 37.4747, lon: 57.3290, province: 'خراسان شمالی' },
  { name: 'بیرجند', lat: 32.8663, lon: 59.2211, province: 'خراسان جنوبی' },
  { name: 'دماوند', lat: 35.7179, lon: 52.0650, province: 'تهران' },
  { name: 'سرعین', lat: 38.1517, lon: 48.0706, province: 'اردبیل' }
];

// اسمِ «کلمه‌ای» شهر: نیم‌فاصله ← فاصله، تا «خرم آباد» و «خرم‌آباد» یکی باشند
const cityWordForm = s => s.replace(/‌/g, ' ').replace(/\s+/g, ' ').trim();
const cityKey = s => cityWordForm(normalizeText(s)).replace(/ /g, '');

// اسم‌ها و نام‌های مستعارِ لیستِ داخلی، بلندترین اول — تا «بابلسر» قبل از «بابل» دیده شود
const CITY_NAMES = POPULAR_CITIES
  .flatMap(c => [c.name, ...(c.aliases || [])].map(n => ({ city: c, w: cityWordForm(n), key: cityKey(n) })))
  .sort((a, b) => b.w.length - a.w.length);

function findLocalCity(name) {
  const key = cityKey(name);
  // اول تطابقِ دقیق — قبلاً فقط includes بود و «بابلسر» مختصاتِ «بابل» را می‌گرفت
  const exact = CITY_NAMES.find(n => n.key === key);
  if (exact) return exact.city;
  // بعد کلمه‌ای که اسمِ یک شهرِ لیست را در خودش دارد («بندرانزلی» ← انزلی)
  const inner = CITY_NAMES.find(n => n.key.length >= 3 && key.includes(n.key));
  return inner ? inner.city : null;
}

const FEATURE_RANK = { PPLC: 50, PPLA: 40, PPLA2: 30, PPLA3: 20, PPLA4: 15, PPL: 10 };

// geocodingِ آنلاینِ Open-Meteo — فقط ایران و فقط اسمِ دقیقاً یکسان. جستجویش فازی
// است: «میرم» را «میرمنا» برمی‌گرداند و «جاده» را «جاده تخته» (هر دو روستای واقعیِ
// ایران)؛ یک‌بار هم «هوای» به Huaibeiِ چین گره خورده بود.
// strict یعنی کاربر نه کلمه‌ی هوا گفته نه تاریخ — آن‌وقت فقط شهرهای اصلی قبول‌اند
async function geocodeIran(name, strict) {
  const key = cityKey(name);
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityWordForm(normalizeText(name)))}&count=10&language=fa&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    let best = null;
    for (const r of data.results || []) {
      if (r.country_code !== 'IR' || cityKey(r.name || '') !== key) continue;
      const rank = FEATURE_RANK[r.feature_code] || 0;
      const major = rank >= 30 || (r.population || 0) >= 20000;
      if (strict && !major) continue;
      const score = rank + Math.log10((r.population || 0) + 1) * 5;
      if (!best || score > best.score) {
        best = { score, loc: { name: normalizeText(r.name), lat: r.latitude, lon: r.longitude, province: r.admin1 || 'ایران' } };
      }
    }
    return best;
  } catch (e) {
    console.warn('Geocoding error:', e);
    return null;
  }
}

// چند کاندیدا امتحان می‌شود و بهترین برنده است — نه «اولین کلمه‌ی ناشناخته» مثلِ قبل.
// دوکلمه‌ای‌ها اول («خرم آباد»، «بندر عباس»)
async function resolveCandidates(cands, strict) {
  let best = null;
  for (const cand of cands.slice(0, 5)) {
    const local = findLocalCity(cand);
    if (local) return { loc: local, from: cand };
    const hit = await geocodeIran(cand, strict);
    if (hit && (!best || hit.score > best.score)) best = { ...hit, from: cand };
    if (best && best.score >= 40) break; // شهرِ اصلیِ دقیق پیدا شد، بیشتر نگرد
  }
  return best;
}

// ==========================================
// 3. موتور فهم زبان طبیعی (Persian NLU) — بدون LLM، فقط قاعده
// ==========================================

// یکدست‌سازیِ متن پیش از هر تشخیصی: ی/ک عربی (کیبوردِ ویندوز و بعضی اندرویدها)
// ← فارسی، رقمِ فارسی/عربی ← لاتین، حذفِ اعراب
function normalizeText(text) {
  return String(text)
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\s+/g, ' ')
    .trim();
}

// نسخه‌ی «کلمه‌به‌کلمه» برای تشخیصِ تاریخ، قصد و شهر: «5-9» ← «5 تا 9»، علامت‌ها حذف،
// پسوندِ چسبیده با نیم‌فاصله کنده («هفته‌ی» ← «هفته»)، بقیه‌ی نیم‌فاصله‌ها فاصله
// («سه‌شنبه» ← «سه شنبه»، «پس‌فردا» ← «پس فردا»)
function toWordForm(norm) {
  return norm
    .replace(/(\d)\s*[-–]\s*(\d)/g, '$1 تا $2')
    .replace(/[؟?!.,،:;«»"'()\[\]\-–_/]/g, ' ')
    .replace(/‌(?:ی|ای|ها|های|هایی)(?=\s|$)/g, '')
    .replace(/‌/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// الگو فقط وقتی مچ می‌شود که «کلمه‌ی کامل» باشد، نه تکه‌ای از کلمه‌ی دیگر.
// قبلاً «دی» داخلِ «دیگه» ماهِ دی حساب می‌شد و «۲ تا ۳ روز دیگه» می‌شد «۲ تا ۳ دی»
const wordRe = (src, flags = '') => new RegExp(`(?:^|\\s)(?:${src})(?=\\s|$)`, flags);

// عددِ حرفی ۱ تا ۳۱، هم شمارشی («پنج»، «پونزده») هم ترتیبی («پنجم»، «سوم»، «بیست و یکم»)
const NUMBER_WORDS = (() => {
  const base = {
    'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'چار': 4, 'پنج': 5, 'شش': 6, 'شیش': 6, 'هفت': 7,
    'هشت': 8, 'نه': 9, 'ده': 10, 'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14,
    'چارده': 14, 'پانزده': 15, 'پونزده': 15, 'شانزده': 16, 'شونزده': 16, 'هفده': 17,
    'هیفده': 17, 'هجده': 18, 'هیجده': 18, 'نوزده': 19, 'بیست': 20, 'سی': 30,
  };
  const cardinal = { ...base };
  for (const u of ['یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه']) cardinal[`بیست و ${u}`] = 20 + base[u];
  cardinal['سی و یک'] = 31;
  const out = { 'یه': 1, 'اول': 1 };
  for (const [w, v] of Object.entries(cardinal)) {
    out[w] = v;
    if (w.endsWith('سه')) out[w.slice(0, -2) + 'سوم'] = v;        // سه ← سوم
    else if (w.endsWith('ی')) { out[w + ' ام'] = v; out[w + 'ام'] = v; } // سی ام
    else out[w + 'م'] = v;                                          // پنجم، بیست و یکم
  }
  return out;
})();
const NUM_SRC = `\\d{1,3}|${Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|')}`;
const parseNum = s => (/^\d+$/.test(s) ? parseInt(s, 10) : s === 'ی' ? 1 : NUMBER_WORDS[s] ?? null);

const MONTH_SRC = '(فروردین|اردیبهشت|خرداد|تیر|امرداد|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)(?: ?ماه)?';
const monthIndex = w => (PERSIAN_MONTHS.indexOf(w) + 1) || (w === 'امرداد' ? 5 : 0);
const NEXT_SRC = '(آینده|اینده|بعد|بعدی|بعدش|دیگه|دیگر)';
const UNIT_SRC = '(روز|روزه|روزا|روزها|روزای|روزهای|هفته|ماه)';
const unitDays = u => (u.startsWith('روز') ? 1 : u === 'هفته' ? 7 : 30);
const WEEKDAY_SRC = '(یک ?شنبه|یه ?شنبه|دو ?شنبه|سه ?شنبه|سشنبه|چهار ?شنبه|چار ?شنبه|پنج ?شنبه|شنبه|جمعه)';
// getDay(): ۰ = یکشنبه … ۶ = شنبه
const WEEKDAY_INDEX = {
  'یکشنبه': 0, 'یهشنبه': 0, 'دوشنبه': 1, 'سهشنبه': 2, 'سشنبه': 2,
  'چهارشنبه': 3, 'چارشنبه': 3, 'پنجشنبه': 4, 'جمعه': 5, 'شنبه': 6,
};

// تاریخ را از جمله درمی‌آورد. هر الگو که پیدا شد یک «اشاره» می‌شود و جایش با فاصله
// پوشانده می‌شود تا الگوهای بعدی دوباره نخورندش («پس فردا» ≠ «فردا»، «آخر هفته» ≠
// «هفته»). آخرِ کار دو اشاره با «تا» بازه می‌شوند و با «و» یکی.
// start/end = بازه‌ای که اشاره به‌تنهایی می‌گوید؛ ps/pe = نقطه‌اش وقتی سرِ یک «تا» است
function parseDateRange(wf, today) {
  const cur = gregorianToJalali(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const mentions = [];
  let masked = wf;

  const scan = (src, build) => {
    const re = wordRe(src, 'g');
    const found = [];
    let m;
    while ((m = re.exec(masked)) !== null) {
      const lead = /^\s/.test(m[0]) ? 1 : 0;
      found.push({ m, pos: m.index + lead, len: m[0].length - lead });
    }
    for (const f of found) {
      const built = build(f.m, f.pos);
      if (!built) continue;
      mentions.push({ pos: f.pos, len: f.len, ...built });
      masked = masked.slice(0, f.pos) + ' '.repeat(f.len) + masked.slice(f.pos + f.len);
    }
  };

  const point = d => ({ start: d, end: d, ps: d, pe: d });
  const span = (s, e) => ({ start: s, end: e, ps: s, pe: e });
  // ماهِ گذشته‌ی امسال یعنی سالِ بعد («۵ فروردین» وقتی الان مهر است)
  const yearFor = jm => (jm < cur.jm ? cur.jy + 1 : cur.jy);
  const nextDow = (dow, strictlyAfter) => {
    let n = (dow - today.getDay() + 7) % 7;
    if (n === 0 && strictlyAfter) n = 7;
    return addDays(today, n);
  };
  const monthEnd = (jy, jm) => jalaliToDate(jy, jm, jalaliMonthLength(jy, jm));
  const ORD = '(?: ?ام)?';

  // ۱. بازه‌ی صریحِ شمسی: «۵ تا ۹ مهر»، «پنجم تا نهم آبان»، «۲۵ مهر تا ۵ آبان»
  scan(`(${NUM_SRC})${ORD}(?: ${MONTH_SRC})? (?:تا|الی) (${NUM_SRC})${ORD} ${MONTH_SRC}`, m => {
    const d1 = parseNum(m[1]), d2 = parseNum(m[3]);
    if (!d1 || !d2 || d1 > 31 || d2 > 31) return null;
    const m2 = monthIndex(m[4]), m1 = m[2] ? monthIndex(m[2]) : m2;
    const y1 = yearFor(m1), y2 = m2 < m1 ? y1 + 1 : y1; // «۲۵ اسفند تا ۵ فروردین»
    const s = jalaliToDate(y1, m1, d1), e = jalaliToDate(y2, m2, d2);
    return s <= e ? span(s, e) : span(e, s);
  });

  // ۲. یک روزِ صریح: «۱۵ مهر»، «پونزدهم مهر»، «اول آبان»
  scan(`(${NUM_SRC})${ORD} ${MONTH_SRC}`, m => {
    const d = parseNum(m[1]);
    if (!d || d > 31) return null;
    const jm = monthIndex(m[2]);
    return point(jalaliToDate(yearFor(jm), jm, d));
  });

  // ۳. «N روز/هفته پیش» ← گذشته
  scan(`(${NUM_SRC}|ی) ${UNIT_SRC} (?:پیش|قبل)`, m => {
    const n = parseNum(m[1]);
    return n ? point(addDays(today, -n * unitDays(m[2]))) : null;
  });

  // ۴. «N روز/هفته/ماه». با «دیگه/بعد» یعنی «تا آن روز» و خودِ آن روز برجسته
  //    می‌شود («یه هفته دیگه» = امروز تا ۷ روز بعد، روزِ هفتم پررنگ)؛ با «آینده» یا
  //    بی‌پسوند یعنی N روزِ پیشِ رو؛ «۲ تا ۳ روز دیگه» = همان دو روز
  scan(`(?:(${NUM_SRC}) (?:تا|الی) )?(${NUM_SRC}|ی) ${UNIT_SRC}(?: ${NEXT_SRC})?`, m => {
    const n2 = parseNum(m[2]);
    const n1 = m[1] ? parseNum(m[1]) : null;
    if (!n2 || (m[1] && !n1)) return null;
    const u = unitDays(m[3]);
    const after = /دیگ|بعد/.test(m[4] || '');
    if (n1 && after) {
      return span(addDays(today, Math.min(n1, n2) * u), addDays(today, Math.max(n1, n2) * u));
    }
    const n = n1 ? Math.max(n1, n2) : n2;
    if (after) {
      const target = addDays(today, n * u);
      return { start: today, end: target, ps: target, pe: target, focus: target };
    }
    return span(today, addDays(today, n * u - 1));
  });

  // ۵. «چند روز» = پنج روزِ پیشِ رو، «چند هفته» = دو هفته
  scan(`چند ${UNIT_SRC}(?: ${NEXT_SRC})?`, m => {
    const u = unitDays(m[1]);
    return span(today, addDays(today, u === 1 ? 4 : u * 2 - 1));
  });

  // ۶. آخر هفته = پنجشنبه و جمعه؛ اگر امروز جمعه است، همین امروز
  scan(`(?:آخر|تعطیلات|تعطیلی) ?هفته(?:(?: ی| ای)? ${NEXT_SRC})?`, m => {
    if (today.getDay() === 5 && !m[1]) return point(today);
    let thu = nextDow(4, false);
    if (m[1] && today.getDay() !== 5) thu = addDays(thu, 7);
    return span(thu, addDays(thu, 1));
  });

  // ۷. «این هفته» = امروز تا جمعه؛ «هفته‌ی بعد/آینده/دیگه» = شنبه تا جمعه‌ی بعد
  scan('(?:این|همین) ?هفته', () => span(today, nextDow(5, false)));
  scan(`هفته(?: ی| ای)? ${NEXT_SRC}`, () => {
    const sat = nextDow(6, true);
    return span(sat, addDays(sat, 6));
  });

  // ۸. ماهِ جاری و ۳۰ روزِ پیشِ رو
  scan('(?:این|همین) ?ماه', () => span(today, monthEnd(cur.jy, cur.jm)));
  scan('آخر ?ماه', () => point(monthEnd(cur.jy, cur.jm)));
  scan(`ماه(?: ی| ای)? ${NEXT_SRC}`, () => span(today, addDays(today, 29)));

  // ۹. اسمِ ماه بدونِ روز: «اواخر مهر»، «اوایل آبان»، «کلِ آبان ماه». خودِ اسمِ ماه
  //    به‌تنهایی کافی نیست — «مهر»، «تیر»، «آذر» و «بهمن» کلمه یا اسمِ آدم هم هستند
  scan(`(?:(اوایل|اوائل|اواسط|وسط|اواخر|آخر|آخرای) )?${MONTH_SRC}`, (m, pos) => {
    const jm = monthIndex(m[2]);
    const before = masked.slice(0, pos).trim().split(' ').pop();
    if (!m[1] && !/ماه$/.test(m[0]) && !['تو', 'در', 'کل', 'طول', 'برای', 'واسه'].includes(before)) return null;
    const y = yearFor(jm), len = jalaliMonthLength(y, jm);
    const [d1, d2] = !m[1] ? [1, len] : /اوای|اوائ/.test(m[1]) ? [1, 10] : /وسط/.test(m[1]) ? [11, 20] : [21, len];
    return span(jalaliToDate(y, jm, d1), jalaliToDate(y, jm, d2));
  });

  // ۱۰. روزِ هفته: «سه‌شنبه»، «جمعه‌ی بعد»
  scan(`${WEEKDAY_SRC}(?:(?: ی| ای)? ${NEXT_SRC})?`, m => {
    const dow = WEEKDAY_INDEX[m[1].replace(/ /g, '')];
    return dow == null ? null : point(nextDow(dow, !!m[2]));
  });

  // ۱۱. امروز/فردا/پس‌فردا و گذشته‌ی نزدیک
  scan('پسون ?فردا|پسین ?فردا', () => point(addDays(today, 3)));
  scan('پس ?فردا', () => point(addDays(today, 2)));
  scan('فردا|فرداش', () => point(addDays(today, 1)));
  scan('امروز|امشب|الان|الآن|اکنون', () => point(today));
  scan('پریروز', () => point(addDays(today, -2)));
  scan('دیروز|دیشب', () => point(addDays(today, -1)));

  if (mentions.length === 0) return { range: null, masked };
  mentions.sort((a, b) => a.pos - b.pos);
  const [a, b] = mentions;
  const between = b ? masked.slice(a.pos + a.len, b.pos).trim() : null;
  let r = { start: a.start, end: a.end, focus: a.focus || null };
  if (b && /^(?:تا|الی|لغایت)$/.test(between)) {
    // «از فردا تا جمعه»، «فردا تا ۵ روز دیگه»
    r = a.ps <= b.pe ? { start: a.ps, end: b.pe, focus: null } : { start: b.pe, end: a.ps, focus: null };
  } else if (b && (between === 'و' || between === '')) {
    // «امروز و فردا»
    r = { start: a.start < b.start ? a.start : b.start, end: a.end > b.end ? a.end : b.end, focus: null };
  } else if (/(?:^|\s)(?:تا|الی|لغایت)$/.test(masked.slice(0, a.pos).trim())) {
    // «تا جمعه»، «تا آخر هفته»، «تا ۱۵ مهر»
    r = { start: today, end: a.pe, focus: null };
  }
  return { range: r, masked };
}

// بازه‌ی خام ← بازه‌ی قابلِ نمایش: گذشته علامت می‌خورد، روزهای ردشده کنار می‌روند،
// بیش از ۳۱ روز بریده می‌شود (هر کدام بعداً صریح به کاربر گفته می‌شود)
function finalizeRange(r, today) {
  if (!r) return null;
  let { start, end } = r;
  if (end < start) [start, end] = [end, start];
  if (end < today) return { start, end, focus: null, past: true };
  const out = { start, end, focus: r.focus || null };
  if (start < today) { out.start = today; out.clampedPast = true; }
  if (daysBetween(out.start, out.end) > 30) { out.end = addDays(out.start, 30); out.capped = true; }
  if (out.focus && (out.focus < out.start || out.focus > out.end)) out.focus = null;
  return out;
}

function describeRange(range) {
  const today = startOfDay(new Date());
  if (daysBetween(range.start, range.end) === 0) {
    return relativeDayWord(range.start, today) || getJalaliDateStr(range.start).full;
  }
  return `${getJalaliDateStr(range.start).short} تا ${getJalaliDateStr(range.end).short}`;
}

// قصد و کلمه‌های هواشناسی — کلمه‌ی کامل با پسوندِ محاوره‌ای («بارونیه»، «دمای»، «سرده»).
// قبلاً تکه‌ای مچ می‌شد: «یخ» داخلِ «تاریخ» قصد را «دما» می‌کرد و «گرم» داخلِ «گرمسار»
const WX_SFX = '(?:ی|یه|ه|ها|ای|و|ناک|تر|ترین|تره)?';
const RAIN_RE = wordRe(`(?:بارو?ن|باران|بارش|رگبار|چتر|خیس|نم ?نم)${WX_SFX}|نمی ?باره|می ?باره|بباره`);
const TEMP_RE = wordRe(`(?:سرد|گرم|دما|درجه|خنک|یخ|یخبندان|سرما|گرما|حرارت)${WX_SFX}`);
const WIND_RE = wordRe(`(?:باد|طوفان|وزش|تندباد|طوفانی|گردباد|نسیم)${WX_SFX}|می ?وزه|بوزه`);
const SKY_RE = wordRe(`(?:برف|طوفان|باد|ابر|آفتاب|مه|هوا|آسمو?ن|آسمان|رطوبت|شرجی|غبار|ریزگرد|هواشناسی)${WX_SFX}|مه ?آلود|گرد ?و ?خاک|آب و هوا`);

// کلماتی که هیچ‌وقت اسم شهر نیستند — هرچه از جمله بماند، کاندیدای شهر است
const STOPWORDS = new Set([
  // هواشناسی
  'بارون', 'باران', 'بارش', 'چتر', 'خیس', 'رگبار', 'برف', 'سرد', 'گرم', 'دما', 'درجه',
  'خنک', 'یخ', 'طوفان', 'باد', 'وزش', 'تندباد', 'نسیم', 'ابر', 'ابری', 'آفتاب', 'آفتابی', 'مه', 'هوا', 'آب',
  'آسمون', 'آسمان', 'رطوبت', 'شرجی', 'هواشناسی', 'احتمال', 'درصد', 'میلیمتر',
  // زمان و نسبت
  'امروز', 'فردا', 'پسفردا', 'پس', 'دیروز', 'هفته', 'آینده', 'اینده', 'بعد', 'بعدی', 'بعدش',
  'آخر', 'اخر', 'ماه', 'روز', 'روزه', 'روزا', 'روزها', 'روزای', 'دیگه', 'دیگر', 'الان', 'حالا',
  'صبح', 'ظهر', 'عصر', 'شب', 'امشب', 'دیشب', 'بخیر', 'ساعت', 'چند', 'پیش', 'قبل', 'همین',
  'اوایل', 'اواسط', 'اواخر', 'آخرای', 'تعطیلات', 'تعطیلی', 'لغایت', 'کل', 'طول', 'وقت',
  'شنبه', 'جمعه', 'یکشنبه', 'دوشنبه', 'سشنبه', 'چهارشنبه', 'پنجشنبه',
  // پرسش و فعل
  'چطوره', 'چطوریه', 'چطوری', 'چطور', 'چجوری', 'چجوریه', 'چیه', 'چیست', 'چی', 'چه',
  'هست', 'هستش', 'است', 'بود', 'داریم', 'دارم', 'داره', 'دارن', 'نداره', 'نداریم',
  'میشه', 'نمیشه', 'میاد', 'نمیاد', 'میاره', 'بشه', 'بیاد', 'میزنه', 'بزنه', 'میباره', 'بباره',
  'بگو', 'بگی', 'بده', 'ببینم', 'بدونم', 'میخواستم', 'میخوام', 'می‌خوام', 'خوبه', 'بده',
  'آیا', 'کی', 'چقدر', 'چنده', 'وضعیت', 'وضع', 'اوضاع', 'شرایط', 'پیش‌بینی', 'پیشبینی', 'بینی',
  'لطفا', 'لطفاً', 'سلام', 'مرسی', 'ممنون', 'خبر', 'چک', 'کن', 'بکن', 'بنداز', 'نگاه',
  'برم', 'میرم', 'بریم', 'میریم', 'سفر', 'جاده', 'شهر', 'استان', 'منطقه', 'سمت', 'طرف',
  'حوالی', 'اطراف', 'نزدیک', 'خیلی', 'یکم', 'کمی', 'زیاد', 'کم', 'شدید', 'تند', 'حسابی',
  'دقیق', 'دقیقا', 'دقیقاً', 'تقریبا', 'تقریباً', 'رفیق', 'داداش', 'عزیزم', 'جان', 'جون',
  // حرف ربط و ضمیر
  'و', 'یا', 'که', 'این', 'آن', 'اون', 'با', 'از', 'به', 'تا', 'رو', 'را', 'هم', 'در', 'تو',
  'توی', 'روی', 'ما', 'من', 'شما', 'اونجا', 'اینجا', 'همونجا', 'برای', 'واسه', 'الی', 'یک', 'یه',
  'می', 'نمی', 'اما', 'ولی', 'خب', 'اونم', 'اینم',
]);

// پسوندِ محاوره‌ای هم حساب می‌شود: «هوای»، «سرده»، «فرداش». ریشه باید دست‌کم ۳ حرف
// باشد، وگرنه «کیش» (کی + ش) هم کلمه‌ی دستوری حساب می‌شد
function isStopword(t) {
  if (STOPWORDS.has(t)) return true;
  for (const sfx of ['ی', 'ه', 'و', 'ش', 'یه', 'ای', 'ها', 'های']) {
    if (t.length - sfx.length >= 3 && t.endsWith(sfx) && STOPWORDS.has(t.slice(0, -sfx.length))) return true;
  }
  return false;
}

function isCityCandidate(t) {
  return t.length >= 2 && !/^\d+$/.test(t) && !(t in NUMBER_WORDS) && !isStopword(t) &&
    !PERSIAN_MONTHS.includes(t) && !RAIN_RE.test(t) && !TEMP_RE.test(t) && !WIND_RE.test(t) && !SKY_RE.test(t);
}

// هر کلمه‌ای که تاریخ، هوا، عدد یا کلمه‌ی دستوری نیست، کاندیدای اسمِ شهر است:
// اول دوکلمه‌ای‌های پشتِ‌سرِهم («خرم آباد»)، بعد تک‌کلمه‌ها، بعد بی‌«و»ِ محاوره («کوهدشتو»)
function extractCityCandidates(masked) {
  const toks = masked.split(' ');
  const ok = toks.map(isCityCandidate);
  const out = [];
  for (let i = 0; i + 1 < toks.length; i++) if (ok[i] && ok[i + 1]) out.push(`${toks[i]} ${toks[i + 1]}`);
  toks.forEach((t, i) => { if (ok[i]) out.push(t); });
  toks.forEach((t, i) => { if (ok[i] && t.length > 3 && /[وه]$/.test(t)) out.push(t.slice(0, -1)); });
  return [...new Set(out)];
}

// شهرهای لیستِ داخلی: کلمه‌ی کامل، با «و»ِ محاوره («تهرانو»)
function findCityInText(wf) {
  for (const n of CITY_NAMES) {
    const m = wordRe(`${n.w}(?:و)?`).exec(wf);
    if (m) {
      const lead = /^\s/.test(m[0]) ? 1 : 0;
      return { city: n.city, pos: m.index + lead, len: m[0].length - lead };
    }
  }
  return null;
}

function parseQuery(text) {
  const today = startOfDay(new Date());
  const norm = normalizeText(text);

  // 0. تشخیص قصد‌های عمومی مکالمه (احوال‌پرسی، تشکر، هویت، موضوعات بی‌ربط)
  const isGreeting = /^(سلام|درود|سلام علیکم|چطوری|خوبی|حالت چطوره|صبح بخیر|شب بخیر|عصر بخیر|چه خبر|چخبر|سلامت باشی|hi|hello|hey)[\s!؟?.]*$/i.test(norm);
  if (isGreeting) {
    return { type: 'greeting', rawText: norm };
  }

  const isThanks = /^(مرسی|ممنون|دستت درد نکنه|دمت گرم|تشکر|خیلی ممنون|سپاس|عشقی|نوکرتم|عالی بود)(\s+(رفیق|داداش|عزیزم|جان|خیلی|زیاد))*[\s!؟?.]*$/i.test(norm);
  if (isThanks) {
    return { type: 'thanks', rawText: norm };
  }

  const isIdentity = /(تو کی هستی|اسمت چیه|چیکار میتونی بکنی|خودتو معرفی کن|چه کارهایی بلدی|چیکاره ای)/i.test(norm);
  if (isIdentity) {
    return { type: 'identity', rawText: norm };
  }

  const wf = toWordForm(norm);
  const { range: rawRange, masked } = parseDateRange(wf, today);
  const range = finalizeRange(rawRange, today);

  let userIntent = 'general'; // 'rain', 'temp', 'wind', 'general'
  if (RAIN_RE.test(wf)) userIntent = 'rain';
  else if (TEMP_RE.test(wf)) userIntent = 'temp';
  else if (WIND_RE.test(wf)) userIntent = 'wind';
  const hasWeatherKeywords = userIntent !== 'general' || SKY_RE.test(wf);
  const isClearlyIrrelevant = /دلار|سکه|طلا|ارز|بیت\s*کوین|فوتبال|استقلال|پرسپولیس|رونالدو|مسی|غذا|شام|ناهار|فیلم|آهنگ|موسیقی|برنامه\s*نویسی|پزشک|دکتر|دارو|جوک|لطیفه|سیاست|اخبار\s*روز/i.test(norm);

  // 1. شهر — اول لیستِ داخلی، وگرنه هر کلمه‌ای که تاریخ/هوا/دستوری نیست کاندیدا می‌شود
  //    (geocodingِ آنلاین بعداً در handleUserSubmit، چون async است)
  const local = findCityInText(masked);
  const rest = local ? masked.slice(0, local.pos) + ' '.repeat(local.len) + masked.slice(local.pos + local.len) : masked;
  const cityCandidates = local ? [] : extractCityCandidates(rest);

  if (!local && !hasWeatherKeywords && (isClearlyIrrelevant || (!range && cityCandidates.length === 0))) {
    return { type: 'irrelevant', rawText: norm };
  }

  return {
    type: 'weather',
    city: local ? local.city : null,
    cityCandidates,
    range,
    userIntent,
    hasWeatherKeywords,
    rawText: norm
  };
}

// ==========================================
// 4. دریافت داده‌های هواشناسی (Forecast & Climate)
// ==========================================
const WMO_CODES = {
  0: { desc: 'صاف و آفتابی', icon: '☀️' },
  1: { desc: 'عمدتاً آفتابی', icon: '🌤️' },
  2: { desc: 'نیمه‌ابری', icon: '⛅' },
  3: { desc: 'تمام‌ابری و گرفته', icon: '☁️' },
  45: { desc: 'مه‌آلود', icon: '🌫️' },
  48: { desc: 'مه با سوز و یخ‌زدگی', icon: '🌫️' },
  51: { desc: 'نم‌نم بارون پراکنده', icon: '🌦️' },
  53: { desc: 'بارون ملایم', icon: '🌧️' },
  55: { desc: 'بارون متناوب و گاه‌به‌گاه', icon: '🌧️' },
  61: { desc: 'بارونی', icon: '🌧️' },
  63: { desc: 'بارون حسابی', icon: '🌧️' },
  65: { desc: 'بارون شدید و تند', icon: '🌧️⛈️' },
  71: { desc: 'برف پراکنده', icon: '🌨️' },
  73: { desc: 'برف قشنگ', icon: '🌨️' },
  75: { desc: 'برف سنگین و کولاک', icon: '❄️' },
  80: { desc: 'رگبار بارون', icon: '🌦️' },
  81: { desc: 'رگبار تند', icon: '🌧️' },
  82: { desc: 'رگبار شدید', icon: '⛈️' },
  95: { desc: 'رعدوبرق و بارون', icon: '⛈️' }
};

function getWmoInfo(code) {
  return WMO_CODES[code] || { desc: 'هوای متغیر', icon: '🌤️' };
}

function toIsoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// سه مدل عددی مستقل — اروپا (ECMWF)، آمریکا (GFS)، آلمان (ICON).
// به‌جای یک عدد از یک مدل، هر روز را هر سه مدل جدا پیش‌بینی می‌کنند و
// «چند مدل از ۳ تا با هم موافقند» جای درصدِ ساختگی را می‌گیرد.
const ENSEMBLE_MODELS = ['ecmwf_ifs025', 'gfs_seamless', 'icon_seamless'];
const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

// ساعتِ تقریبیِ شروع بارش برای یک روزِ مشخص: اولین بلوکِ ساعت‌هایی که حداقل
// نصفِ مدل‌ها روش موافقند (≥ ۰٫۲ میلی‌متر). این مدل‌محوره (مثل خودِ AccuWeather
// خارج از رادار)، نه رادارِ لحظه‌ای — دقتش در حدِ ساعت است نه دقیقه.
function findRainWindow(hourly, dayIso) {
  const idxs = hourly.time
    .map((t, i) => (t.startsWith(dayIso) ? i : -1))
    .filter(i => i !== -1);
  if (idxs.length === 0) return null;

  const series = ENSEMBLE_MODELS.map(m => hourly[`precipitation_${m}`] || []);
  const need = Math.ceil(ENSEMBLE_MODELS.length / 2); // ≥۲ از ۳

  let start = null, end = null;
  for (const i of idxs) {
    const agree = series.filter(s => (s[i] ?? 0) >= 0.2).length;
    if (agree >= need) {
      if (start === null) start = i;
      end = i;
    } else if (start !== null) {
      break; // اولین بلوک تمام شد
    }
  }
  if (start === null) return null;
  const startHour = parseInt(hourly.time[start].slice(11, 13), 10);
  const endHour = parseInt(hourly.time[end].slice(11, 13), 10) + 1;
  return {
    startHour, endHour,
    // وقتی بارش تقریباً کلِ روز طول می‌کشد، «بین ساعتِ ۰ تا ۲۱» چیزی به کسی
    // نمی‌گه — گفتنِ «تقریباً کل روز» مفیدتره از یه بازه‌ی کاذبِ دقیق‌نما
    allDay: (endHour - startHour) >= 18,
  };
}

const FORECAST_DAYS = 16;
const MODEL_SHORT = { ecmwf_ifs025: 'ECMWF', gfs_seamless: 'GFS', icon_seamless: 'ICON' };

async function fetchForecastDays(lat, lon, startIso, endIso) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max` +
    `&hourly=precipitation` +
    `&models=${ENSEMBLE_MODELS.join(',')}&forecast_days=${FORECAST_DAYS}&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Forecast HTTP error ${res.status}`);
  const data = await res.json();

  const daily = data.daily;
  const hourly = data.hourly;
  const days = [];

  for (let i = 0; i < daily.time.length; i++) {
    const timeIso = daily.time[i];
    // مقایسه مستقیم و بدون خطای تایم‌زون
    if (timeIso < startIso || timeIso > endIso) continue;
    const dObj = new Date(timeIso + 'T00:00:00');

    // مقدار هر مدل برای این روز — اگر مدلی دیتا نداشت (null) نادیده گرفته می‌شود.
    // واقعیتِ داده: ICON فقط ~۷ روز جلو را دارد و ECMWF ~۱۵ روز، پس روزهای ۸ تا ۱۵
    // دومدلی‌اند و روزِ ۱۶ فقط GFS — این تعداد باید روی کارت صادقانه بیاید
    const perModel = ENSEMBLE_MODELS.map(m => ({
      model: MODEL_SHORT[m],
      maxT: daily[`temperature_2m_max_${m}`]?.[i],
      minT: daily[`temperature_2m_min_${m}`]?.[i],
      precip: daily[`precipitation_sum_${m}`]?.[i] ?? 0,
      wmo: daily[`weather_code_${m}`]?.[i],
      windSpeed: daily[`wind_speed_10m_max_${m}`]?.[i] != null ? Math.round(daily[`wind_speed_10m_max_${m}`][i]) : null,
      windGust: daily[`wind_gusts_10m_max_${m}`]?.[i] != null ? Math.round(daily[`wind_gusts_10m_max_${m}`][i]) : null,
    })).filter(m => m.maxT != null && m.minT != null);

    if (perModel.length === 0) continue;

    const windSpeeds = perModel.map(m => m.windSpeed).filter(v => v != null);
    const windGusts = perModel.map(m => m.windGust).filter(v => v != null);
    const windMax = windSpeeds.length > 0 ? Math.round(avg(windSpeeds)) : null;
    const gustMax = windGusts.length > 0 ? Math.round(avg(windGusts)) : null;

    const agree = perModel.filter(m => m.precip >= 0.5).length;
    // آیکون باید با درصدی که نشون می‌دیم یکی باشه — قبلاً همیشه از
    // ECMWF تنها می‌اومد، پس ممکن بود بگیم «۶۷٪ بارون» ولی آیکون آفتابی
    // بمونه (چون فقط دوتای دیگه بارون می‌گفتن، نه ECMWF). حالا: اگه
    // اکثریتِ مدل‌ها روی بارون توافق دارن، آیکون از میانِ همون‌ها میاد
    const majority = Math.ceil(perModel.length / 2);
    const rainingModels = perModel.filter(m => m.precip >= 0.5);
    const refModel = agree >= majority
      ? rainingModels.sort((a, b) => b.precip - a.precip)[0]
      : perModel[0];
    const wmo = getWmoInfo(refModel.wmo);

    days.push({
      date: dObj,
      iso: timeIso,
      jalali: getJalaliDateStr(dObj),
      maxTemp: Math.round(avg(perModel.map(m => m.maxT))),
      minTemp: Math.round(avg(perModel.map(m => m.minT))),
      precipSum: Math.round(avg(perModel.map(m => m.precip)) * 10) / 10,
      modelsAgree: agree,
      modelsTotal: perModel.length,
      models: perModel.map(m => m.model),
      windMax,
      gustMax,
      perModel,
      desc: wmo.desc,
      icon: wmo.icon,
      rainWindow: hourly ? findRainWindow(hourly, timeIso) : null
    });
  }
  return days;
}

// منبع از روی داده‌ی واقعیِ همین جواب، نه یک جمله‌ی ثابت — قبلاً همیشه «سه مدل»
// نوشته می‌شد حتی برای روزی که فقط GFS داشت
function describeSource(days) {
  const groups = [];
  for (const d of days) {
    const key = d.models.join(' · ');
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.n++;
    else groups.push({ key, n: 1 });
  }
  const one = g => (g.key.includes('·') ? `میانگین ${g.key}` : `فقط ${g.key}`);
  if (groups.length === 1) {
    const g = groups[0];
    const k = g.key.split(' · ').length;
    return k > 1 ? `میانگین ${k} مدل عددی مستقل (${g.key})` : `فقط مدلِ ${g.key} (بقیه این‌قدر جلو رو ندارن)`;
  }
  return groups.map(g => `${g.n} روز ${one(g)}`).join(' ← ');
}

// پیش‌بینیِ چندمدلی تا سقف ۱۶ روز (امروز تا ۱۵ روز بعد).
// هیچ دیتای فرضی یا سالِ قبل واکشی نمی‌شود؛ اگر بازه از ۱۶ روز رد شود،
// سقف ۱۶ روز اعمال شده و شفاف به کاربر توضیح داده می‌شود.
async function fetchWeatherData(lat, lon, startDate, endDate) {
  const today = startOfDay(new Date());
  const lastForecast = addDays(today, FORECAST_DAYS - 1);
  let days = [];

  const isBeyond16Days = startDate > lastForecast;
  const isCappedAt16Days = endDate > lastForecast;

  // اگر کاربر کلاً تاریخی فراتر از ۱۶ روز خواسته، ۱۶ روز پیش‌رو را برایش می‌آوریم
  const fStart = isBeyond16Days ? today : (startDate < today ? today : startDate);
  const fEnd = endDate < lastForecast ? endDate : lastForecast;

  if (fStart <= fEnd) {
    try {
      days = await fetchForecastDays(lat, lon, toIsoDate(fStart), toIsoDate(fEnd));
    } catch (e) {
      console.warn('Forecast API fetch failed:', e);
      return null;
    }
  }

  if (days.length === 0) return null;

  return {
    type: 'exact',
    days,
    source: describeSource(days),
    isCappedAt16Days: isCappedAt16Days || isBeyond16Days,
    isBeyond16Days: isBeyond16Days
  };
}

// ==========================================
// 5. تولید پاسخ روان، تحلیلی و کارت‌های چت
// ==========================================
// دکمه‌های عوضِ بازه زیرِ هر جواب — اگر بازه را بد فهمیدم، یک کلیک درستش می‌کند.
// بدونِ اسمِ شهر هم کار می‌کنند، چون شهرِ قبلی در حافظه‌ی گفت‌وگو هست
function rangeChips(cityName, start, end) {
  const today = startOfDay(new Date());
  const c = cityName ? ` ${cityName}` : '';
  const all = [
    { label: 'امروز', query: `امروز${c}`, s: 0, e: 0 },
    { label: 'فردا', query: `فردا${c}`, s: 1, e: 1 },
    { label: '۳ روز', query: `۳ روز${c}`, s: 0, e: 2 },
    { label: 'یه هفته', query: `یه هفته${c}`, s: 0, e: 6 },
    { label: '۱۶ روز', query: `۱۶ روز${c}`, s: 0, e: 15 },
  ];
  const s = start ? daysBetween(today, start) : null;
  const e = end ? daysBetween(today, end) : null;
  return all
    .filter(o => !(o.s === s && o.e === e))
    .map((o, i) => ({ label: (i === 0 ? '📅 ' : '') + o.label, query: o.query }));
}

const TIME_SLOTS = [
  { id: 'morning', label: '🌅 صبح (۶ تا ۱۲)', short: 'صبح' },
  { id: 'afternoon', label: '☀️ ظهر تا عصر (۱۲ تا ۱۸)', short: 'ظهر تا عصر' },
  { id: 'night', label: '🌙 شب (۱۸ تا ۲۴)', short: 'شب' },
  { id: 'fullday', label: '📅 کل روز (جمع‌بندی)', short: 'کل روز' },
];

function getDefaultSlot() {
  try {
    const h = new Date().getHours();
    if (h >= 6 && h < 12) return 'morning';
    if (h >= 12 && h < 18) return 'afternoon';
    return 'night';
  } catch (e) {
    return 'afternoon';
  }
}

function getRealityLogs() {
  try {
    if (typeof localStorage === 'undefined') return [];
    return JSON.parse(localStorage.getItem('weather_reality_logs') || '[]');
  } catch (e) {
    return [];
  }
}

const FEEDBACK_SERVER_URL = 'https://genopars.ir/wp-content/mu-plugins/weather/weather_feedback.php';

async function sendRealityLogToServer(entry) {
  const url = (typeof window !== 'undefined' && window.FEEDBACK_SERVER_URL) || FEEDBACK_SERVER_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      mode: 'cors'
    });
  } catch (e) {
    // خطای اتصال به سرور نادیده گرفته می‌شود
  }
}

function saveRealityLog(entry) {
  try {
    if (typeof localStorage === 'undefined') return;
    const logs = getRealityLogs();
    const idx = logs.findIndex(l => l.id === entry.id);
    if (idx >= 0) {
      logs[idx] = { ...logs[idx], ...entry };
    } else {
      logs.unshift(entry);
    }
    localStorage.setItem('weather_reality_logs', JSON.stringify(logs));
    sendRealityLogToServer(entry);
  } catch (e) {
    console.error('Error saving reality log:', e);
  }
}

function deleteRealityLog(id) {
  try {
    if (typeof localStorage === 'undefined') return;
    const logs = getRealityLogs().filter(l => l.id !== id);
    localStorage.setItem('weather_reality_logs', JSON.stringify(logs));
  } catch (e) {
    console.error('Error deleting reality log:', e);
  }
}

function describeWind(day) {
  if (day.windMax == null) return 'داده‌ی باد در دسترس نیست';
  const gust = day.gustMax;
  if (gust && gust >= 55) {
    return `وزش باد بسیار شدید و تندباد لحظه‌ای تا **${gust} km/h** 🌪️`;
  }
  if (gust && gust >= 38) {
    return `وزش باد قابل‌توجه (سرعت تا **${day.windMax}** و تندباد لحظه‌ای تا **${gust} km/h**) 💨`;
  }
  if (day.windMax >= 25) {
    return `وزش باد ملایم تا متوسط (تا **${day.windMax} km/h**) 🍃`;
  }
  return `باد آرام (تا **${day.windMax} km/h**)`;
}

const isWindy = d => (d.gustMax != null && d.gustMax >= 38) || (d.windMax != null && d.windMax >= 25);

function getRainDissent(d) {
  if (!d.perModel || d.modelsTotal < 2) return null;
  const raining = d.perModel.filter(m => m.precip >= 0.5);
  const majority = Math.ceil(d.modelsTotal / 2);
  if (raining.length > 0 && raining.length < majority) {
    return {
      rainingModels: raining,
      dryModels: d.perModel.filter(m => m.precip < 0.5),
    };
  }
  return null;
}

const METRO_AREAS = {
  'تهران': {
    title: 'سمتِ شهر در تهران',
    keywords: ['تهران', 'تهرون', 'شمیران', 'تجریش', 'ولنجک', 'نیاوران', 'چیتگر', 'صادقیه', 'شهرک غرب', 'تهرانپارس', 'لویزان', 'سرخه حصار', 'شهر ری', 'شهرری', 'نازی آباد'],
    districts: [
      { id: 'شرق', label: '🏢 شرق (تهرانپارس)', fullName: 'شرق تهران', matches: ['شرق تهران', 'تهرانپارس', 'لویزان', 'سرخه حصار'] },
      { id: 'شمال', label: '🏔️ شمال (تجریش)', fullName: 'شمال تهران', matches: ['شمال تهران', 'شمیران', 'تجریش', 'ولنجک', 'نیاوران'] },
      { id: 'غرب', label: '🌲 غرب (چیتگر)', fullName: 'غرب تهران', matches: ['غرب تهران', 'چیتگر', 'صادقیه', 'شهرک غرب'] },
      { id: 'مرکز', label: '🏙️ مرکز', fullName: 'مرکز تهران', matches: ['مرکز تهران'] },
      { id: 'جنوب', label: '🏛️ جنوب (ری)', fullName: 'جنوب تهران', matches: ['جنوب تهران', 'شهر ری', 'شهرری', 'نازی آباد'] },
    ]
  },
  'مشهد': {
    title: 'منطقه در مشهد',
    keywords: ['مشهد', 'طرقبه', 'شاندیز', 'وکیل آباد', 'وکیل‌آباد', 'قاسم آباد', 'قاسم‌آباد', 'حرم'],
    districts: [
      { id: 'طرقبه', label: '🌲 طرقبه و شاندیز', fullName: 'طرقبه', matches: ['طرقبه', 'شاندیز'] },
      { id: 'وکیل‌آباد', label: '🎡 وکیل‌آباد', fullName: 'وکیل‌آباد مشهد', matches: ['وکیل آباد', 'وکیل‌آباد'] },
      { id: 'مرکز', label: '🕌 حرم / مرکز', fullName: 'مشهد', matches: ['حرم'] },
      { id: 'قاسم‌آباد', label: '🏢 قاسم‌آباد', fullName: 'قاسم‌آباد مشهد', matches: ['قاسم آباد', 'قاسم‌آباد'] },
    ]
  },
  'اصفهان': {
    title: 'منطقه در اصفهان',
    keywords: ['اصفهان', 'کوه صفه', 'سپاهان شهر', 'سپاهان‌شهر', 'ناژوان', 'آتشگاه', 'شاهین شهر', 'شاهین‌شهر'],
    districts: [
      { id: 'صفه', label: '🏔️ کوه صفه / جنوب', fullName: 'کوه صفه اصفهان', matches: ['کوه صفه', 'صفه اصفهان', 'سپاهان شهر', 'سپاهان‌شهر', 'جنوب اصفهان'] },
      { id: 'مرکز', label: '🏛️ مرکز / نقش جهان', fullName: 'اصفهان', matches: ['نقش جهان', 'مرکز اصفهان'] },
      { id: 'ناژوان', label: '🌿 ناژوان / آتشگاه', fullName: 'ناژوان اصفهان', matches: ['ناژوان', 'آتشگاه', 'غرب اصفهان'] },
      { id: 'شاهین‌شهر', label: '🏭 شاهین‌شهر / شمال', fullName: 'شاهین‌شهر', matches: ['شاهین شهر', 'شاهین‌شهر', 'شمال اصفهان'] },
      { id: 'شرق', label: '✈️ شرق / فرودگاه', fullName: 'شرق اصفهان', matches: ['شرق اصفهان', 'فرودگاه اصفهان'] },
    ]
  },
  'شیراز': {
    title: 'منطقه در شیراز',
    keywords: ['شیراز', 'صدرا', 'قصرالدشت', 'قصر دشت', 'ارم', 'حافظیه'],
    districts: [
      { id: 'صدرا', label: '🏔️ صدرا / شمال‌غرب', fullName: 'شهر جدید صدرا', matches: ['صدرا', 'شمال غرب شیراز'] },
      { id: 'قصرالدشت', label: '🌿 قصرالدشت و ارم', fullName: 'قصرالدشت شیراز', matches: ['قصرالدشت', 'قصر دشت', 'ارم شیراز', 'باغ ارم'] },
      { id: 'مرکز', label: '🏛️ مرکز / حافظیه', fullName: 'شیراز', matches: ['حافظیه', 'مرکز شیراز'] },
      { id: 'جنوب', label: '✈️ جنوب / فرودگاه', fullName: 'جنوب شیراز', matches: ['جنوب شیراز', 'فرودگاه شیراز'] },
    ]
  },
  'کرج': {
    title: 'منطقه در کرج',
    keywords: ['کرج', 'عظیمیه', 'گوهردشت', 'رجایی شهر', 'رجایی‌شهر', 'مهرشهر', 'مهر شهر'],
    districts: [
      { id: 'عظیمیه', label: '🏔️ عظیمیه / شمال', fullName: 'عظیمیه کرج', matches: ['عظیمیه', 'شمال کرج'] },
      { id: 'گوهردشت', label: '🏙️ گوهردشت', fullName: 'گوهردشت کرج', matches: ['گوهردشت', 'رجایی شهر', 'رجایی‌شهر'] },
      { id: 'مرکز', label: '🏢 مرکز کرج', fullName: 'کرج', matches: ['مرکز کرج'] },
      { id: 'مهرشهر', label: '🌿 مهرشهر / جنوب', fullName: 'مهرشهر کرج', matches: ['مهرشهر', 'مهر شهر', 'جنوب کرج'] },
    ]
  },
  'تبریز': {
    title: 'منطقه در تبریز',
    keywords: ['تبریز', 'ائل گلی', 'ائل‌گلی', 'ایل گلی', 'شاه گلی'],
    districts: [
      { id: 'ائل‌گلی', label: '🌊 ائل‌گلی / جنوب‌شرق', fullName: 'ائل‌گلی تبریز', matches: ['ائل گلی', 'ائل‌گلی', 'ایل گلی', 'شاه گلی', 'جنوب شرق تبریز'] },
      { id: 'مرکز', label: '🏛️ مرکز / بازار', fullName: 'تبریز', matches: ['مرکز تبریز', 'بازار تبریز'] },
      { id: 'غرب', label: '✈️ غرب / فرودگاه', fullName: 'غرب تبریز', matches: ['غرب تبریز', 'فرودگاه تبریز'] },
    ]
  }
};

function findMetroConfig(cityName) {
  if (!cityName) return null;
  for (const [metroKey, cfg] of Object.entries(METRO_AREAS)) {
    if (cityName === metroKey || cityName.includes(metroKey)) return { metroKey, ...cfg };
    if (cfg.keywords.some(kw => cityName.includes(kw))) return { metroKey, ...cfg };
    if (cfg.districts.some(d => d.fullName === cityName)) return { metroKey, ...cfg };
  }
  return null;
}

function getDetectedDistrict(cityName, metroCfg) {
  if (!cityName || !metroCfg) return null;
  if (cityName === metroCfg.metroKey) return null;
  for (const d of metroCfg.districts) {
    if (d.fullName === cityName) return d.id;
    if (d.matches && d.matches.some(m => cityName.includes(m))) return d.id;
  }
  return null;
}

function isTehranArea(cityName) {
  return findMetroConfig(cityName)?.metroKey === 'تهران';
}

function getTehranDistrict(cityName) {
  const m = findMetroConfig(cityName);
  return m?.metroKey === 'تهران' ? getDetectedDistrict(cityName, m) : null;
}

function renderStreamChips(dayLogs) {
  if (!dayLogs || dayLogs.length === 0) {
    return `<span class="stream-empty-hint">هنوز مشاهده‌ای برای امروز ثبت نشده؛ وضعیتِ همین ساعت رو در فرم زیر ثبت کن.</span>`;
  }
  return dayLogs.map(l => {
    const winners = (l.userVerdict?.accurateModels || []).filter(m => m !== 'none');
    const winnerText = winners.length > 0 ? winners.join('، ') : (l.userVerdict?.accurateModels?.includes('none') ? 'هیچ‌کدام' : '—');
    const rainIcon = { dry: '🌂', light: '🌦️', heavy: '🌧️' }[l.userVerdict?.realRain] || '';
    const windIcon = { calm: '🍃', moderate: '💨', storm: '🌪️' }[l.userVerdict?.realWind] || '';
    const districtBadge = l.district ? `<span class="stream-chip-district">(${escapeHtml(l.district)})</span>` : '';
    return `
      <div class="stream-chip" data-id="${l.id}">
        <span class="stream-chip-time">⏰ ${l.timeStr || '—'} ${districtBadge}</span>
        <span class="stream-chip-desc">${rainIcon} ${windIcon} 🏆 ${escapeHtml(winnerText)}</span>
        <button type="button" class="btn-del-stream-log" data-id="${l.id}" title="حذف این مشاهده">×</button>
      </div>
    `;
  }).join('');
}

function renderRealityCard(day, location) {
  if (!day || !day.perModel || day.perModel.length === 0) return '';
  const allLogs = getRealityLogs();
  const dayLogs = allLogs.filter(l => l.dateIso === day.iso && l.city === location.name);
  const now = new Date();
  const curTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const metroCfg = findMetroConfig(location.name);
  let districtGroupHtml = '';
  if (metroCfg) {
    const detectedDistrict = getDetectedDistrict(location.name, metroCfg);
    const chipsHtml = metroCfg.districts.map(d => {
      const activeClass = detectedDistrict === d.id ? 'active' : '';
      return `<button type="button" class="tag-btn tag-district ${activeClass}" data-type="district" data-val="${d.id}">${d.label}</button>`;
    }).join('');

    districtGroupHtml = `
      <div class="feedback-group tehran-district-group">
        <span class="feedback-label">🧭 ${metroCfg.title} (اختیاری):</span>
        <div class="tag-choices tehran-district-choices">
          ${chipsHtml}
        </div>
      </div>
    `;
  }

  const modelBoxes = day.perModel.map(m => {
    const w = getWmoInfo(m.wmo);
    const rainStr = m.precip > 0 ? `${m.precip} mm` : 'بدون بارش';
    const windStr = m.windSpeed != null ? `${m.windSpeed} km/h` : '—';
    const gustStr = m.windGust != null ? ` (تندباد ${m.windGust} km/h)` : '';
    return `
      <div class="model-box" data-model="${m.model}" role="button" tabindex="0" title="برای انتخابِ این مدل کلیک کنید">
        <div class="model-box-header">
          <div class="model-box-title">
            <span class="model-check-circle"></span>
            <span class="model-box-name">${m.model}</span>
          </div>
          <span class="model-box-cond">${w.icon} ${w.desc.split(' ')[0]}</span>
        </div>
        <div class="model-box-metrics">
          <div class="model-metric-item"><span>دما:</span><span class="model-metric-val">${m.minT}° تا ${m.maxT}°</span></div>
          <div class="model-metric-item"><span>بارش:</span><span class="model-metric-val">${rainStr}</span></div>
          <div class="model-metric-item"><span>باد:</span><span class="model-metric-val">${windStr}${gustStr}</span></div>
        </div>
        <div class="model-box-select-hint">
          <span class="hint-label">👈 بزن روش تا انتخاب بشه</span>
        </div>
      </div>
    `;
  }).join('');

  const rainTags = [
    { val: 'dry', label: '🌂 نبارید' },
    { val: 'light', label: '🌦️ رگبار / نم‌نم' },
    { val: 'heavy', label: '🌧️ باران مداوم' }
  ].map(t => `<button type="button" class="tag-btn" data-type="rain" data-val="${t.val}">${t.label}</button>`).join('');

  const windTags = [
    { val: 'calm', label: '🍃 باد آرام' },
    { val: 'moderate', label: '💨 باد متوسط' },
    { val: 'storm', label: '🌪️ تندباد شدید' }
  ].map(t => `<button type="button" class="tag-btn" data-type="wind" data-val="${t.val}">${t.label}</button>`).join('');

  const saveBtnText = `💾 ثبت مشاهده (ساعت ${curTimeStr})`;
  const statusMsgText = dayLogs.length > 0
    ? `تا الان ${dayLogs.length} مشاهده برای امروز ثبت کردی (آخرین ثبت: ساعت ${dayLogs[0].timeStr || '—'})`
    : `وضعیتِ همین ساعت رو ثبت کن تا دقت مدل‌ها سنجیده بشه`;

  return `
    <div class="reality-card is-collapsed" data-date="${day.iso}" data-city="${escapeHtml(location.name)}">
      <div class="reality-header" role="button" tabindex="0" aria-expanded="false" title="برای باز یا بسته کردن کلیک کنید">
        <div class="reality-title-wrap">
          <div class="reality-badge">🎯 راستی‌آزمایی و مقایسه‌ی مدل‌ها <span class="reality-count-badge">${dayLogs.length > 0 ? `(✅ ${dayLogs.length} مشاهده ثبت‌شده)` : ''}</span></div>
          <div class="reality-subtitle">${day.jalali.full} (امروز) — ${escapeHtml(location.name)} (ثبت آزاد ساعتی و لحظه‌ای)</div>
        </div>
        <div class="reality-toggle-btn-wrap">
          <span class="reality-toggle-hint"></span>
          <span class="btn-reality-toggle" aria-hidden="true">▼</span>
        </div>
      </div>
      <div class="reality-body" style="display: none;">
        <div class="reality-stream-bar reality-slot-bar">
          <div class="stream-bar-header slot-bar-header">
            <span class="stream-bar-title slot-bar-title">🕒 مشاهداتِ ثبت‌شده‌ی امروز (جریان زمانی):</span>
            <span class="stream-bar-counter slot-bar-counter">${dayLogs.length > 0 ? `(${dayLogs.length} مشاهده ثبت شده)` : '(هر ساعت که هوا تغییر کرد ثبت کن)'}</span>
          </div>
          <div class="stream-chips-wrap">
            ${renderStreamChips(dayLogs)}
          </div>
        </div>

        <div class="model-selection-bar">
          <span class="model-selection-title">👇 الان کدوم مدل دقیق‌تره؟ بزن روش (برگه‌اش سبز می‌شه):</span>
          <button type="button" class="btn-select-none" data-model="none">❌ هیچ‌کدوم درست نبود</button>
        </div>
        <div class="models-compare-grid">
          ${modelBoxes}
        </div>
        <div class="reality-feedback-form">
          ${districtGroupHtml}
          <div class="feedback-row">
            <div class="feedback-group">
              <span class="feedback-label">واقعیت بارش در این ساعت:</span>
              <div class="tag-choices">
                ${rainTags}
              </div>
            </div>
            <div class="feedback-group">
              <span class="feedback-label">واقعیت باد در این ساعت:</span>
              <div class="tag-choices">
                ${windTags}
              </div>
            </div>
          </div>
          <div class="feedback-group">
            <span class="feedback-label">یادداشت و گزارش میدانی شما برای این ساعت (اختیاری):</span>
            <textarea class="reality-note-input" placeholder="مثلاً: الان ساعت ۱۱ یهو هوا ابری شد و باد تند وزید..."></textarea>
          </div>
          <div class="reality-actions">
            <button type="button" class="btn-save-reality" data-date="${day.iso}" data-city="${escapeHtml(location.name)}">${saveBtnText}</button>
            <span class="save-status-msg">${statusMsgText}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// view = { userIntent, focus } — focus روزی است که کاربر صریح پرسیده («یه هفته دیگه»)
// opts = { notes, chipCity } — notes توضیحِ هر حدسی است که زدیم (شهر/تاریخ از پیامِ قبل…)
function generateAssistantResponse(view, weatherResult, location, opts = {}) {
  const notes = opts.notes || [];
  const today = startOfDay(new Date());
  if (!weatherResult || !weatherResult.days || weatherResult.days.length === 0) {
    return {
      text: `شرمنده‌تم! نتونستم برای این روزها تو **${location.name}** دیتای درستی پیدا کنم. می‌خوای یه شهر دیگه یا یه تاریخ نزدیک‌تر رو بسنجیم؟`,
      cardsHtml: '',
      suggestions: rangeChips(opts.chipCity)
    };
  }

  const days = weatherResult.days;
  const statDays = days;

  // درصد = چند مدل از چندتا موافقند. با یک مدلِ تنها «۱۰۰٪» یعنی فقط «یک مدل گفته»،
  // پس آن‌جا درصد نمی‌دهیم
  const hasPct = d => d.modelsTotal >= 2;
  const pctOf = d => Math.round((d.modelsAgree / d.modelsTotal) * 100);
  const isRainy = d => d.modelsAgree >= Math.ceil(d.modelsTotal / 2);

  // تحلیل کلی وضعیت — میانگینِ روزها، نه سردترینِ یه روز کنارِ گرم‌ترینِ یه روزِ
  // دیگه (اون‌جوری قبلاً «بین ۱۷ تا ۳۷» درمی‌اومد که هیچ روزی واقعاً این‌قدر
  // نوسان نداشت، فقط دو تا روزِ مختلف قاطی شده بودن)
  const highestTemp = Math.round(avg(statDays.map(d => d.maxTemp)));
  const lowestTemp = Math.round(avg(statDays.map(d => d.minTemp)));
  const totalRain = Math.round(statDays.reduce((acc, d) => acc + d.precipSum, 0) * 10) / 10;
  const rainyDays = statDays.filter(isRainy);

  const dayLabel = d => {
    const rel = relativeDayWord(d.date, today);
    return rel ? `${rel}، ${d.jalali.full}` : d.jalali.full;
  };
  const rangeOf = list => `بازه‌ی ${list[0].jalali.short} تا ${list[list.length - 1].jalali.short}`;
  const dateRangeStr = rangeOf(statDays);
  const fullRangeStr = days.length === 1 ? dayLabel(days[0]) : `${rangeOf(days)} (${days.length} روز)`;

  // سیگنالِ اطمینان به‌شکل درصد — فقط وقتی حداقل دو مدل داریم
  const agreementNote = day => (hasPct(day) ? ` (${pctOf(day)}٪ احتمال)` : '');

  // ساعتِ تقریبیِ شروع/پایانِ بارش، وقتی داریمش — فقط بازه‌ی چندمدلی
  const timePhrase = day => {
    if (!day.rainWindow) return '';
    if (day.rainWindow.allDay) return ' تقریباً تمامِ روز';
    return ` بین ساعتِ **${day.rainWindow.startHour} تا ${day.rainWindow.endHour}**`;
  };

  let summaryText = '';
  // لحن کاملاً محاوره‌ای، خودمونی و رفاقتی
  if (statDays.length === 1) {
    // یک روزِ تنها: احتمال بارش را همیشه صریح بگو، چه صفر باشه چه صد
    const d = statDays[0];
    const rainDissent = getRainDissent(d);
    const windInfo = describeWind(d);
    const windy = isWindy(d);

    let lead = '';
    if (view.userIntent === 'rain') {
      if (isRainy(d)) {
        lead = 'آره رفیق، بارون داریم! 🌧️ ';
      } else if (rainDissent) {
        lead = `احتمال کلی بارش کمه (${pctOf(d)}٪)، ولی مدل **${rainDissent.rainingModels.map(m => m.model).join(' و ')}** بارش پیش‌بینی کرده 🌦️ `;
      } else {
        lead = 'خیالت تخت، بارونِ جدی‌ای در کار نیست. ☀️ ';
      }
    } else if (view.userIntent === 'wind') {
      lead = windy ? 'آره رفیق، وزش باد قابل‌توجهی داریم! 💨 ' : 'خیالت تخت، باد شدیدی در کار نیست 🍃 ';
    }

    let pctPhrase;
    if (hasPct(d)) pctPhrase = `احتمال بارش **${pctOf(d)}٪**`;
    else pctPhrase = `تنها مدلی که این‌قدر جلو رو داره (${d.models[0]}) ${d.modelsAgree ? 'بارون می‌گه' : 'بارون نمی‌گه'}`;

    let dissentNote = '';
    if (rainDissent && view.userIntent !== 'rain') {
      dissentNote = ` (⚠️ مدل **${rainDissent.rainingModels.map(m => m.model).join('، ')}** برخلاف بقیه بارش احتمالی دیده)`;
    }

    let windNote = '';
    if (view.userIntent === 'wind') {
      windNote = `، ${windInfo}`;
    } else if (windy) {
      windNote = ` — ضمناً **${windInfo}**`;
    }

    summaryText = `${lead}${dayLabel(d)} تو **${location.name}**: ${d.desc}، دما بین **${d.minTemp}° تا ${d.maxTemp}°**، ${pctPhrase}` +
      (d.precipSum > 0 ? ` (حدود **${d.precipSum} میلی‌متر**)` : '') +
      dissentNote +
      (d.rainWindow ? (d.rainWindow.allDay ? ' — تقریباً تمامِ روز می‌باره' : ` — احتمالاً${timePhrase(d)} می‌باره`) : '') +
      windNote + '.' +
      (hasPct(d) && pctOf(d) >= 50 ? ' یه بهونه‌ی خوب واسه یه دور زدنِ باحال — فقط اول ترافیک رو چک کن!' : '') +
      (view.userIntent === 'temp' && d.minTemp < 10 ? ' شب و اول صبح سرده، لباس گرم یادت نره!' : '');
  } else if (view.userIntent === 'wind') {
    const windyDays = statDays.filter(isWindy);
    if (windyDays.length > 0) {
      const peakWindDay = [...statDays].sort((a, b) => ((b.gustMax || b.windMax || 0) - (a.gustMax || a.windMax || 0)))[0];
      summaryText = `تو ${dateRangeStr} تو **${location.name}** وزش باد داریم 💨\n\n` +
        `بیشترین شدت باد روز **${peakWindDay.jalali.weekday} (${peakWindDay.jalali.short})** با سرعت تا **${peakWindDay.windMax} km/h**` +
        (peakWindDay.gustMax ? ` (تندباد لحظه‌ای تا **${peakWindDay.gustMax} km/h**)` : '') + ` پیش‌بینی شده. ` +
        `دما هم بین **${lowestTemp}° تا ${highestTemp}°** در نوسانه.`;
    } else {
      summaryText = `خیالت تخت! تو ${dateRangeStr} تو **${location.name}** باد شدیدی در پیش نیست و هوا در کل آرومه 🍃\n\n` +
        `سرعت باد معمولاً زیر ۲۰ کیلومتر بر ساعته و دما بین **${lowestTemp}° تا ${highestTemp}°** خواهد بود.`;
    }
  } else if (view.userIntent === 'rain') {
    if (rainyDays.length > 0) {
      const peakRainDay = [...statDays].sort((a, b) => b.precipSum - a.precipSum)[0];
      summaryText = `آره رفیق، تو ${dateRangeStr} تو **${location.name}** بارون داریم! 🌧️ حالشو ببر.\n\n` +
        `بیشترین بارش می‌افته روز **${peakRainDay.jalali.weekday} (${peakRainDay.jalali.short})**${timePhrase(peakRainDay)} با حدود **${peakRainDay.precipSum} میلی‌متر**${agreementNote(peakRainDay)}. ` +
        `سرجمع تو این چند روز نزدیک **${totalRain} میلی‌متر** بارون تخمین زده شده. ` +
        `عالیه واسه یه دور زدنِ باحال با ماشین — فقط اول ترافیک رو چک کن، بعد بزن بیرون! چتر و لباس بارونی هم یادت نره.`;
    } else {
      summaryText = `خیالت تخت تخت! تو ${dateRangeStr} تو **${location.name}** اصلاً خبری از بارون جدی نیست و هوا صاف یا فوقش کمی ابریه. ☀️`;
    }
  } else if (view.userIntent === 'temp') {
    summaryText = `اوضاع دمای **${location.name}** تو ${dateRangeStr} اینطوریه:\n\n` +
      `گرم‌ترین ساعت‌ها تا **${highestTemp} درجه** می‌ره بالا و شب‌ها هم تا **${lowestTemp} درجه** خنک (یا سرد) می‌شه. ` +
      (lowestTemp < 10 ? 'شب‌ها و اول صبح قشنگ سرده، پس حواست باشه لباس گرم دم دستت بذاری!' : 'هوا در کل خیلی معتدل و باحاله و می‌چسبه برای گشت‌وگذار.');
  } else if (rainyDays.length > 0) {
    // حالت عمومی (General Intent) — چند روز
    summaryText = `تو ${dateRangeStr} هوای **${location.name}** یکم ناپایداره و بارون داریم 🌦️\n\n` +
      `دما بین **${lowestTemp}° تا ${highestTemp}°** در نوسانه. تو ${rainyDays.length} روز از این دوره احتمال بارندگی هست و کلاً حدود **${totalRain} میلی‌متر** تخمین زده شده. ` +
      `هوای ابری و بارونی رو دوست داری؟ فرصتِ خوبیه واسه یه گشت‌وگذارِ باحال با ماشین — فقط قبلش یه نگاه به ترافیک بنداز!`;
  } else {
    const windyDays = statDays.filter(isWindy);
    if (windyDays.length > 0) {
      const peakWindDay = [...statDays].sort((a, b) => ((b.gustMax || b.windMax || 0) - (a.gustMax || a.windMax || 0)))[0];
      summaryText = `تو ${dateRangeStr} هوای **${location.name}** بدون بارشِ جدیه، ولی وزش باد داریم 💨\n\n` +
        `بیشترین شدت باد روز **${peakWindDay.jalali.weekday} (${peakWindDay.jalali.short})** با سرعت تا **${peakWindDay.windMax} km/h** و تندباد تا **${peakWindDay.gustMax || peakWindDay.windMax} km/h** تخمین زده شده. ` +
        `دما هم بین **${lowestTemp}° تا ${highestTemp}°** در نوسانه.`;
    } else {
      summaryText = `هوای **${location.name}** تو ${dateRangeStr} کاملاً آروم و پایداره 🌤️\n\n` +
        `آسمون غالباً صاف تا نیمه‌ابریه، دما هم بین **${lowestTemp}° تا ${highestTemp}°** می‌چرخه و شرایط برای سفر و کار کاملاً ردیفه!`;
    }
  }

  // روزی که کاربر صریح پرسیده («یه هفته دیگه») جدا و پررنگ گفته می‌شود
  const focusIso = view.focus ? toIsoDate(view.focus) : null;
  const focusDay = focusIso && days.length > 1 ? days.find(d => d.iso === focusIso) : null;
  if (focusDay) {
    summaryText += `\n\n📌 خودِ **${focusDay.jalali.weekday} ${focusDay.jalali.short}**: ${focusDay.desc}، **${focusDay.minTemp}° تا ${focusDay.maxTemp}°**` +
      (hasPct(focusDay) ? `، احتمال بارش **${pctOf(focusDay)}٪**` : '') + '.';
  }

  // فراتر از ۱۶ روز: صادقانه بگو مدل‌های هواشناسی نهایتاً تا ۱۶ روز پیش‌بینی روزانه دارند
  if (weatherResult.isBeyond16Days) {
    summaryText += `\n\n(💡 رفیق این تاریخی که گفتی بیشتر از ۱۶ روز دیگه‌ست و هیچ مدلِ هواشناسی فراتر از ۱۶ روز پیش‌بینی روزانه‌ی مطمئن نداره — ۱۶ روزِ پیشِ رو رو برات آوردم.)`;
  } else if (weatherResult.isCappedAt16Days) {
    summaryText += `\n\n(💡 مدل‌های هواشناسی نهایتاً تا ۱۶ روز آینده دقیقه؛ روزهای پیش‌بینی‌پذیر تا ${days[days.length - 1].jalali.short} رو برات آوردم.)`;
  }

  if (notes.length > 0) summaryText += `\n\n${notes.join('\n')}`;

  const allThree = days.every(d => d.modelsTotal >= 3);
  const [badgeClass, badgeText] = allThree
    ? ['badge-exact', '⚡ سه مدل عددی مستقل']
    : ['badge-exact', '⚡ پیش‌بینیِ چندمدلی'];

  // ساخت کارت‌های تعاملی روزانه
  let cardsHtml = `
    <div class="weather-card-container">
      <div class="weather-header-banner">
        <div class="weather-header-info">
          <span class="weather-loc-icon">📍</span>
          <div>
            <div class="weather-loc-title">${location.name} (${location.province})</div>
            <div class="weather-loc-sub">${fullRangeStr}</div>
          </div>
        </div>
        <span class="weather-badge ${badgeClass}">${badgeText}</span>
      </div>

      <div class="daily-cards-scroll">
  `;

  days.forEach(day => {
    const offset = daysBetween(today, day.date);
    const isFocus = day === focusDay;
    const pct = hasPct(day) ? pctOf(day) : null;
    const precipTitle = `${day.modelsAgree} از ${day.modelsTotal} مدل (${day.models.join('، ')}) بارون پیش‌بینی کردند - حجم ${day.precipSum} mm`;

    // ساعتِ تقریبیِ شروعِ بارش — فقط وقتی چیزی برای گفتن هست
    const timeLine = day.rainWindow
      ? `<div class="day-card-time">🕐 ${day.rainWindow.allDay ? 'تقریباً تمامِ روز' : `${day.rainWindow.startHour} تا ${day.rainWindow.endHour}`}</div>`
      : '';

    let precipBlock;
    if (pct !== null) {
      // بازه‌ی چندمدلی: همیشه درصد نشون بده، حتی صفر — چون سؤالِ اصلی همینه
      precipBlock = `
        <div class="day-card-precip${pct === 0 ? ' is-zero' : ''}" title="${precipTitle}">
          <span>💧</span>
          <span>${pct}٪${day.precipSum > 0 ? ` · ${day.precipSum}mm` : ''}</span>
        </div>${timeLine}`;
    } else {
      // تک‌مدل: درصد معنا ندارد، فقط مقدار و اسمِ همان یک مدل
      precipBlock = `
        <div class="day-card-precip${day.modelsAgree ? '' : ' is-zero'}" title="${precipTitle}">
          <span>💧</span><span>${day.precipSum > 0 ? `${day.precipSum}mm` : '—'}</span>
        </div>${timeLine}
        <span class="day-card-tag" title="بقیه‌ی مدل‌ها این‌قدر جلو رو پیش‌بینی نمی‌کنن">فقط ${day.models[0]}</span>`;
    }

    const windSvg = `<svg class="wind-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>`;
    const windTitle = day.windMax != null
      ? `حداکثر سرعت باد: ${day.windMax} km/h${day.gustMax ? ` · تندباد لحظه‌ای تا ${day.gustMax} km/h` : ''}`
      : '';
    const windClass = (day.gustMax >= 50 || day.windMax >= 35) ? ' is-high-wind' : (day.gustMax >= 38 || day.windMax >= 25 ? ' is-windy' : '');
    const windBlock = day.windMax != null
      ? `<div class="day-card-wind${windClass}" title="${windTitle}">
          ${windSvg}
          <span>${day.windMax}${day.gustMax && day.gustMax >= 35 ? ` (${day.gustMax})` : ''} <small>km/h</small></span>
        </div>`
      : '';

    const classes = ['day-card', offset === 0 ? 'is-today' : '', isFocus ? 'is-focus' : '']
      .filter(Boolean).join(' ');
    cardsHtml += `
      <div class="${classes}">
        <span class="day-card-name">${offset === 0 ? 'امروز' : offset === 1 ? 'فردا' : day.jalali.weekday}</span>
        <span class="day-card-date">${day.jalali.short}</span>
        <span class="day-card-icon">${day.icon}</span>
        <div class="day-card-temp">
          <span class="temp-max">${day.maxTemp}°</span>
          <span class="temp-min">${day.minTemp}°</span>
        </div>
        ${precipBlock}
        ${windBlock}
      </div>
    `;
  });

  // راستی‌آزمایی فقط برای روزِ جاری (امروز) نمایش داده می‌شود چون آینده هنوز رخ نداده
  const realityDay = days.find(d => daysBetween(today, d.date) === 0);
  const realityHtml = (realityDay && realityDay.perModel && realityDay.perModel.length > 0)
    ? renderRealityCard(realityDay, location)
    : '';

  cardsHtml += `
      </div>
      ${realityHtml}
      <div class="weather-audit-bar">
        <span class="audit-badge">🛡️ منبع: ${weatherResult.source}</span>
      </div>
    </div>
  `;

  let suggestions = rangeChips(opts.chipCity, days[0].date, days[days.length - 1].date);
  const metroCfg = findMetroConfig(location.name);
  if (metroCfg) {
    const otherDistricts = metroCfg.districts
      .filter(d => d.fullName !== location.name && d.label !== location.name);
    suggestions = [
      ...suggestions,
      ...otherDistricts.map(d => ({ label: `🧭 ${d.id}`, query: `امروز ${d.fullName}` }))
    ];
  }

  return {
    text: summaryText,
    cardsHtml,
    rawDays: days,
    suggestions
  };
}

// ==========================================
// 6. مدیریت رابط کاربری چت (UI Controller)
// ==========================================
const chatStream = document.getElementById('chat-stream');
const messagesContainer = document.getElementById('messages');
const chatInput = document.getElementById('chat-input');
const btnSend = document.getElementById('btn-send');
const btnGps = document.getElementById('btn-gps');
const btnClear = document.getElementById('btn-clear');
const toastEl = document.getElementById('toast');

function showToast(msg) {
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}

function scrollToBottom() {
  setTimeout(() => {
    chatStream.scrollTop = chatStream.scrollHeight;
  }, 50);
}

function appendUserMessage(text) {
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `
    <div class="msg-avatar">👤</div>
    <div class="msg-body">
      <div class="msg-bubble">${escapeHtml(text)}</div>
    </div>
  `;
  messagesContainer.appendChild(row);
  scrollToBottom();
}

function appendTypingIndicator() {
  const row = document.createElement('div');
  row.className = 'msg-row assistant typing-row';
  row.id = 'typing-indicator';
  row.innerHTML = `
    <div class="msg-avatar">🌤️</div>
    <div class="msg-body">
      <div class="msg-bubble typing-bubble">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;
  messagesContainer.appendChild(row);
  scrollToBottom();
  return row;
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

function appendAssistantMessage(data) {
  removeTypingIndicator();

  const row = document.createElement('div');
  row.className = 'msg-row assistant';

  let html = `
    <div class="msg-avatar">🌤️</div>
    <div class="msg-body">
      <div class="msg-bubble">
        <div style="white-space: pre-line; margin-bottom: 8px;">${renderAssistantText(data.text)}</div>
        ${data.cardsHtml || ''}
      </div>
  `;

  if (data.suggestions && data.suggestions.length > 0) {
    html += `<div class="msg-suggestions">`;
    data.suggestions.forEach(s => {
      // پیشنهاد یا متنِ ساده است یا { label, query } — مثلِ دکمه‌های بازه («یه هفته» ← «یه هفته رشت»)
      const label = typeof s === 'string' ? s : s.label;
      const query = typeof s === 'string' ? s : s.query;
      html += `<button class="suggestion-pill" data-query="${escapeHtml(query)}">${escapeHtml(label)}</button>`;
    });
    html += `</div>`;
  }

  html += `</div>`;
  row.innerHTML = html;
  messagesContainer.appendChild(row);

  // وصل کردن ایونت کلیک پیشنهادات
  row.querySelectorAll('.suggestion-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-query');
      if (q) handleUserSubmit(q);
    });
  });

  // وصل کردن رویدادهای کارت راستی‌آزمایی
  row.querySelectorAll('.reality-card').forEach(card => {
    const header = card.querySelector('.reality-header');
    const toggleCollapse = () => {
      const isNowCollapsed = card.classList.toggle('is-collapsed');
      const body = card.querySelector('.reality-body');
      if (body) {
        body.style.display = isNowCollapsed ? 'none' : 'flex';
      }
      if (header) {
        header.setAttribute('aria-expanded', !isNowCollapsed);
      }
    };
    header?.addEventListener('click', toggleCollapse);
    header?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleCollapse();
      }
    });

    const modelBoxes = card.querySelectorAll('.model-box');
    const noneBtn = card.querySelector('.btn-select-none');
    const rainTags = card.querySelectorAll('.tag-btn[data-type="rain"]');
    const windTags = card.querySelectorAll('.tag-btn[data-type="wind"]');
    const noteInput = card.querySelector('.reality-note-input');
    const saveBtn = card.querySelector('.btn-save-reality');
    const statusMsg = card.querySelector('.save-status-msg');
    const streamChipsWrap = card.querySelector('.stream-chips-wrap');
    const streamBarCounter = card.querySelector('.stream-bar-counter');
    const realityCountBadge = card.querySelector('.reality-count-badge');
    const dateIso = card.dataset.date;
    const city = card.dataset.city;

    function refreshStreamList() {
      const dayLogs = getRealityLogs().filter(l => l.dateIso === dateIso && l.city === city);
      if (streamChipsWrap) streamChipsWrap.innerHTML = renderStreamChips(dayLogs);
      if (streamBarCounter) streamBarCounter.textContent = dayLogs.length > 0 ? `(${dayLogs.length} مشاهده ثبت شده)` : '(هر ساعت که هوا تغییر کرد ثبت کن)';
      if (realityCountBadge) realityCountBadge.textContent = dayLogs.length > 0 ? `(✅ ${dayLogs.length} مشاهده ثبت‌شده)` : '';
      updateLogCounter();
      wireChipDeleteButtons();
    }

    function wireChipDeleteButtons() {
      card.querySelectorAll('.btn-del-stream-log').forEach(delBtn => {
        delBtn.onclick = (e) => {
          e.stopPropagation();
          const logId = delBtn.dataset.id;
          if (confirm('این مشاهده حذف شود؟')) {
            deleteRealityLog(logId);
            refreshStreamList();
            showToast('مشاهده حذف شد');
          }
        };
      });
    }

    wireChipDeleteButtons();

    modelBoxes.forEach(box => {
      box.addEventListener('click', () => {
        const isSelected = box.classList.toggle('is-selected');
        const checkCircle = box.querySelector('.model-check-circle');
        const hintLabel = box.querySelector('.hint-label');
        if (checkCircle) checkCircle.textContent = isSelected ? '✓' : '';
        if (hintLabel) hintLabel.textContent = isSelected ? '✅ این مدل درست گفت' : '👈 بزن روش تا انتخاب بشه';

        // اگر مدلی انتخاب شد، دکمه‌ی «هیچ‌کدوم» خاموش شود
        if (isSelected && noneBtn) {
          noneBtn.classList.remove('active');
        }
      });
    });

    noneBtn?.addEventListener('click', () => {
      const isNone = noneBtn.classList.toggle('active');
      if (isNone) {
        modelBoxes.forEach(box => {
          box.classList.remove('is-selected');
          const checkCircle = box.querySelector('.model-check-circle');
          const hintLabel = box.querySelector('.hint-label');
          if (checkCircle) checkCircle.textContent = '';
          if (hintLabel) hintLabel.textContent = '👈 بزن روش تا انتخاب بشه';
        });
      }
    });

    ['rain', 'wind', 'district'].forEach(type => {
      const tags = card.querySelectorAll(`.tag-btn[data-type="${type}"]`);
      tags.forEach(t => {
        t.addEventListener('click', () => {
          const wasActive = t.classList.contains('active');
          tags.forEach(other => other.classList.remove('active'));
          if (!wasActive) t.classList.add('active');
        });
      });
    });

    saveBtn?.addEventListener('click', () => {
      const isNone = noneBtn?.classList.contains('active');
      const activeModels = isNone
        ? ['none']
        : [...card.querySelectorAll('.model-box.is-selected')].map(c => c.dataset.model);
      const activeRain = card.querySelector('.tag-btn[data-type="rain"].active')?.dataset.val || '';
      const activeWind = card.querySelector('.tag-btn[data-type="wind"].active')?.dataset.val || '';
      const metro = findMetroConfig(city);
      const detectedD = getDetectedDistrict(city, metro);
      const activeDistrict = card.querySelector('.tag-btn[data-type="district"].active')?.dataset.val || detectedD || '';
      const notes = noteInput ? noteInput.value.trim() : '';

      if (activeModels.length === 0 && !activeRain && !activeWind && !notes && !activeDistrict) {
        showToast('حداقل یک مدل یا وضعیت باران/باد را مشخص کنید');
        return;
      }

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const targetDay = data.rawDays?.find(d => d.iso === dateIso);
      const logEntry = {
        id: `${dateIso}_${city}_${Date.now()}`,
        dateIso,
        city,
        district: activeDistrict || null,
        timestamp: Date.now(),
        timeStr,
        ensemble: targetDay ? {
          maxTemp: targetDay.maxTemp,
          minTemp: targetDay.minTemp,
          precipSum: targetDay.precipSum,
          desc: targetDay.desc,
          windMax: targetDay.windMax,
          gustMax: targetDay.gustMax
        } : null,
        modelsForecast: targetDay?.perModel || [],
        userVerdict: {
          accurateModels: activeModels,
          realRain: activeRain,
          realWind: activeWind,
          district: activeDistrict || null,
          notes
        }
      };
      saveRealityLog(logEntry);
      refreshStreamList();

      if (saveBtn) {
        const nextNow = new Date();
        const nextTime = `${String(nextNow.getHours()).padStart(2, '0')}:${String(nextNow.getMinutes()).padStart(2, '0')}`;
        saveBtn.textContent = `💾 ثبت مشاهده (ساعت ${nextTime})`;
      }
      if (statusMsg) {
        statusMsg.textContent = `✅ مشاهده‌ی ساعت ${timeStr} در حافظه ذخیره شد`;
      }
      showToast(`مشاهده‌ی ساعت ${timeStr} ثبت شد`);
    });
  });

  scrollToBottom();
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// متن پاسخ اول escape می‌شود (امن) بعد فقط **بولد** به <strong> تبدیل می‌شود —
// قبلاً escape اصلاً انجام نمی‌شد و ستاره‌های ** هم خام روی صفحه چاپ می‌شدند
function renderAssistantText(str) {
  return escapeHtml(str).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

// رندر پیام آغازین (Welcome message)
function renderWelcomeMessage() {
  messagesContainer.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'msg-row assistant';
  row.innerHTML = `
    <div class="msg-avatar">🌤️</div>
    <div class="msg-body">
      <div class="welcome-card">
        <div class="welcome-title">سلام رفیق! چطوری؟ 👋</div>
        <div class="welcome-desc">
          دیگه لازم نیست با نقشه‌های شلوغ و لایه‌های گنگ سر و کله بزنی! هر شهری رو با هر تاریخی که می‌خوای بهم بگو؛ از فردا تا ماه آینده، خودم می‌پرم از ماهواره‌ها چک می‌کنم و بهت می‌گم بارون میاد، چتر لازمه یا هوا سرده.
        </div>
        <div class="chips-title">پرسش‌های سریع و آماده (فقط روشون بزن):</div>
        <div class="chips-grid">
          <button class="chip-btn" data-query="امروز شرق تهران چطوره؟">🏢 شرق تهران (تهرانپارس)</button>
          <button class="chip-btn" data-query="امروز شمال تهران چطوره؟">🏔️ شمال تهران (تجریش)</button>
          <button class="chip-btn" data-query="امروز طرقبه چطوره؟">🌲 طرقبه و شاندیز مشهد</button>
          <button class="chip-btn" data-query="امروز کوه صفه اصفهان چطوره؟">🏔️ کوه صفه اصفهان</button>
          <button class="chip-btn" data-query="امروز قصرالدشت شیراز چطوره؟">🌸 قصرالدشت شیراز</button>
          <button class="chip-btn" data-query="امروز عظیمیه کرج چطوره؟">🏔️ عظیمیه کرج</button>
          <button class="chip-btn" data-query="امروز ائل گلی تبریز چطوره؟">🌊 ائل‌گلی تبریز</button>
          <button class="chip-btn" data-query="فردا کل تهران چطوره؟">🏙️ فردا تهران</button>
          <button class="chip-btn" data-query="یه هفته دیگه کوهدشت چطوره؟">🏔️ یه هفته دیگه کوهدشت؟</button>
          <button class="chip-btn" data-query="پس‌فردا چالوس بارون داریم؟">🏖️ پس‌فردا چالوس بارونیه؟</button>
        </div>
      </div>
    </div>
  `;
  messagesContainer.appendChild(row);

  row.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const q = btn.getAttribute('data-query');
      if (q) handleUserSubmit(q);
    });
  });
}

// حافظه‌ی کوتاهِ گفت‌وگو: آخرین شهر، بازه و قصد. بدونش «فردا چطوره؟» ← «کدوم شهر؟»
// ← «رشت» سه روز نشان می‌داد، چون «رشت» جدا خوانده می‌شد و «فردا» فراموش شده بود
// (فیدبکِ فرزین، ۱۱ مهر ۱۴۰۵). با «گفتگوی تازه» پاک می‌شود.
const convo = { loc: null, chipCity: null, range: null, intent: null, askedCity: false };
const CITY_CHIPS = ['تهران', 'رشت', 'چالوس', 'مشهد'];

// پردازش اصلی پیام کاربر
async function handleUserSubmit(queryText) {
  const text = (queryText || chatInput.value).trim();
  if (!text) return;

  chatInput.value = '';
  chatInput.style.height = 'auto';
  btnSend.disabled = true;

  appendUserMessage(text);
  appendTypingIndicator();

  try {
    // 1. پردازش زبان طبیعی کوئری
    const parsed = parseQuery(text);
    const today = startOfDay(new Date());
    // پیامِ قبلی خودمان پرسیدیم «کدوم شهر؟» — پس این پیام جوابِ همان است
    const answeringCityQuestion = convo.askedCity;
    convo.askedCity = false;

    // پاسخ به احوال‌پرسی
    if (parsed.type === 'greeting') {
      appendAssistantMessage({
        text: 'سلام رفیق! 👋 چطوری؟ همه‌چی روبه‌راهه؟\nبگو ببینم هوای کدوم شهرو می‌خوای برات بسنجم؟ (از فردا تا ماه آینده هر جا بخوای آماده‌ام!)',
        cardsHtml: '',
        suggestions: ['امروز شرق تهران چطوره؟', '۵ تا ۹ مهر چالوس چطوره؟', 'یه هفته دیگه رامسر چطوره؟']
      });
      return;
    }

    // پاسخ به تشکر
    if (parsed.type === 'thanks') {
      appendAssistantMessage({
        text: 'نوکرتم رفیق! کاری نکردم. ❤️ هر وقت برنامه سفر داشتی یا خواستی بدونی فردا چی بپوشی، فقط صدام بزن!',
        cardsHtml: '',
        suggestions: ['امروز شرق تهران چطوره؟', 'آخر هفته رامسر بارونیه؟', 'یک ماه آینده چالوس']
      });
      return;
    }

    // معرفی هویت
    if (parsed.type === 'identity') {
      appendAssistantMessage({
        text: 'من رفیق و دستیار هوای ایرانم! 🌤️\nکارت اینه که هر سوالی داری به زبون خودمونی بپرسی؛ منم می‌پرم از ماهواره‌های اروپایی و آمریکایی دیتای واقعی بارون و دما رو برات می‌کشم بیرون تا با خیال راحت برنامه‌ریزی کنی.',
        cardsHtml: '',
        suggestions: ['امروز شرق تهران چطوره؟', '۵ تا ۹ مهر چالوس چطوره؟', 'شیراز تو ماه آینده']
      });
      return;
    }

    // سوال‌های متفرقه و خارج از حوزه آب‌وهوا
    if (parsed.type === 'irrelevant') {
      appendAssistantMessage({
        text: 'قربونت برم، من تخصصم فقط و فقط آب‌وهوا و بارون و سرماست! 😄\nتوی این موضوع‌ها اصلاً سر در نمیارم، ولی اگه خواستی بدونی فردا هوا چطوره یا جاده چالوس بارونیه یا نه، رو من حساب کن! 🌦️',
        cardsHtml: '',
        suggestions: ['امروز شرق تهران چطوره؟', '۵ تا ۹ مهر چالوس چطوره؟', 'آخر هفته اصفهان']
      });
      return;
    }

    // قصد: اگر این پیام چیزی درباره‌ی هوا نگفته («تهران چی؟»)، همان قصدِ قبلی می‌ماند
    const intent = parsed.userIntent !== 'general' ? parsed.userIntent
      : parsed.hasWeatherKeywords ? 'general' : (convo.intent || 'general');
    convo.intent = intent;

    // تاریخِ گذشته: صادقانه بگو، نه اینکه بی‌صدا هوای سالِ قبلِ آن روز را نشان بدهی
    if (parsed.range && parsed.range.past) {
      appendAssistantMessage({
        text: `**${describeRange(parsed.range)}** دیگه گذشته رفیق 🙂 من هوای روزهای پیشِ رو رو می‌گم — تا ۱۶ روز آینده با مدل‌های معتبر هواشناسی.`,
        cardsHtml: '',
        suggestions: rangeChips(convo.chipCity)
      });
      return;
    }
    // تاریخ حتی اگر شهر نیامده باشد یادمان می‌ماند — جوابِ «کدوم شهر؟» از آن استفاده می‌کند
    if (parsed.range) convo.range = parsed.range;

    // 2. تعیین شهر: این پیام ← وگرنه شهرِ پیامِ قبلی (صریح به کاربر گفته می‌شود)
    const notes = [];
    let loc = null;
    let chipCity = null;
    if (parsed.city) {
      loc = parsed.city;
      chipCity = loc.name;
    } else if (parsed.cityCandidates.length > 0) {
      const strict = !parsed.hasWeatherKeywords && !parsed.range;
      const hit = await resolveCandidates(parsed.cityCandidates, strict);
      if (hit) {
        loc = hit.loc;
        chipCity = loc.name;
      } else if (convo.loc && (parsed.range || parsed.hasWeatherKeywords)) {
        loc = convo.loc;
        chipCity = convo.chipCity;
        notes.push(`📍 «${parsed.cityCandidates[0]}» رو به‌عنوانِ شهر نشناختم؛ همون **${loc.name}** قبلی رو آوردم.`);
      }
    } else if (convo.loc) {
      loc = convo.loc;
      chipCity = convo.chipCity;
      notes.push(`📍 شهر نگفتی، همون **${loc.name}** رو گذاشتم.`);
    }

    if (!loc) {
      const tried = parsed.cityCandidates[0];
      const when = parsed.range ? describeRange(parsed.range) : null;
      let msg;
      if (tried) {
        msg = `«${tried}» رو تو شهرهای ایران پیدا نکردم رفیق! 🤔 اسم شهر رو دقیق‌تر بنویس (مثلاً «کوهدشت» یا «بندر عباس»).` +
          (when ? ` تاریخ (**${when}**) یادم می‌مونه.` : '');
      } else if (when) {
        msg = `فهمیدم **${when}** رو می‌خوای 👌 فقط بگو کدوم شهر؟ اسمشو بنویس یا یکی از این‌ها رو بزن.`;
      } else {
        msg = 'نگفتی هوای کدوم شهرو می‌خوای رفیق؟ اسم شهر رو بنویس (مثلاً **فردا تهران بارون میاد؟**) یا یکی از این‌ها رو بزن.';
      }
      appendAssistantMessage({ text: msg, cardsHtml: '', suggestions: CITY_CHIPS });
      convo.askedCity = true;
      return;
    }

    // 3. تعیین بازه: این پیام ← وگرنه بازه‌ی پیامِ قبلی ← وگرنه سه روزِ پیشِ رو
    let range = parsed.range;
    let defaulted = false;
    if (!range && convo.range) {
      range = finalizeRange(convo.range, today);
      if (range && range.past) range = null;
      if (range && !answeringCityQuestion) notes.push(`📅 تاریخ نگفتی، همون **${describeRange(range)}** سوالِ قبلی رو گذاشتم.`);
    }
    if (!range) {
      range = { start: today, end: addDays(today, 2), focus: null };
      defaulted = true;
      notes.push('📅 تاریخ نگفتی، سه روزِ پیشِ رو رو آوردم — بازه‌ی دیگه خواستی، دکمه‌های پایین رو بزن.');
    }
    if (range.clampedPast) notes.push('📅 روزهای گذشته‌ی این بازه رو کنار گذاشتم و از امروز به بعدش رو آوردم.');

    // 4. دریافت داده‌های آب‌وهوا از API و نمایش
    const weatherResult = await fetchWeatherData(loc.lat, loc.lon, range.start, range.end);
    const reply = generateAssistantResponse({ userIntent: intent, focus: range.focus }, weatherResult, loc, { notes, chipCity });
    appendAssistantMessage(reply);

    convo.loc = loc;
    convo.chipCity = chipCity;
    convo.range = defaulted ? null : range;

  } catch (err) {
    console.error('Processing error:', err);
    appendAssistantMessage({
      text: 'ای بابا! انگار تو اتصال به ماهواره‌ها یه گیر کوچیک پیش اومد. یه چند ثانیه دیگه دوباره بپرس تا ردیفش کنم.',
      cardsHtml: '',
      suggestions: ['چالوس چطوره؟', 'هوای تهران']
    });
  } finally {
    btnSend.disabled = false;
  }
}

// رویدادهای ورودی و دکمه‌ها
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleUserSubmit();
  }
});

chatInput.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});

btnSend.addEventListener('click', () => handleUserSubmit());

btnClear.addEventListener('click', () => {
  Object.assign(convo, { loc: null, chipCity: null, range: null, intent: null, askedCity: false });
  renderWelcomeMessage();
  showToast('گفتگو بازنشانی شد');
});

// قابلیت موقعیت‌یابی با GPS
btnGps.addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('مرورگر شما از GPS پشتیبانی نمی‌کند');
    return;
  }

  showToast('در حال دریافت موقعیت مکانی...');
  btnGps.style.opacity = '0.5';

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      btnGps.style.opacity = '1';
      const loc = { name: 'موقعیت شما', province: 'مختصات ثبت‌شده', lat: pos.coords.latitude, lon: pos.coords.longitude };

      appendUserMessage('📍 هوای موقعیت فعلی من چطوره؟');
      appendTypingIndicator();

      const today = startOfDay(new Date());
      const weatherResult = await fetchWeatherData(loc.lat, loc.lon, today, addDays(today, 2));
      appendAssistantMessage(generateAssistantResponse({ userIntent: 'general', focus: null }, weatherResult, loc, { chipCity: null }));
      // دکمه‌های بازه بدونِ اسمِ شهرند و همین موقعیت را از حافظه برمی‌دارند
      Object.assign(convo, { loc, chipCity: null, range: null });
    },
    (err) => {
      btnGps.style.opacity = '1';
      showToast('دسترسی به موقعیت مکانی تأیید نشد');
    },
    { timeout: 10000 }
  );
});

// مدیریت دیالوگ لاگ‌ها و مقایسه مدل‌ها
const btnLogs = document.getElementById('btn-logs');
const logModal = document.getElementById('log-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnDownloadJson = document.getElementById('btn-download-json');
const btnCopyJson = document.getElementById('btn-copy-json');
const btnClearLogs = document.getElementById('btn-clear-logs');
const logCounter = document.getElementById('log-counter');
const modalStats = document.getElementById('modal-stats');
const modalLogList = document.getElementById('modal-log-list');

function updateLogCounter() {
  if (!logCounter) return;
  const count = getRealityLogs().length;
  logCounter.textContent = String(count);
}

function openLogModal() {
  if (!logModal) return;
  renderModalContent();
  logModal.classList.remove('hidden');
}

function closeLogModal() {
  if (!logModal) return;
  logModal.classList.add('hidden');
}

function renderModalContent() {
  const logs = getRealityLogs();
  if (modalStats) {
    const total = logs.length;
    const wins = { ECMWF: 0, GFS: 0, ICON: 0, none: 0 };
    logs.forEach(l => {
      (l.userVerdict?.accurateModels || []).forEach(m => {
        if (m in wins) wins[m]++;
      });
    });
    modalStats.innerHTML = `
      <div class="stat-box"><div class="stat-val">${total}</div><div class="stat-label">کل مشاهدات ثبت‌شده</div></div>
      <div class="stat-box"><div class="stat-val">${wins.ECMWF}</div><div class="stat-label">بردهای ECMWF</div></div>
      <div class="stat-box"><div class="stat-val">${wins.GFS}</div><div class="stat-label">بردهای GFS</div></div>
      <div class="stat-box"><div class="stat-val">${wins.ICON}</div><div class="stat-label">بردهای ICON</div></div>
    `;
  }
  if (modalLogList) {
    if (logs.length === 0) {
      modalLogList.innerHTML = `<div class="empty-logs-msg">هنوز هیچ گزارشی ثبت نشده است. از پنل راستی‌آزمایی زیر هر کارت، وضعیت واقعی را ثبت کن!</div>`;
    } else {
      modalLogList.innerHTML = logs.map(l => {
        const winners = (l.userVerdict?.accurateModels || []).filter(m => m !== 'none');
        const winnerText = winners.length > 0 ? `🏆 دقیق‌ترین: ${winners.join('، ')}` : (l.userVerdict?.accurateModels?.includes('none') ? '❌ هیچ‌کدام' : 'نامشخص');
        const rainLabel = { dry: '🌂 بدون باران', light: '🌦️ رگبار/نم‌نم', heavy: '🌧️ باران مداوم' }[l.userVerdict?.realRain] || '';
        const windLabel = { calm: '🍃 باد آرام', moderate: '💨 باد متوسط', storm: '🌪️ تندباد شدید' }[l.userVerdict?.realWind] || '';
        const noteHtml = l.userVerdict?.notes ? `<div class="log-entry-note">${escapeHtml(l.userVerdict.notes)}</div>` : '';
        const timeBadge = l.timeStr ? `⏰ ساعت ${l.timeStr}` : (l.slotLabel || '—');
        return `
          <div class="log-entry-item" data-id="${l.id}">
            <div class="log-entry-header">
              <div class="log-entry-location">
                <span class="log-city">📍 ${escapeHtml(l.city)} (${l.dateIso})</span>
                <span class="log-slot-badge">${escapeHtml(timeBadge)}</span>
              </div>
              <div class="log-entry-header-actions">
                <span class="log-tag winner">${winnerText}</span>
                <button type="button" class="btn-del-modal-log" data-id="${l.id}" title="حذف این مشاهده">🗑️</button>
              </div>
            </div>
            <div class="log-entry-tags">
              ${l.district ? `<span class="log-tag district">🧭 ${escapeHtml(l.district)}</span>` : ''}
              ${rainLabel ? `<span class="log-tag">${rainLabel}</span>` : ''}
              ${windLabel ? `<span class="log-tag">${windLabel}</span>` : ''}
            </div>
            ${noteHtml}
          </div>
        `;
      }).join('');

      modalLogList.querySelectorAll('.btn-del-modal-log').forEach(btn => {
        btn.onclick = () => {
          const logId = btn.dataset.id;
          if (confirm('آیا این مشاهده حذف شود؟')) {
            deleteRealityLog(logId);
            renderModalContent();
            updateLogCounter();
            showToast('مشاهده حذف شد');
          }
        };
      });
    }
  }
}

btnLogs?.addEventListener('click', openLogModal);
btnCloseModal?.addEventListener('click', closeLogModal);
logModal?.addEventListener('click', (e) => {
  if (e.target === logModal) closeLogModal();
});
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && logModal && !logModal.classList.contains('hidden')) {
      closeLogModal();
    }
  });
}

btnDownloadJson?.addEventListener('click', () => {
  const logs = getRealityLogs();
  if (logs.length === 0) {
    showToast('هیچ لاگی برای دانلود وجود ندارد');
    return;
  }
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `weather_iran_logs_${toIsoDate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('فایل JSON دانلود شد');
});

btnCopyJson?.addEventListener('click', async () => {
  const logs = getRealityLogs();
  if (logs.length === 0) {
    showToast('هیچ لاگی برای کپی وجود ندارد');
    return;
  }
  try {
    await navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
    showToast('متن JSON در کلیپ‌بورد کپی شد');
  } catch (err) {
    showToast('خطا در کپی کلیپ‌بورد');
  }
});

btnClearLogs?.addEventListener('click', () => {
  if (confirm('آیا مطمئن هستید که می‌خواهید تمام لاگ‌های ثبت‌شده را پاک کنید؟')) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem('weather_reality_logs');
    } catch (e) {}
    updateLogCounter();
    renderModalContent();
    showToast('تمام لاگ‌ها پاک شدند');
  }
});

// راه‌اندازی اولیه
updateLogCounter();
renderWelcomeMessage();
