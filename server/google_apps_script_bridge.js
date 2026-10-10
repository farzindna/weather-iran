/**
 * پل ارتباطی هوای ایران با Google Apps Script
 * این کد را در script.google.com پیست کنید و به عنوان Web App مستقر (Deploy) کنید.
 * 
 * مزیت:
 * ۱. با تمام فیلترشکن‌ها و بدون فیلترشکن با سرعت نور کار می‌کند.
 * ۲. داده‌ها را در یک فایل اکسل گوگل (Google Sheet) ذخیره می‌کند.
 * ۳. همزمان پیام را مستقیم به ربات «بله» فرزین ارسال می‌کند.
 */

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var data = JSON.parse(raw);
    
    // ۱. دسترسی به شیت فعال یا ایجاد صفحه
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      // اگر مستقیماً به شیتی متصل نیست، یک فایل جدید یا شیت پیش‌فرض باز شود
      ss = SpreadsheetApp.create("هوای ایران - گزارش‌های میدانی");
    }
    var sheet = ss.getActiveSheet();
    
    // هدر جدول در صورتی که سطر اول خالی باشد
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "شناسه",
        "تاریخ و ساعت ثبت",
        "موقعیت (شهر / منطقه)",
        "وضعیت بارش",
        "وضعیت باد",
        "مدل‌های دقیق‌تر",
        "یادداشت کاربر",
        "داده خام JSON"
      ]);
      sheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#e2e8f0");
      sheet.setFrozenRows(1);
    }
    
    // استخراج فیلدها
    var city = (data.city || data.cityName || "تهران").toString().trim();
    var district = (data.district || (data.userVerdict && data.userVerdict.district) || "").toString().trim();
    
    var districtMap = {
      'شمال': 'شمال (تجریش و نیاوران)',
      'شرق': 'شرق (تهرانپارس و لویزان)',
      'غرب': 'غرب (چیتگر و صادقیه)',
      'مرکز': 'مرکز',
      'جنوب': 'جنوب (شهر ری و نازی‌آباد)',
      'طرقبه': 'طرقبه و شاندیز',
      'وکیل‌آباد': 'وکیل‌آباد',
      'صفه': 'کوه صفه',
      'صدرا': 'شهر جدید صدرا',
      'عظیمیه': 'عظیمیه',
      'ائل‌گلی': 'ائل‌گلی'
    };
    
    var distLabel = districtMap[district] || district;
    var locStr = distLabel ? (city.indexOf(district) !== -1 ? city : city + " — " + distLabel) : city;
    
    var time = data.timeStr || data.time || "";
    var date = data.jalali || data.dateIso || data.date || "";
    var dateTimeStr = date + (time ? " (ساعت " + time + ")" : "");
    
    var rainMap = {
      'dry': '🌂 نمی‌باره (خشک)',
      'light': '🌦️ رگبار / نم‌نم باران',
      'heavy': '🌧️ باران مداوم و شدید'
    };
    var rawRain = (data.userVerdict && data.userVerdict.realRain) ? data.userVerdict.realRain : "";
    var realRain = rainMap[rawRain] || rawRain || "ثبت نشده";
    
    var windMap = {
      'calm': '🍃 باد آرام',
      'moderate': '💨 باد متوسط',
      'storm': '🌪️ تندباد شدید'
    };
    var rawWind = (data.userVerdict && data.userVerdict.realWind) ? data.userVerdict.realWind : "";
    var realWind = windMap[rawWind] || rawWind || "ثبت نشده";
    
    var notes = (data.userVerdict && data.userVerdict.notes) ? data.userVerdict.notes : "";
    
    var rawModels = (data.userVerdict && data.userVerdict.accurateModels) || [];
    var modelsStr = "انتخاب نشده";
    if (rawModels.indexOf("none") !== -1) {
      modelsStr = "❌ هیچ‌کدام از مدل‌ها درست نگفتند";
    } else if (rawModels.length > 0) {
      modelsStr = rawModels.map(function(m) { return m.toUpperCase(); }).join("، ") + " ✅";
    }
    
    // ذخیره در سطر جدید شیت
    sheet.appendRow([
      data.id || ("ID_" + new Date().getTime()),
      dateTimeStr,
      locStr,
      realRain,
      realWind,
      modelsStr,
      notes,
      raw
    ]);
    
    // ۲. ارسال پیام به ربات بله فرزین
    var baleToken = "57732307:A0QzU5nF6qL-KUPyE8ZgYUkoco2Kqb5ptHI";
    var baleChatId = "949834279";
    
    var msg = "🌦 گزارش میدانی جدید هوای ایران (از پل گوگل):\n\n"
            + "📍 موقعیت: " + locStr + "\n"
            + "⏰ زمان: " + dateTimeStr + "\n"
            + "🌧 وضعیت بارش: " + realRain + "\n"
            + "💨 وضعیت باد: " + realWind + "\n"
            + "🎯 مدل‌های دقیق‌تر: " + modelsStr + "\n";
            
    if (notes) {
      msg += "📝 یادداشت کاربر: " + notes + "\n";
    }
    msg += "\n📊 ثبت در Google Sheet با موفقیت انجام شد";
    
    var baleUrl = "https://tapi.bale.ai/bot" + baleToken + "/sendMessage";
    UrlFetchApp.fetch(baleUrl, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        chat_id: baleChatId,
        text: msg
      }),
      muteHttpExceptions: true
    });
    
    return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
