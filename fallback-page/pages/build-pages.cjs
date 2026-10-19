// Генератор Pages-варианта заглушки: ../html/maintenance.html -> ./index.html
// Запуск:  node build-pages.cjs   (после любых правок основной страницы)
// Отличия Pages-версии от nginx-версии:
//   1) относительные пути к шрифтам и арту (Pages может жить в подкаталоге);
//   2) автопробка отключена — DNS weeb-x.com уже переключён на Pages вручную,
//      проверять «жив ли сайт» отсюда невозможно; кнопка «Проверить снова»
//      заменена на «Открыть сайт» (новая вкладка);
//   3) тексты панели адаптированы под режим «весь сервер лежит».
// Остальное (дизайн, тексты) копируется 1:1 — постранично синхронизируемся с сайтом.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

let html = fs.readFileSync(path.join(ROOT, "html", "maintenance.html"), "utf8");

// 1. Относительные пути к шрифтам и арту
html = html.split('"/fonts/').join('"fonts/');
html = html.replace('src="/assets/maintenance-girl.png"', 'src="assets/maintenance-girl.png"');

// 2. Комментарий-шапка целиком
html = html.replace(
  /<!--[\s\S]*?-->/,
  `<!--
  Вариант «весь сервер умер» для GitHub Pages (генерируется из html/maintenance.html
  скриптом build-pages.cjs: относительные пути, автопробка отключена).
  Логика отличается осознанно: DNS weeb-x.com здесь уже переключён на Pages вручную,
  проверять «жив ли сайт» отсюда невозможно — трафик в Cloudflare тоже возвращают
  вручную после восстановления. См. pages/README.md.
-->`
);

// 3. Плашка в шапке
html = html.replace('<span class="dot" aria-hidden="true"></span>Maintenance mode',
                    '<span class="dot" aria-hidden="true"></span>Disaster mode · Pages');

// 4. Панель статуса: автопробка отключена (заменяем все строки панели разом)
html = html.replace(
  /<div class="panel-row"><span class="k">Статус[\s\S]*?<\/div>\s*<\/div>/,
  `<div class="panel-row"><span class="k">Статус</span><span class="v"><span class="accent">SERVER DOWN</span> · весь сервер лежит</span></div>
      <div class="panel-row"><span class="k">Прогресс игроков</span><span class="v">сохранён на серверах</span></div>
      <div class="panel-row"><span class="k">Экран открыт</span><span class="v"><span class="accent" id="since">00:00</span></span></div>
      <div class="panel-row"><span class="k">Автопроверка</span><span class="v">отключена — DNS переведён на страницы GitHub-хостинга, проверка вручную</span></div>
    </div>`
);

// 5. Кнопка «Проверить снова» → «Открыть сайт» (переход на домен; заработает,
//    когда DNS снова укажет на VPS, пока DNS смотрит на Pages — вернёт сюда же)
html = html.replace(
  /<button class="btn btn-ghost"[\s\S]*?Проверить снова[\s\S]*?<\/button>/,
  `<a class="btn btn-ghost" href="https://weeb-x.com" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
        Открыть сайт
      </a>`
);

// 6. Скрипт: только таймер, без probe-логики
html = html.replace(
  /<script>[\s\S]*<\/script>/,
  `<script>
(function () {
  "use strict";
  // Вариант «весь сервер умер» (GitHub Pages). Автопробки нет и не должно быть:
  // DNS уже переключён на Pages, а проверять жив ли VPS отсюда невозможно
  // (weeb-x.com временно указывает сюда же). Трафик в Cloudflare возвращают
  // вручную, когда сервер восстановят — после этого обычный reload открывает сайт.
  var sinceEl = document.getElementById("since");
  var openedAt = Date.now();
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function elapsed() {
    var s = Math.max(0, Math.floor((Date.now() - openedAt) / 1000));
    return pad(Math.floor(s / 60)) + ":" + pad(s % 60);
  }
  setInterval(function () { if (sinceEl) sinceEl.textContent = elapsed(); }, 1000);
})();
</script>`
);

// Страховки: абсолютных путей и probe-логики быть не должно, правки должны примениться
if (html.includes('"/fonts/') || html.includes('"/assets/') || /<script>[\s\S]*location\.reload/.test(html)) {
  throw new Error("Остались абсолютные пути или probe-логика — правки неполные");
}
if (!html.includes("fonts/Unbounded-Bold.woff2") || !html.includes("assets/maintenance-girl.png") || !html.includes("SERVER DOWN") || !html.includes("Открыть сайт")) {
  throw new Error("Правки не применились");
}

fs.writeFileSync(path.join(__dirname, "index.html"), html);
console.log("pages/index.html сгенерирован:", Math.round(fs.statSync(path.join(__dirname, "index.html")).size / 102.4) / 10, "КБ");
