import { NextRequest, NextResponse } from "next/server"
import {
  isCrawlerRequest,
  isCrossOriginReferer,
  resolvePlayerToken,
} from "@/lib/player-protect"

/**
 * Отдельная страница плеера: /embed/<токен>.
 *
 * Вместо прямой ссылки на внешний видеохостинг вставляется этот адрес.
 * Токен — зашифрованный (AES-256-GCM) и короткоживущий, поэтому:
 *  - в коде страницы /watch/... нет ни одной внешней ссылки;
 *  - сканер не может сконструировать или угадать адрес плеера;
 *  - даже перехваченный адрес протухает через 48 часов.
 *
 * Страница закрыта от индексации (robots.txt + X-Robots-Tag),
 * не отдаётся ботам и чужим сайтам (см. lib/player-protect.ts).
 */

export const dynamic = "force-dynamic"

/** Какие query-параметры разрешено прокидывать внутрь плеера. */
const ALLOWED_PARAMS = [
  "episode",
  "season",
  "country",
  "autoplay",
  "quality",
  "no_ads",
  "no_provider_ads",
  "hide_selectors",
  "translate",
] as const

const RESPONSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/html; charset=utf-8",
  // Не кэшировать нигде: токен одноразовый по смыслу.
  "Cache-Control": "private, no-store",
  // Сканеры и поисковики не должны индексировать страницу плеера.
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  // Встраивать можно только в наш собственный сайт.
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy": "frame-ancestors 'self'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
}

function notFound(): NextResponse {
  // Ничем не выдаём, что здесь вообще есть плеер.
  return new NextResponse("Not Found", { status: 404, headers: RESPONSE_HEADERS })
}

const AD_BLOCK_CSS = `
.kodik-ad,.kodik-ads,.kodik__ad,.kodik__ads,.kodik-ad-banner,
.kodik-ad-container,.kodik-ad-overlay,.kodik-ad-preroll,.kodik-ad-pause,
.ad-banner,.ad-container,.ad-overlay,.ad-preroll,.ad-unit,.ad-wrapper,.ad-slot,
[data-ad],[data-ad-slot],[data-ad-unit],
[id*="ad-banner"],[id*="ad-container"],[id*="ad_overlay"],
[class*="ad-banner"],[class*="ad-container"],[class*="ad_overlay"],
[class*="preroll"],[id*="preroll"],
.kodik-player__ad,.kodik-player-ad,.kodik-skip-ad,.kodik__skip-ad,
.kodik-adsense,.kodik-yandex-ad,.kodik-reklama,.reklama,.rek,
.yandex-rtb-block,.yandex-ad,.adsbygoogle,.google-ad,
.vjs-ad,.vjs-ads,.video-ad,.video-ads,
.kodik__overlay,.kodik-preroll,.kodik__preroll,.preroll-container,.preroll-wrapper,
[id*="banner"],[class*="adv"],[id*="adv"],.brand-wrapper,
[id*="casino"],[class*="casino"],[id*="betting"],[class*="betting"],
[id*="1xbet"],[class*="1xbet"],[id*="gambling"],[class*="gambling"],
[id*="click"],[class*="click"],[id*="popunder"],[class*="popunder"],
[id*="teaser"],[class*="promo"],[id*="promo"],
.vast-container,.vast-ad,.vast-preroll,.vast-ad-overlay,
.adfox-code,.adfox-bid,.yandex-rtb,.yandex-direct {
  display:none!important;
  visibility:hidden!important;
  opacity:0!important;
  pointer-events:none!important;
  width:0!important;
  height:0!important;
  position:absolute!important;
  left:-9999px!important;
  top:-9999px!important;
  z-index:-1!important;
}
`

const AD_BLOCK_JS = `
<script>
(function(){
  'use strict';

  // 1. Блокируем всплывающие окна казино
  window.open = function() { return null; };

  var AD_DOMAINS = [
    'yandex.ru','yandex.net','yandex.com','googleadservices.com','googlesyndication.com',
    'doubleclick.net','adhigh.net','adfox.ru','ad.mail.ru','ad.adriver.ru','acint.net',
    'mixmarket.biz','otm-r.ru','ads.adfox.ru','an.yandex.ru','mc.yandex.ru',
    'adservice.google.com','partner.googleadservices.com','pubads.g.doubleclick.net',
    'betting.com','1xbet.com','casino.com','gambling.com','clickunder.com','popunder.net','teaser.net'
  ];

  function isAdUrl(url){
    if(!url) return false;
    try{
      var u = new URL(url, location.href);
      var h = u.hostname.replace(/^www\\./,'');
      return AD_DOMAINS.some(function(d){ return h === d || h.endsWith('.' + d); });
    }catch(e){ return false; }
  }

  // Перехват создания тегов script
  var oc = document.createElement.bind(document);
  document.createElement = function(tag){
    var el = oc(tag);
    if(tag && tag.toLowerCase() === 'script'){
      var d = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      if(d && d.set){
        Object.defineProperty(el, 'src', {
          get: d.get,
          set: function(v){
            if(isAdUrl(v)) return;
            d.set.call(this, v);
          },
          configurable: true
        });
      }
    }
    return el;
  };

  // Перехват fetch и XHR к рекламным сетям
  var of = window.fetch;
  window.fetch = function(input, init){
    var url = typeof input === 'string' ? input : (input && input.url);
    if(isAdUrl(url)) return Promise.reject(new Error('blocked'));
    return of.apply(this, arguments);
  };

  var ox = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(m, url){
    if(isAdUrl(url)) return;
    return ox.apply(this, arguments);
  };

  // Удаление всплывающих рекламных узлов
  var mo = new MutationObserver(function(mutations){
    mutations.forEach(function(mut){
      mut.addedNodes.forEach(function(node){
        if(node.nodeType !== 1) return;
        var cl = (node.className || '').toString().toLowerCase();
        var id = (node.id || '').toString().toLowerCase();
        if(/(^|\\s)(ad|ads|reklama|preroll|banner|sponsor|promo|casino|betting|gambling|1xbet|click|popunder|teaser)(\\s|$|[-_])/.test(cl)||/(^|[-_])(ad|ads|reklama|preroll|banner|sponsor|promo|casino|betting|gambling|1xbet|click|popunder|teaser)([-_]|$)/.test(id)){
          node.style.cssText = 'display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;width:0!important;height:0!important;position:absolute!important;left:-9999px!important;top:-9999px!important;z-index:-1!important;';
        }
        if(node.tagName === 'IFRAME' && isAdUrl(node.src)){ node.remove(); }
        if(node.tagName === 'SCRIPT' && isAdUrl(node.src)){ node.remove(); }
      });
    });
  });

  mo.observe(document.documentElement || document.body || document, { childList: true, subtree: true });

  // 2. АВТО-СКИП ВИДЕОРЕКЛАМЫ (срабатывает каждые 250мс)
  setInterval(function() {
    var videos = document.querySelectorAll('video');
    videos.forEach(function(v) {
      // Прероллы казино обычно от 5 до 60 секунд
      if (v.duration && v.duration > 0 && v.duration <= 65 && !v.__adSkipped) {
        v.muted = true;
        v.playbackRate = 16.0;
        try {
          // Мгновенно завершаем видео, отправляя в конец
          v.currentTime = v.duration;
        } catch(e) {}
        v.__adSkipped = true;
      }
    });

    // Удаляем любые всплывающие плашки
    var adOverlays = document.querySelectorAll('[id*="banner"], [class*="adv"], [id*="adv"], .brand-wrapper, [id*="casino"], [class*="casino"], [id*="betting"], [class*="betting"]');
    adOverlays.forEach(function(el) { el.remove(); });
  }, 250);
})();
</script>
`

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // 1. Ботам страницу плеера не отдаём вообще.
  if (isCrawlerRequest(request.headers)) return notFound()

  // 2. Хотлинк с чужого сайта — тоже мимо.
  if (isCrossOriginReferer(request.headers.get("referer"), request.headers, request.url)) {
    return notFound()
  }

  // 3. Расшифровываем токен. Неверный/протухший — обычный 404.
  const { token } = await params
  const baseUrl = resolvePlayerToken(token)
  if (!baseUrl) return notFound()

  // 4. Прокидываем только разрешённые параметры просмотра.
  const urlObj = new URL(baseUrl)
  for (const name of ALLOWED_PARAMS) {
    const value = request.nextUrl.searchParams.get(name)
    if (value !== null) urlObj.searchParams.set(name, value)
  }
  const finalUrl = urlObj.toString()

  try {
    const response = await fetch(finalUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Referer: `${urlObj.origin}/`,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      return new NextResponse(`Failed to fetch: ${response.statusText}`, {
        status: response.status,
        headers: RESPONSE_HEADERS,
      })
    }

    const html = await response.text()

    // База — фактический адрес после редиректов видеохостинга.
    let baseOrigin = urlObj.origin
    let basePath = urlObj.pathname
    if (response.url) {
      try {
        const resolved = new URL(response.url)
        baseOrigin = resolved.origin
        basePath = resolved.pathname
      } catch {
        // остаёмся на запрошенном адресе
      }
    }
    const baseTag = `<base href="${baseOrigin}${basePath}">`

    const adBlockInjection = `${baseTag}<style>${AD_BLOCK_CSS}</style>${AD_BLOCK_JS}`

    let modifiedHtml: string
    if (/<head[^>]*>/i.test(html)) {
      modifiedHtml = html.replace(/(<head[^>]*>)/i, `$1${adBlockInjection}`)
    } else if (/<html[^>]*>/i.test(html)) {
      modifiedHtml = html.replace(/(<html[^>]*>)/i, `$1<head>${adBlockInjection}</head>`)
    } else {
      modifiedHtml = `${adBlockInjection}${html}`
    }

    return new NextResponse(modifiedHtml, {
      status: 200,
      headers: RESPONSE_HEADERS,
    })
  } catch (error) {
    // В случае сбоя отдаём красивую заглушку, а не белый экран смерти
    return new NextResponse(
      `<html><body style="background:#09090b;color:#71717a;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0;"><p>Ошибка загрузки видеопотока. Попробуйте обновить серию.</p></body></html>`,
      { status: 200, headers: RESPONSE_HEADERS }
    )
  }
}
