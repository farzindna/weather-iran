/**
 * پل ارتباطی هوای ایران با Google Apps Script
 * ارسال به تلگرام + ارسال به بله (بدون تکرار) + ثبت در شیت
 * 
 * 🔒 راهنمای امنیت:
 * هیچ توکنی نباید مستقیماً در این کد نوشته شود!
 * برای تنظیم توکن‌ها، در ادیتور Apps Script به مسیر زیر بروید:
 * Project Settings (آیکون چرخ‌دنده در منوی چپ) > Script Properties > Add script property
 * و این ۴ کلید را مقداردهی کنید:
 * 1. TELEGRAM_BOT_TOKEN
 * 2. TELEGRAM_CHAT_ID
 * 3. BALE_BOT_TOKEN
 * 4. BALE_CHAT_ID
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

    // خواندن امن کلیدها و توکن‌ها از Script Properties گوگل (هیچ توکنی نباید در کد عمومی باشد)
    var scriptProps = PropertiesService.getScriptProperties();
    var baleToken = scriptProps.getProperty("BALE_BOT_TOKEN");
    var baleChatId = scriptProps.getProperty("BALE_CHAT_ID");
    var tgToken = scriptProps.getProperty("TELEGRAM_BOT_TOKEN");
    var tgChatId = scriptProps.getProperty("TELEGRAM_CHAT_ID");

    // ۲. ارسال پیام به ربات بله (فقط در صورتی که توکن تنظیم شده و سرور ایران قبلاً نفرستاده باشد)
    if (!data.skipBale && baleToken && baleChatId) {
      try {
        var baleUrl = "https://tapi.bale.ai/bot" + baleToken + "/sendMessage";
        UrlFetchApp.fetch(baleUrl, {
          method: "post",
          contentType: "application/json",
          payload: JSON.stringify({ chat_id: baleChatId, text: msg }),
          muteHttpExceptions: true
        });
      } catch(baleErr) {}
    }

    // ۳. ارسال مستقیم به ربات تلگرام فرزین (فقط در صورتی که توکن تنظیم شده باشد)
    if (tgToken && tgChatId) {
      try {
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
    }

    // ۴. ثبت یکپارچه و دائمی در یک فایل واحد گوگل شیت (جلوگیری از ساخت فایل‌های متعدد)
    try {
      var scriptProps = PropertiesService.getScriptProperties();
      var sheetId = scriptProps.getProperty("MAIN_SHEET_ID");
      var ss = null;

      if (sheetId) {
        try {
          ss = SpreadsheetApp.openById(sheetId);
        } catch(openErr) {
          ss = null;
        }
      }

      // اگر هنوز فایلی ساخته نشده بود، فقط یک بار می‌سازد و آیدی‌اش را ذخیره می‌کند
      if (!ss) {
        ss = SpreadsheetApp.create("هوای ایران — گزارش‌های میدانی کاربران");
        scriptProps.setProperty("MAIN_SHEET_ID", ss.getId());
      }

      var sheet = ss.getSheets()[0];
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          "شناسه",
          "زمان ثبت",
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
