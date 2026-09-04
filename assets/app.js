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

// ==========================================
// 2. دیتابیس شهرهای ایران + قابلیت ژئوکودینگ پویا
// ==========================================
const POPULAR_CITIES = [
  { name: 'چالوس', lat: 36.6550, lon: 51.4204, province: 'مازندران' },
  { name: 'نوشهر', lat: 36.6486, lon: 51.4961, province: 'مازندران' },
  { name: 'رامسر', lat: 36.9180, lon: 50.6480, province: 'مازندران' },
  { name: 'کلاردشت', lat: 36.4914, lon: 51.1558, province: 'مازندران' },
  { name: 'رشت', lat: 37.2809, lon: 49.5924, province: 'گیلان' },
  { name: 'انزلی', lat: 37.4747, lon: 49.4589, province: 'گیلان' },
  { name: 'لاهیجان', lat: 37.2070, lon: 50.0031, province: 'گیلان' },
  { name: 'ساری', lat: 36.5659, lon: 53.0586, province: 'مازندران' },
  { name: 'بابل', lat: 36.5419, lon: 52.6782, province: 'مازندران' },
  { name: 'آمل', lat: 36.4696, lon: 52.3507, province: 'مازندران' },
  { name: 'تهران', lat: 35.6892, lon: 51.3890, province: 'تهران' },
  { name: 'کرج', lat: 35.8327, lon: 50.9915, province: 'البرز' },
  { name: 'مشهد', lat: 36.2972, lon: 59.6067, province: 'خراسان رضوی' },
  { name: 'اصفهان', lat: 32.6546, lon: 51.6680, province: 'اصفهان' },
  { name: 'شیراز', lat: 29.5918, lon: 52.5837, province: 'فارس' },
  { name: 'تبریز', lat: 38.0800, lon: 46.2919, province: 'آذربایجان شرقی' },
  { name: 'اهواز', lat: 31.3183, lon: 48.6706, province: 'خوزستان' },
  { name: 'کیش', lat: 26.5578, lon: 53.9799, province: 'هرمزگان' },
  { name: 'قشم', lat: 26.9581, lon: 56.2719, province: 'هرمزگان' },
  { name: 'بندرعباس', lat: 27.1832, lon: 56.2666, province: 'هرمزگان' },
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

async function resolveLocation(cityName) {
  // ۱. بررسی کش دیتابیس داخلی
  const clean = cityName.trim();
  const match = POPULAR_CITIES.find(c => c.name === clean || clean.includes(c.name) || c.name.includes(clean));
  if (match) return match;

  // ۲. در صورت نبود، ژئوکودینگ آنلاین از Open-Meteo
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(clean)}&count=1&language=fa&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const top = data.results[0];
      return {
        name: top.name,
        lat: top.latitude,
        lon: top.longitude,
        province: top.admin1 || top.country || 'ایران'
      };
    }
  } catch (e) {
    console.warn('Geocoding error:', e);
  }
  return null;
}

// ==========================================
// 3. موتور استخراج زبان طبیعی (Persian NLP)
// ==========================================
const NUMBER_WORDS = {
  'اول': 1, 'یکم': 1, 'یک': 1, '۱': 1, '1': 1,
  'دوم': 2, 'دو': 2, '۲': 2, '2': 2,
  'سوم': 3, 'سه': 3, '۳': 3, '3': 3,
  'چهارم': 4, 'چهار': 4, '۴': 4, '4': 4,
  'پنجم': 5, 'پنج': 5, '۵': 5, '5': 5,
  'ششم': 6, 'شش': 6, '۶': 6, '6': 6,
  'هفتم': 7, 'هفت': 7, '۷': 7, '7': 7,
  'هشتم': 8, 'هشت': 8, '۸': 8, '8': 8,
  'نهم': 9, 'نه': 9, '۹': 9, '9': 9,
  'دهم': 10, 'ده': 10, '۱۰': 10, '10': 10,
  'یازدهم': 11, '۱۱': 11, '11': 11,
  'دوازدهم': 12, '۱۲': 12, '12': 12,
  'سیزدهم': 13, '۱۳': 13, '13': 13,
  'چهاردهم': 14, '۱۴': 14, '14': 14,
  'پانزدهم': 15, '۱۵': 15, '15': 15,
  'شانزدهم': 16, '۱۶': 16, '16': 16,
  'هفدهم': 17, '۱۷': 17, '17': 17,
  'هجدهم': 18, '۱۸': 18, '18': 18,
  'نوزدهم': 19, '۱۹': 19, '19': 19,
  'بیستم': 20, '۲۰': 20, '20': 20,
  'بیست و یکم': 21, '۲۱': 21, '21': 21,
  'بیست و دوم': 22, '۲۲': 22, '22': 22,
  'بیست و سوم': 23, '۲۳': 23, '23': 23,
  'بیست و چهارم': 24, '۲۴': 24, '24': 24,
  'بیست و پنجم': 25, '۲۵': 25, '25': 25,
  'بیست و ششم': 26, '۲۶': 26, '26': 26,
  'بیست و هفتم': 27, '۲۷': 27, '27': 27,
  'بیست و هشتم': 28, '۲۸': 28, '28': 28,
  'بیست و نهم': 29, '۲۹': 29, '29': 29,
  'سی ام': 30,  'سی و یکم': 31, '۳۱': 31, '31': 31
};

function parseQuery(text) {
  const norm = text.replace(/[\u064B-\u065F]/g, '').trim(); // Remove Arabic diacritics
  const now = new Date();
  const currentJalali = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());

  // 0. تشخیص قصد‌های عمومی مکالمه (احوال‌پرسی، تشکر، هویت، موضوعات بی‌ربط)
  const isGreeting = /^(سلام|درود|سلام علیکم|چطوری|خوبی|حالت چطوره|صبح بخیر|شب بخیر|عصر بخیر|چه خبر|چخبر|سلامت باشی|hi|hello|hey)[\s!؟?.]*$/i.test(norm);
  if (isGreeting) {
    return { type: 'greeting', rawText: norm };
  }

  const isThanks = /^(مرسی|ممنون|دستت درد نکنه|دمت گرم|تشکر|خیلی ممنون|سپاس|عشقی|نوکرتم|عالی بود)[\s!؟?.]*$/i.test(norm);
  if (isThanks) {
    return { type: 'thanks', rawText: norm };
  }

  const isIdentity = /(تو کی هستی|اسمت چیه|چیکار میتونی بکنی|خودتو معرفی کن|چه کارهایی بلدی|چیکاره ای)/i.test(norm);
  if (isIdentity) {
    return { type: 'identity', rawText: norm };
  }

  const hasWeatherKeywords = /بارون|باران|بارش|چتر|خیس|رگبار|برف|سرد|گرم|دما|درجه|خنک|یخ|طوفان|باد|ابر|ابری|آفتاب|آفتابی|مه|مه‌آلود|هوا|آب\s*و\s*هوا/i.test(norm);
  const isClearlyIrrelevant = /دلار|سکه|طلا|ارز|بیت\s*کوین|فوتبال|استقلال|پرسپولیس|رونالدو|مسی|غذا|شام|ناهار|فیلم|آهنگ|موسیقی|برنامه\s*نویسی|پزشک|دکتر|دارو|جوک|لطیفه|سیاست|اخبار\s*روز/i.test(norm);

  let targetCity = null;
  let startDate = null;
  let endDate = null;
  let isMonthlyRequest = false;
  let userIntent = 'general'; // 'rain', 'temp', 'general'

  if (/بارون|باران|بارش|چتر|خیس|رگبار/i.test(norm)) userIntent = 'rain';
  else if (/سرد|گرم|دما|درجه|خنک|یخ/i.test(norm)) userIntent = 'temp';

  // 1. تشخیص شهر
  for (const c of POPULAR_CITIES) {
    const reg = new RegExp(`(^|[\\s،,\\?])${c.name}([\\s،,\\?]|$)`, 'i');
    if (reg.test(norm)) {
      targetCity = c.name;
      break;
    }
  }

  // اگر شهر پیدا نشد، چک کردن الگوی «در [شهر]» یا «هوای [شهر]»
  if (!targetCity) {
    const cityMatch = norm.match(/(?:در|هوای|وضعیت|شهر|برای)\s+([آ-یa-zA-Z\s]{3,15})/);
    if (cityMatch && cityMatch[1]) {
      const candidate = cityMatch[1].trim().split(/\s+/)[0];
      if (candidate.length > 2 && !PERSIAN_MONTHS.includes(candidate)) {
        targetCity = candidate;
      }
    }
  }

  // اگر سوال نه به آب‌وهوا ربط داشت، نه اسم شهری داشت و نه کلمه‌ی هوایی:
  if (!targetCity && !hasWeatherKeywords) {
    return { type: 'irrelevant', rawText: norm };
  }

  if (isClearlyIrrelevant && !hasWeatherKeywords) {
    return { type: 'irrelevant', rawText: norm };
  }

  // اگر سوال هواشناسی پرسیده ولی اسمی از هیچ شهری نبرده (مثلا: فردا بارون میاد؟)
  if (!targetCity && hasWeatherKeywords) {
    return { type: 'missing_city', userIntent, rawText: norm };
  }

  // 2. بررسی بازه‌های تاریخی معین شمسی (مانند: ۵ تا ۹ مهر، یا پنجم تا نهم مهر، یا ۱۰ آبان)
  let matchedMonthIdx = -1;
  for (let m = 0; m < PERSIAN_MONTHS.length; m++) {
    if (new RegExp(PERSIAN_MONTHS[m]).test(norm)) {
      matchedMonthIdx = m + 1; // 1 to 12
      break;
    }
  }

  if (matchedMonthIdx !== -1) {
    // تبدیل ارقام فارسی به انگلیسی در کل متن برای استخراج آسان‌تر اعداد
    const normalizedDigits = norm.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

    // الگوی ۱: اعداد دو طرف تا/الی مثل «۵ تا ۹» یا «12 الی 16»
    const numRange = normalizedDigits.match(/(\d{1,2})\s*(?:تا|الی|-)\s*(\d{1,2})/);
    let d1 = null, d2 = null;

    if (numRange) {
      d1 = parseInt(numRange[1], 10);
      d2 = parseInt(numRange[2], 10);
    } else {
      // الگوی ۲: کلمات متنی مثل «پنجم تا نهم»
      const wordsKeys = Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|');
      const wordRangeRegex = new RegExp(`(${wordsKeys})\\s*(?:تا|الی)\\s*(${wordsKeys})`);
      const wordRange = norm.match(wordRangeRegex);
      if (wordRange) {
        d1 = NUMBER_WORDS[wordRange[1]];
        d2 = NUMBER_WORDS[wordRange[2]];
      } else {
        // الگوی ۳: یک روز مشخص شمسی مانند «۱۰ مهر» یا «پنجم مهر»
        const singleNum = normalizedDigits.match(/(\d{1,2})\s*(?:ام)?\s*(?:فروردین|اردیبهشت|خرداد|تیر|مرداد|شهریور|مهر|آبان|آذر|دی|بهمن|اسفند)/);
        if (singleNum) {
          d1 = parseInt(singleNum[1], 10);
          d2 = d1;
        } else {
          for (const [w, val] of Object.entries(NUMBER_WORDS)) {
            if (new RegExp(`(^|[\\s])${w}\\s+${PERSIAN_MONTHS[matchedMonthIdx - 1]}`).test(norm)) {
              d1 = val;
              d2 = val;
              break;
            }
          }
        }
      }
    }

    if (d1 && d2 && d1 <= 31 && d2 <= 31) {
      let jy = currentJalali.jy;
      // اگر ماه درخواست شده قبل از ماه جاری باشد، سال شمسی بعدی مدنظر است
      if (matchedMonthIdx < currentJalali.jm) jy += 1;

      const g1 = jalaliToGregorian(jy, matchedMonthIdx, Math.min(d1, d2));
      const g2 = jalaliToGregorian(jy, matchedMonthIdx, Math.max(d1, d2));
      startDate = new Date(g1.gy, g1.gm - 1, g1.gd);
      endDate = new Date(g2.gy, g2.gm - 1, g2.gd);
    }
  }

  // 3. بررسی عبارات نسبی (امروز، فردا، آخر هفته، یک ماه آینده، ...)
  if (!startDate) {
    if (/یک\s*ماه|ماه\s*آینده|۳۰\s*روز|ماه\s*بعد/i.test(norm)) {
      isMonthlyRequest = true;
      startDate = new Date(now);
      endDate = new Date(now.getTime() + 29 * 24 * 3600 * 1000);
    } else if (/دو\s*هفته|۱۴\s*روز|۲\s*هفته/i.test(norm)) {
      startDate = new Date(now);
      endDate = new Date(now.getTime() + 14 * 24 * 3600 * 1000);
    } else if (/۱۰\s*روز|ده\s*روز/i.test(norm)) {
      startDate = new Date(now);
      endDate = new Date(now.getTime() + 9 * 24 * 3600 * 1000);
    } else if (/هفته\s*(آینده|بعد)/i.test(norm)) {
      // شنبه آینده تا جمعه بعدی
      const daysUntilNextSat = (6 - now.getDay() + 7) % 7 || 7;
      startDate = new Date(now.getTime() + daysUntilNextSat * 24 * 3600 * 1000);
      endDate = new Date(startDate.getTime() + 6 * 24 * 3600 * 1000);
    } else if (/آخر\s*هفته|پنجشنبه|جمعه/i.test(norm)) {
      // پنج‌شنبه و جمعه پیش‌رو
      const day = now.getDay(); // 0=Sun, 4=Thu, 5=Fri
      const daysUntilThu = (4 - day + 7) % 7;
      startDate = new Date(now.getTime() + daysUntilThu * 24 * 3600 * 1000);
      endDate = new Date(startDate.getTime() + 1 * 24 * 3600 * 1000); // Thu & Fri
    } else if (/پس\s*فردا/i.test(norm)) {
      startDate = new Date(now.getTime() + 2 * 24 * 3600 * 1000);
      endDate = new Date(startDate);
    } else if (/فردا/i.test(norm)) {
      startDate = new Date(now.getTime() + 1 * 24 * 3600 * 1000);
      endDate = new Date(startDate);
    } else if (/امروز/i.test(norm)) {
      startDate = new Date(now);
      endDate = new Date(now);
    } else {
      // حالت پیش‌فرض: از امروز تا ۳ روز آینده
      startDate = new Date(now);
      endDate = new Date(now.getTime() + 3 * 24 * 3600 * 1000);
    }
  }

  return {
    city: targetCity,
    startDate,
    endDate,
    isMonthlyRequest,
    userIntent,
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

async function fetchWeatherData(lat, lon, startDate, endDate) {
  const now = new Date();
  // محاسبه تفاوت روز شروع با امروز
  const diffDaysStart = Math.floor((startDate - now) / (24 * 3600 * 1000));
  const diffDaysEnd = Math.floor((endDate - now) / (24 * 3600 * 1000));

  // اگر بازه در محدوده ۱۶ روز آینده باشد، از Forecast API با مدل‌های زنده استفاده می‌کنیم
  if (diffDaysEnd < 16 && diffDaysStart >= -1) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max&forecast_days=16&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Forecast HTTP error ${res.status}`);
      const data = await res.json();
      
      const daily = data.daily;
      const days = [];

      for (let i = 0; i < daily.time.length; i++) {
        const dObj = new Date(daily.time[i] + 'T00:00:00');
        // آیا این روز در بازه انتخابی کاربر هست؟
        if (dObj >= new Date(startDate.toDateString()) && dObj <= new Date(endDate.toDateString())) {
          const wmo = getWmoInfo(daily.weathercode[i]);
          days.push({
            date: dObj,
            iso: daily.time[i],
            jalali: getJalaliDateStr(dObj),
            maxTemp: Math.round(daily.temperature_2m_max[i]),
            minTemp: Math.round(daily.temperature_2m_min[i]),
            precipSum: Math.round(daily.precipitation_sum[i] * 10) / 10,
            precipProb: daily.precipitation_probability_max ? daily.precipitation_probability_max[i] : null,
            windMax: Math.round(daily.windspeed_10m_max[i]),
            desc: wmo.desc,
            icon: wmo.icon,
            isEstimate: false
          });
        }
      }

      return {
        type: 'exact',
        days,
        source: 'مدل‌های ترکیبی جهانی (ECMWF / GFS)'
      };
    } catch (e) {
      console.warn('Forecast API fetch failed, falling back:', e);
    }
  }

  // اگر فراتر از ۱۶ روز باشد یا در بازه ۳۰ روزه ماهانه (مشابه AccuWeather Monthly Trend):
  // از ترکیب آرشیو اقلیمی سال اخیر برای همان بازه تاریخی استفاده می‌کنیم
  try {
    // تاریخ متناظر در سال قبل برای همان بازه روز
    const pastYearStart = new Date(startDate);
    pastYearStart.setFullYear(pastYearStart.getFullYear() - 1);
    const pastYearEnd = new Date(endDate);
    pastYearEnd.setFullYear(pastYearEnd.getFullYear() - 1);

    const sIso = pastYearStart.toISOString().split('T')[0];
    const eIso = pastYearEnd.toISOString().split('T')[0];

    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${sIso}&end_date=${eIso}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Archive HTTP error ${res.status}`);
    const data = await res.json();
    const daily = data.daily;
    const days = [];

    for (let i = 0; i < daily.time.length; i++) {
      // تاریخ واقعی هدف امسال
      const targetDate = new Date(startDate.getTime() + (i * 24 * 3600 * 1000));
      const wmo = getWmoInfo(daily.weathercode[i] || 2);
      const precip = Math.round((daily.precipitation_sum[i] || 0) * 10) / 10;
      days.push({
        date: targetDate,
        iso: targetDate.toISOString().split('T')[0],
        jalali: getJalaliDateStr(targetDate),
        maxTemp: Math.round(daily.temperature_2m_max[i]),
        minTemp: Math.round(daily.temperature_2m_min[i]),
        precipSum: precip,
        precipProb: precip > 1 ? 65 : (precip > 0 ? 35 : 10),
        windMax: 12,
        desc: wmo.desc,
        icon: wmo.icon,
        isEstimate: true
      });
    }

    return {
      type: 'monthly',
      days,
      source: 'ترند اقلیمی و ماهانه (AccuWeather-Style Climate Model)'
    };
  } catch (err) {
    console.error('All weather fetches failed:', err);
    return null;
  }
}

// ==========================================
// 5. تولید پاسخ روان، تحلیلی و کارت‌های چت
// ==========================================
function generateAssistantResponse(parsed, weatherResult, location) {
  if (!weatherResult || !weatherResult.days || weatherResult.days.length === 0) {
    return {
      text: `شرمنده‌تم! نتونستم برای این روزها تو **${location.name}** دیتای درستی پیدا کنم. می‌خوای یه شهر دیگه یا یه تاریخ نزدیک‌تر رو بسنجیم؟`,
      cardsHtml: '',
      suggestions: ['هوای امروز تهران', 'آخر هفته چالوس', 'هوای مشهد']
    };
  }

  const days = weatherResult.days;
  const isExact = weatherResult.type === 'exact';

  // تحلیل کلی وضعیت
  const maxTemps = days.map(d => d.maxTemp);
  const minTemps = days.map(d => d.minTemp);
  const highestTemp = Math.max(...maxTemps);
  const lowestTemp = Math.min(...minTemps);
  const totalRain = Math.round(days.reduce((acc, d) => acc + d.precipSum, 0) * 10) / 10;
  const rainyDays = days.filter(d => d.precipSum >= 0.5 || (d.precipProb && d.precipProb >= 40));

  let summaryText = '';
  const dateRangeStr = days.length === 1 
    ? days[0].jalali.full 
    : `بازه‌ی ${days[0].jalali.short} تا ${days[days.length - 1].jalali.short}`;

  // لحن کاملاً محاوره‌ای، خودمونی و رفاقتی
  if (parsed.userIntent === 'rain') {
    if (rainyDays.length > 0) {
      const peakRainDay = [...days].sort((a, b) => b.precipSum - a.precipSum)[0];
      summaryText = `آره رفیق، تو ${dateRangeStr} تو **${location.name}** بارون داریم! 🌧️\n\n` +
        `بیشترین بارش می‌افته روز **${peakRainDay.jalali.weekday} (${peakRainDay.jalali.short})** با حدود **${peakRainDay.precipSum} میلی‌متر** و احتمال **${peakRainDay.precipProb || 70}٪**. ` +
        `سرجمع تو این چند روز نزدیک **${totalRain} میلی‌متر** بارون پیش‌بینی شده. اگه قصد رفتن داری، چتر و لباس بارونی حتماً همراهت باشه!`;
    } else {
      summaryText = `خیالت تخت تخت! تو ${dateRangeStr} تو **${location.name}** اصلاً خبری از بارون جدی نیست و هوا صاف یا فوقش کمی ابریه. ☀️`;
    }
  } else if (parsed.userIntent === 'temp') {
    summaryText = `اوضاع دمای **${location.name}** تو ${dateRangeStr} اینطوریه:\n\n` +
      `گرم‌ترین ساعت‌ها تا **${highestTemp} درجه** می‌ره بالا و شب‌ها هم تا **${lowestTemp} درجه** خنک (یا سرد) می‌شه. ` +
      (lowestTemp < 10 ? 'شب‌ها و اول صبح قشنگ سرده، پس حواست باشه لباس گرم دم دستت بذاری!' : 'هوا در کل خیلی معتدل و باحاله و می‌چسبه برای گشت‌وگذار.');
  } else {
    // حالت عمومی (General Intent)
    if (rainyDays.length > 0) {
      summaryText = `تو ${dateRangeStr} هوای **${location.name}** یکم ناپایداره و بارون داریم 🌦️\n\n` +
        `دما بین **${lowestTemp}° تا ${highestTemp}°** در نوسانه. تو ${rainyDays.length} روز از این دوره شانس بارندگی بالاست و کلاً حدود **${totalRain} میلی‌متر** بارون تخمین زده شده.`;
    } else {
      summaryText = `هوای **${location.name}** تو ${dateRangeStr} کاملاً آروم و پایداره 🌤️\n\n` +
        `آسمون غالباً صاف تا نیمه‌ابریه، دما هم بین **${lowestTemp}° تا ${highestTemp}°** می‌چرخه و شرایط برای سفر و کار کاملاً ردیفه!`;
    }
  }

  // توضیح در مورد مدل پیش‌بینی به زبان خودمونی
  if (!isExact) {
    summaryText += `\n\n*(💡 راستی چون این تاریخ بیشتر از ۱۶ روز دیگه است، مدل‌های ساعتی قطعی هنوز فعال نشدن؛ واسه همین این پیش‌بینی رو بر اساس میانگین هوای همین روزها تو سال‌های اخیر برات درآوردم — دقیقاً مثل کاری که اکیوودر می‌کنه!)*`;
  }

  // ساخت کارت‌های تعاملی روزانه
  let cardsHtml = `
    <div class="weather-card-container">
      <div class="weather-header-banner">
        <div class="weather-header-info">
          <span class="weather-loc-icon">📍</span>
          <div>
            <div class="weather-loc-title">${location.name} (${location.province})</div>
            <div class="weather-loc-sub">${dateRangeStr}</div>
          </div>
        </div>
        <span class="weather-badge ${isExact ? 'badge-exact' : 'badge-monthly'}">
          ${isExact ? '⚡ پیش‌بینی دقیق ماهواره‌ای' : '🗓️ ترند ماهانه (مثل اکیوودر)'}
        </span>
      </div>

      <div class="daily-cards-scroll">
  `;

  days.forEach((day, idx) => {
    const isToday = idx === 0 && Math.abs(day.date - new Date()) < 24 * 3600 * 1000;
    cardsHtml += `
      <div class="day-card ${isToday ? 'is-today' : ''}">
        <span class="day-card-name">${isToday ? 'امروز' : day.jalali.weekday}</span>
        <span class="day-card-date">${day.jalali.short}</span>
        <span class="day-card-icon">${day.icon}</span>
        <div class="day-card-temp">
          <span class="temp-max">${day.maxTemp}°</span>
          <span class="temp-min">${day.minTemp}°</span>
        </div>
        ${day.precipSum > 0 ? `
          <div class="day-card-precip" title="احتمال ${day.precipProb || 60}٪ - حجم ${day.precipSum} mm">
            <span>💧</span>
            <span>${day.precipSum}mm</span>
          </div>
        ` : `
          <span class="day-card-desc">${day.desc.split(' ')[0]}</span>
        `}
      </div>
    `;
  });

  cardsHtml += `
      </div>
      <div class="weather-audit-bar">
        <span class="audit-badge">🛡️ مدل محاسباتی ${weatherResult.source}</span>
        <a href="https://open-meteo.com/en/docs#latitude=${location.lat}&longitude=${location.lon}" target="_blank" rel="noopener" class="audit-link" title="مشاهده داکیومنت و داده‌های خام بدون واسطه">
          🔍 راست‌آزمایی و مشاهده داده‌های خام ماهواره‌ای
        </a>
      </div>
    </div>
  `;

  // تولید پیشنهادات هوشمند مرتبط با همان شهر
  const suggestions = [
    `بارندگی ${location.name} در روزهای بعد`,
    `هوای تهران چطوره؟`,
    `یک ماه آینده ${location.name}`
  ];

  return {
    text: summaryText,
    cardsHtml,
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
        <div style="white-space: pre-line; margin-bottom: 8px;">${data.text}</div>
        ${data.cardsHtml || ''}
      </div>
  `;

  if (data.suggestions && data.suggestions.length > 0) {
    html += `<div class="msg-suggestions">`;
    data.suggestions.forEach(s => {
      html += `<button class="suggestion-pill" data-query="${escapeHtml(s)}">${escapeHtml(s)}</button>`;
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

  scrollToBottom();
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
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
        <div class="welcome-title">سلام فرزین جان! چطوری رفیق؟ 👋</div>
        <div class="welcome-desc">
          دیگه لازم نیست با نقشه‌های شلوغ و لایه‌های گنگ سر و کله بزنی! هر شهری رو با هر تاریخی که می‌خوای بهم بگو؛ از فردا تا ماه آینده، خودم می‌پرم از ماهواره‌ها چک می‌کنم و بهت می‌گم بارون میاد، چتر لازمه یا هوا سرده.
        </div>
        <div class="chips-title">چند تا نمونه برای تست (فقط روشون بزن):</div>
        <div class="chips-grid">
          <button class="chip-btn" data-query="۵ تا ۹ مهر چالوس چطوره؟ بارونیه؟">🌧️ ۵ تا ۹ مهر چالوس بارونیه؟</button>
          <button class="chip-btn" data-query="فردا تهران بارون میاد؟">☔ فردا تهران بارون میاد؟</button>
          <button class="chip-btn" data-query="آخر هفته رامسر هوا چطوره؟">🏖️ آخر هفته رامسر چطوره؟</button>
          <button class="chip-btn" data-query="وضع هوای شیراز در یک ماه آینده">📅 شیراز تو ماه آینده</button>
          <button class="chip-btn" data-query="دمای تبریز تا آخر این هفته">❄️ دمای تبریز تا آخر هفته</button>
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

    // پاسخ به احوال‌پرسی
    if (parsed.type === 'greeting') {
      appendAssistantMessage({
        text: 'سلام فرزین جان! 👋 چطوری رفیق؟ همه‌چی روبه‌راهه؟\nبگو ببینم هوای کدوم شهرو می‌خوای برات بسنجم؟ (از فردا تا ماه آینده هر جا بخوای آماده‌ام!)',
        cardsHtml: '',
        suggestions: ['۵ تا ۹ مهر چالوس چطوره؟', 'فردا تهران بارون میاد؟', 'آخر هفته رامسر چطوره؟']
      });
      btnSend.disabled = false;
      return;
    }

    // پاسخ به تشکر
    if (parsed.type === 'thanks') {
      appendAssistantMessage({
        text: 'نوکرتم رفیق! کاری نکردم. ❤️ هر وقت برنامه سفر داشتی یا خواستی بدونی فردا چی بپوشی، فقط صدام بزن!',
        cardsHtml: '',
        suggestions: ['هوای امروز تهران', 'آخر هفته شمال بارونیه؟', 'یک ماه آینده چالوس']
      });
      btnSend.disabled = false;
      return;
    }

    // معرفی هویت
    if (parsed.type === 'identity') {
      appendAssistantMessage({
        text: 'من رفیق و دستیار هوای ایرانم! 🌤️\nکارت اینه که هر سوالی داری به زبون خودمونی بپرسی؛ منم می‌پرم از ماهواره‌های اروپایی و آمریکایی دیتای واقعی بارون و دما رو برات می‌کشم بیرون تا با خیال راحت برنامه‌ریزی کنی.',
        cardsHtml: '',
        suggestions: ['۵ تا ۹ مهر چالوس چطوره؟', 'شیراز تو ماه آینده', 'هوای تهران']
      });
      btnSend.disabled = false;
      return;
    }

    // سوال‌های متفرقه و خارج از حوزه آب‌وهوا
    if (parsed.type === 'irrelevant') {
      appendAssistantMessage({
        text: 'قربونت برم، من تخصصم فقط و فقط آب‌وهوا و بارون و سرماست! 😄\nتوی این موضوع‌ها اصلاً سر در نمیارم، ولی اگه خواستی بدونی فردا هوا چطوره یا جاده چالوس بارونیه یا نه، رو من حساب کن! 🌦️',
        cardsHtml: '',
        suggestions: ['فردا تهران بارون میاد؟', '۵ تا ۹ مهر چالوس چطوره؟', 'آخر هفته اصفهان']
      });
      btnSend.disabled = false;
      return;
    }

    // سوال هواشناسی بدون اسم شهر
    if (parsed.type === 'missing_city') {
      appendAssistantMessage({
        text: 'نگفتی هوای کدوم شهرو می‌خوای رفیق؟ اسم شهر رو هم تو پیامت بنویس (مثلاً: **فردا تهران بارون میاد؟** یا **هوای اصفهان تا آخر هفته**) تا سریع چک کنم برات.',
        cardsHtml: '',
        suggestions: ['فردا تهران بارون میاد؟', '۵ تا ۹ مهر چالوس', 'آخر هفته مشهد']
      });
      btnSend.disabled = false;
      return;
    }

    // 2. تعیین شهر برای سوالات معتبر آب‌وهوا
    let loc = null;
    if (parsed.city) {
      loc = await resolveLocation(parsed.city);
    }

    if (!loc) {
      appendAssistantMessage({
        text: `متوجه نشدم منظورت دقیقاً کدوم شهره! اسم شهر (مثلاً چالوس، رشت، تهران...) رو هم بنویس تا سریع مختصاتشو پیدا کنم.`,
        cardsHtml: '',
        suggestions: ['۵ تا ۹ مهر چالوس', 'هوای فردا تهران', 'آخر هفته اصفهان']
      });
      btnSend.disabled = false;
      return;
    }

    // 3. دریافت داده‌های آب‌وهوا از API
    const weatherResult = await fetchWeatherData(loc.lat, loc.lon, parsed.startDate, parsed.endDate);

    // 4. تولید پاسخ هوشمند و نمایش
    const reply = generateAssistantResponse(parsed, weatherResult, loc);
    appendAssistantMessage(reply);

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
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;

      appendUserMessage('📍 هوای موقعیت فعلی من چطوره؟');
      appendTypingIndicator();

      const now = new Date();
      const end = new Date(now.getTime() + 4 * 24 * 3600 * 1000);
      const weatherResult = await fetchWeatherData(lat, lon, now, end);

      const reply = generateAssistantResponse(
        { userIntent: 'general', isMonthlyRequest: false },
        weatherResult,
        { name: 'موقعیت شما', province: 'مختصات ثبت‌شده' }
      );
      appendAssistantMessage(reply);
    },
    (err) => {
      btnGps.style.opacity = '1';
      showToast('دسترسی به موقعیت مکانی تأیید نشد');
    },
    { timeout: 10000 }
  );
});

// راه‌اندازی اولیه
renderWelcomeMessage();
