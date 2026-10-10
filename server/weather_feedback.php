<?php
/**
 * پل دریافت و ثبت راستی‌آزمایی‌های هوای ایران
 * بدون نیاز به دیتابیس - ذخیره مستقیم در فایل JSON امن با پشتیبانی کامل از CORS و نمایش وب
 */

// ۱. تنظیم هدرهای CORS برای اتصال امن از GitHub Pages یا هر دامنه دیگر
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$storageDir = __DIR__ . '/data';
if (!is_dir($storageDir)) {
    @mkdir($storageDir, 0755, true);
}
$storageFile = $storageDir . '/weather_feedbacks.json';

// ۲. پردازش دریافت لاگ (POST)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header("Content-Type: application/json; charset=utf-8");
    $rawInput = file_get_contents('php://input');
    $data = json_decode($rawInput, true);

    if (!$data || !is_array($data)) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "داده نامعتبر است."], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // اضافه کردن متادیتای سمت سرور
    $data['received_at'] = date('Y-m-d H:i:s');
    $data['client_ip'] = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? 'نامشخص';
    $data['user_agent'] = $_SERVER['HTTP_USER_AGENT'] ?? '';

    // خواندن فایل فعلی با قفل
    $feedbacks = [];
    if (file_exists($storageFile)) {
        $content = file_get_contents($storageFile);
        $feedbacks = json_decode($content, true) ?: [];
    }

    // بررسی عدم ثبت لاگ تکراری بر اساس id
    $existingIndex = -1;
    if (!empty($data['id'])) {
        foreach ($feedbacks as $i => $item) {
            if (isset($item['id']) && $item['id'] === $data['id']) {
                $existingIndex = $i;
                break;
            }
        }
    }

    if ($existingIndex >= 0) {
        $feedbacks[$existingIndex] = array_merge($feedbacks[$existingIndex], $data);
    } else {
        array_unshift($feedbacks, $data);
    }

    // ذخیره امن
    file_put_contents($storageFile, json_encode($feedbacks, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

    // ارسال اعلان به پیام‌رسان بله
    sendNotificationToBale($data);

    echo json_encode(["status" => "ok", "message" => "مشاهده با موفقیت ذخیره شد.", "id" => $data['id'] ?? null], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * ارسال پیام به ربات پیام‌رسان بله
 */
function sendNotificationToBale($data) {
    $token = defined('BALE_BOT_TOKEN') ? BALE_BOT_TOKEN : '57732307:A0QzU5nF6qL-KUPyE8ZgYUkoco2Kqb5ptHI';
    $chatId = defined('BALE_CHAT_ID') ? BALE_CHAT_ID : '949834279';

    if (empty($token) || empty($chatId)) return;

    // ۱. استخراج دقیق نام شهر و منطقه
    $city = !empty($data['city']) ? trim($data['city']) : (!empty($data['cityName']) ? trim($data['cityName']) : 'تهران');
    $district = !empty($data['district']) ? trim($data['district']) : (!empty($data['userVerdict']['district']) ? trim($data['userVerdict']['district']) : '');

    // جدول عنوان‌های دقیق جهت‌ها و مناطق
    $districtMap = [
        'شمال' => 'شمال (تجریش و نیاوران)',
        'شرق' => 'شرق (تهرانپارس و لویزان)',
        'غرب' => 'غرب (چیتگر و صادقیه)',
        'مرکز' => 'مرکز',
        'جنوب' => 'جنوب (شهر ری و نازی‌آباد)',
        'طرقبه' => 'طرقبه و شاندیز',
        'وکیل‌آباد' => 'وکیل‌آباد',
        'صفه' => 'کوه صفه',
        'صدرا' => 'شهر جدید صدرا',
        'عظیمیه' => 'عظیمیه',
        'ائل‌گلی' => 'ائل‌گلی'
    ];

    $districtLabel = isset($districtMap[$district]) ? $districtMap[$district] : $district;

    // موقعیت دقیق و خوانا
    if (!empty($districtLabel)) {
        if (strpos($city, $district) !== false) {
            $locationStr = $city . (isset($districtMap[$district]) ? " ({$districtMap[$district]})" : "");
        } else {
            $locationStr = "{$city} — {$districtLabel}";
        }
    } else {
        $locationStr = $city;
    }

    // ۲. تاریخ و ساعت
    $time = !empty($data['timeStr']) ? $data['timeStr'] : (!empty($data['time']) ? $data['time'] : date('H:i'));
    $date = !empty($data['jalali']) ? $data['jalali'] : (!empty($data['dateIso']) ? $data['dateIso'] : (!empty($data['date']) ? $data['date'] : date('Y-m-d')));

    // ۳. وضعیت بارش
    $rawRain = !empty($data['userVerdict']['realRain']) ? $data['userVerdict']['realRain'] : '';
    $rainMap = [
        'dry' => '🌂 نمی‌باره (خشک)',
        'light' => '🌦️ رگبار / نم‌نم باران',
        'heavy' => '🌧️ باران مداوم و شدید'
    ];
    $realRain = isset($rainMap[$rawRain]) ? $rainMap[$rawRain] : (!empty($rawRain) ? $rawRain : 'ثبت نشده');

    // ۴. وضعیت باد
    $rawWind = !empty($data['userVerdict']['realWind']) ? $data['userVerdict']['realWind'] : '';
    $windMap = [
        'calm' => '🍃 باد آرام',
        'moderate' => '💨 باد متوسط',
        'storm' => '🌪️ تندباد شدید'
    ];
    $realWind = isset($windMap[$rawWind]) ? $windMap[$rawWind] : (!empty($rawWind) ? $rawWind : 'ثبت نشده');

    // ۵. یادداشت کاربر
    $notes = !empty($data['userVerdict']['notes']) ? trim($data['userVerdict']['notes']) : '';

    // ۶. مدل‌های دقیق
    $rawModels = !empty($data['userVerdict']['accurateModels']) && is_array($data['userVerdict']['accurateModels'])
        ? $data['userVerdict']['accurateModels']
        : [];
    
    if (in_array('none', $rawModels)) {
        $modelsStr = '❌ هیچ‌کدام از مدل‌ها درست نگفتند';
    } elseif (!empty($rawModels)) {
        $upperModels = array_map(function($m) { return strtoupper($m); }, $rawModels);
        $modelsStr = implode('، ', $upperModels) . ' ✅';
    } else {
        $modelsStr = 'انتخاب نشده';
    }

    $text = "🌦 گزارش میدانی جدید هوای ایران:\n\n"
          . "📍 موقعیت: " . $locationStr . "\n"
          . "⏰ زمان: " . $date . " (ساعت " . $time . ")\n"
          . "🌧 وضعیت بارش: " . $realRain . "\n"
          . "💨 وضعیت باد: " . $realWind . "\n"
          . "🎯 مدل‌های دقیق‌تر: " . $modelsStr . "\n";

    if (!empty($notes)) {
        $text .= "📝 یادداشت کاربر: " . $notes . "\n";
    }

    $text .= "\n🌐 مشاهده کامل در پنل ژنوپارس:\nhttps://genopars.ir/wp-content/mu-plugins/weather/weather_feedback.php";

    $payload = [
        'chat_id' => $chatId,
        'text' => $text
    ];

    if (function_exists('curl_init')) {
        $ch = curl_init("https://tapi.bale.ai/bot{$token}/sendMessage");
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_UNICODE));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        @curl_exec($ch);
        @curl_close($ch);
    }
}

// ۳. بازگرداندن داده‌ها به عنوان JSON خام برای پنل ادمین (GET ?format=json)
if (isset($_GET['format']) && $_GET['format'] === 'json') {
    header("Content-Type: application/json; charset=utf-8");
    if (file_exists($storageFile)) {
        readfile($storageFile);
    } else {
        echo json_encode([]);
    }
    exit;
}

// ۴. پیش‌نمایش تمیز و مستقل HTML برای مشاهده مستقیم فرزین در مرورگر
$feedbacks = [];
if (file_exists($storageFile)) {
    $feedbacks = json_decode(file_get_contents($storageFile), true) ?: [];
}
$count = count($feedbacks);
?>
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>پنل دریافت گزارش‌های میدانی هوای ایران</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;600;700&display=swap">
  <style>
    :root {
      --bg: #0b0f19;
      --card: #151e32;
      --border: #233152;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --success: #34d399;
    }
    body {
      margin: 0;
      padding: 24px;
      background: var(--bg);
      color: var(--text);
      font-family: 'Vazirmatn', sans-serif;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
    }
    h1 { margin: 0; font-size: 1.4rem; color: var(--accent); }
    .badge {
      background: #1e293b;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 0.9rem;
      border: 1px solid var(--border);
    }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    .card-head {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dashed var(--border);
      padding-bottom: 10px;
      margin-bottom: 12px;
      font-size: 0.95rem;
    }
    .city-badge {
      font-weight: 700;
      color: #fff;
    }
    .time-badge {
      color: var(--muted);
      font-size: 0.85rem;
    }
    .models-bar {
      margin-bottom: 8px;
    }
    .tag {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.8rem;
      margin-left: 6px;
      background: #0f172a;
      border: 1px solid var(--border);
    }
    .tag.winner {
      background: rgba(52, 211, 153, 0.15);
      border-color: var(--success);
      color: var(--success);
    }
    .notes-box {
      background: #0d1322;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 0.9rem;
      color: #f1f5f9;
      margin-top: 10px;
      border-right: 3px solid var(--accent);
    }
    .btn-json {
      background: var(--accent);
      color: #0b0f19;
      padding: 6px 14px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.85rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>📡 لاگ‌ها و فیدبک‌های دریافتی هواشناسی</h1>
        <div style="color: var(--muted); font-size: 0.85rem; margin-top: 4px;">ذخیره روی سرور داخلی ایران</div>
      </div>
      <div>
        <span class="badge">تعداد کل: <?php echo $count; ?> مشاهده</span>
        <a href="?format=json" class="btn-json" target="_blank">دریافت خروجی JSON</a>
      </div>
    </header>

    <?php if (empty($feedbacks)): ?>
      <div style="text-align: center; color: var(--muted); padding: 48px;">هنوز هیچ مشاهده‌ای ثبت نشده است.</div>
    <?php else: ?>
      <?php foreach ($feedbacks as $fb): 
        $verdict = $fb['userVerdict'] ?? [];
        $models = $verdict['accurateModels'] ?? [];
        $district = $verdict['district'] ?? null;
      ?>
        <div class="card">
          <div class="card-head">
            <div class="city-badge">
              📍 <?php echo htmlspecialchars($fb['city'] ?? 'نامشخص'); ?>
              <?php if ($district): ?>
                <span class="tag"><?php echo htmlspecialchars($district); ?></span>
              <?php endif; ?>
              <span style="color: var(--muted); font-size: 0.85rem;">(<?php echo htmlspecialchars($fb['jalali'] ?? $fb['date'] ?? ''); ?>)</span>
            </div>
            <div class="time-badge">
              ساعت ثبت: <?php echo htmlspecialchars($fb['time'] ?? ''); ?> · سرور: <?php echo htmlspecialchars($fb['received_at'] ?? ''); ?>
            </div>
          </div>

          <div class="models-bar">
            <span style="color: var(--muted); font-size: 0.85rem;">مدل‌های درست از نظر کاربر:</span>
            <?php if (!empty($models)): ?>
              <?php foreach ($models as $m): ?>
                <span class="tag winner">✓ <?php echo htmlspecialchars($m); ?></span>
              <?php endforeach; ?>
            <?php else: ?>
              <span class="tag" style="color: #f87171;">هیچ مدلی درست نگفت</span>
            <?php endif; ?>

            <?php if (!empty($verdict['realRain'])): ?>
              <span class="tag" style="margin-right: 12px;">بارش: <?php echo htmlspecialchars($verdict['realRain']); ?></span>
            <?php endif; ?>
            <?php if (!empty($verdict['realWind'])): ?>
              <span class="tag">باد: <?php echo htmlspecialchars($verdict['realWind']); ?></span>
            <?php endif; ?>
          </div>

          <?php if (!empty($verdict['notes'])): ?>
            <div class="notes-box">
              💬 <strong>گزارش متنی کاربر:</strong> <?php echo nl2br(htmlspecialchars($verdict['notes'])); ?>
            </div>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </div>
</body>
</html>
