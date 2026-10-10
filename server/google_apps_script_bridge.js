/**
 * پل ارتباطی هوای ایران با Google Apps Script
 * ارسال همزمان به بله + تلگرام + ثبت در شیت
 */

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : "{}";
    var data = JSON.parse(raw);
    
    // ۱. استخراج دقیق اطلاعات شهر و منطقه
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

    var msg = "🌦 گزارش میدانی جدید هوای ایران:\n\n"
            + "📍 موقعیت: " + locStr + "\n"
            + "⏰ زمان: " + dateTimeStr + "\n"
            + "🌧 وضعیت بارش: " + realRain + "\n"
            + "💨 وضعیت باد: " + realWind + "\n"
            + "🎯 مدل‌های دقیق‌تر: " + modelsStr + "\n";
            
    if (notes) {
      msg += "📝 یادداشت کاربر: " + notes + "\n";
    }
    msg += "\n🌐 ارسال شده از پل هوشمند هواشناسی";

    // ۲. ارسال پیام مستقیم به ربات بله فرزین
    try {
      var baleToken = "57732307:A0QzU5nF6qL-KUPyE8ZgYUkoco2Kqb5ptHI";
      var baleChatId = "949834279";
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
    } catch(baleErr) {}

    // ۳. ارسال مستقیم به ربات تلگرام فرزین
    try {
      var tgToken = "8730697489:AAFmNLgb4lgXU9duDru0rrLPstVGbD9-65U";
      var tgChatId = "106981593";
      var tgUrl = "https://api.telegram.org/bot" + tgToken + "/sendMessage";
      UrlFetchApp.fetch(tgUrl, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          chat_id: tgChatId,
          text: msg
        }),
        muteHttpExceptions: true
      });
    } catch(tgErr) {}

    // ۴. ثبت اختیاری در شیت
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      if (ss) {
        var sheet = ss.getActiveSheet();
        if (sheet.getLastRow() === 0) {
          sheet.appendRow(["شناسه", "زمان", "موقعیت", "بارش", "باد", "مدل‌ها", "یادداشت", "خام"]);
        }
        sheet.appendRow([data.id || "", dateTimeStr, locStr, realRain, realWind, modelsStr, notes, raw]);
      }
    } catch(sheetErr) {}

    return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ status: "ok", service: "Weather Iran Google Bridge" }))
    .setMimeType(ContentService.MimeType.JSON);
}
