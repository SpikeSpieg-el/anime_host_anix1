import { NextRequest, NextResponse } from "next/server"

// Добавлены aniqit.com и anivod.com — без них половина ссылок отдаст 403
const KODIK_DOMAINS = [
  "aniqit.com",
  "anivod.com",
  "kodikplayer.com",
  "kodik.cc",
  "kodik.info",
  "kodik.biz",
  "kodik-add.com",
]

function isValidKodikUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const domain = parsed.hostname.replace(/^www\./, "")
    return KODIK_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
  } catch {
    return false
  }
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
[id*="teaser"],[class*="teaser"],[id*="promo"],[class*="promo"],
.vast-container,.vast-ad,.vast-preroll,.vast-overlay,
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
  
  // ИСПРАВЛЕНО: убран ошибочный () в конце вызова observe
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

const RESPONSE_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy": "frame-ancestors 'self' *",
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url")

  if (!targetUrl) {
    return new NextResponse("Missing URL", { status: 400, headers: RESPONSE_HEADERS })
  }

  if (!isValidKodikUrl(targetUrl)) {
    return new NextResponse("Invalid URL", { status: 403, headers: RESPONSE_HEADERS })
  }

  const urlObj = new URL(targetUrl)
  if (!urlObj.searchParams.has("country")) {
    urlObj.searchParams.set("country", "US")
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

    const baseUrl = new URL(finalUrl)
    const baseOrigin = `${baseUrl.protocol}//${baseUrl.host}`
    const baseTag = `<base href="${baseOrigin}${baseUrl.pathname}">`

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
    // В случае сбоя отдаем красивую заглушку, а не белый экран смерти
    return new NextResponse(
      `<html><body style="background:#09090b;color:#71717a;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;margin:0;"><p>Ошибка загрузки видеопотока. Попробуйте обновить серию.</p></body></html>`,
      { status: 200, headers: RESPONSE_HEADERS }
    )
  }
}