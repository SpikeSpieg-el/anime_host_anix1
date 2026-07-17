import { NextRequest, NextResponse } from "next/server"

const KODIK_DOMAINS = [
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
.kodik__overlay,.kodik-preroll,.kodik__preroll,.preroll-container,.preroll-wrapper {
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
  var AD_DOMAINS=['yandex.ru','yandex.net','yandex.com','googleadservices.com','googlesyndication.com','doubleclick.net','adhigh.net','adfox.ru','ad.mail.ru','ad.adriver.ru','acint.net','mixmarket.biz','otm-r.ru','ads.adfox.ru','an.yandex.ru','mc.yandex.ru','adservice.google.com','partner.googleadservices.com','pubads.g.doubleclick.net'];
  function isAdUrl(url){
    if(!url) return false;
    try{
      var u=new URL(url,location.href);
      var h=u.hostname.replace(/^www\\./,'');
      return AD_DOMAINS.some(function(d){return h===d||h.endsWith('.'+d);});
    }catch(e){return false;}
  }
  var oc=document.createElement.bind(document);
  document.createElement=function(tag){
    var el=oc(tag);
    if(tag&&tag.toLowerCase()==='script'){
      var d=Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'src');
      if(d&&d.set){
        Object.defineProperty(el,'src',{get:d.get,set:function(v){if(isAdUrl(v))return;d.set.call(this,v);},configurable:true});
      }
    }
    return el;
  };
  var of=window.fetch;
  window.fetch=function(input,init){
    var url=typeof input==='string'?input:(input&&input.url);
    if(isAdUrl(url))return Promise.reject(new Error('blocked'));
    return of.apply(this,arguments);
  };
  var ox=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,url){
    if(isAdUrl(url))return;
    return ox.apply(this,arguments);
  };
  var oi=Node.prototype.insertBefore;
  Node.prototype.insertBefore=function(n,r){
    if(n&&n.tagName==='IFRAME'&&isAdUrl(n.src))return n;
    if(n&&n.tagName==='SCRIPT'&&isAdUrl(n.src))return n;
    return oi.apply(this,arguments);
  };
  var oa=Node.prototype.appendChild;
  Node.prototype.appendChild=function(n){
    if(n&&n.tagName==='IFRAME'&&isAdUrl(n.src))return n;
    if(n&&n.tagName==='SCRIPT'&&isAdUrl(n.src))return n;
    return oa.apply(this,arguments);
  };
  var mo=new MutationObserver(function(mutations){
    mutations.forEach(function(mut){
      mut.addedNodes.forEach(function(node){
        if(node.nodeType!==1)return;
        var cl=(node.className||'').toString().toLowerCase();
        var id=(node.id||'').toLowerCase();
        if(/(^|\\s)(ad|ads|reklama|preroll|banner|sponsor|promo)(\\s|$|[-_])/.test(cl)||/(^|[-_])(ad|ads|reklama|preroll|banner|sponsor|promo)([-_]|$)/.test(id)){
          node.style.cssText='display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;width:0!important;height:0!important;position:absolute!important;left:-9999px!important;top:-9999px!important;z-index:-1!important;';
        }
        if(node.tagName==='IFRAME'&&isAdUrl(node.src)){node.remove();}
        if(node.tagName==='SCRIPT'&&isAdUrl(node.src)){node.remove();}
      });
    });
  });
  mo.observe(document.documentElement||document.body||document,{childList:true,subtree:true});
})();
</script>
`

// Пул "иностранных" IP-адресов для ротации — Kodik не показывает рекламу для не-RU/CIS регионов.
// Используем реальные публичные IP европейских CDN, чтобы запрос выглядел легитимно.
const FOREIGN_IPS = [
  "104.16.123.96",   // Cloudflare EU
  "151.101.1.69",    // Fastly US
  "199.232.36.100",  // Fastly EU
  "172.67.209.40",   // Cloudflare US
]

function getRandomForeignIP(): string {
  return FOREIGN_IPS[Math.floor(Math.random() * FOREIGN_IPS.length)]
}

export async function GET(request: NextRequest) {
  const targetUrl = request.nextUrl.searchParams.get("url")

  if (!targetUrl) {
    return new NextResponse("Missing URL", { status: 400 })
  }

  if (!isValidKodikUrl(targetUrl)) {
    return new NextResponse("Invalid URL", { status: 403 })
  }

  // Принудительно добавляем country=US если не указано — Kodik не показывает
  // рекламу для не-RU/CIS регионов
  const urlObj = new URL(targetUrl)
  if (!urlObj.searchParams.has("country")) {
    urlObj.searchParams.set("country", "US")
  }
  const finalUrl = urlObj.toString()

  const fakeIP = getRandomForeignIP()

  try {
    const response = await fetch(finalUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://kodik.cc/",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "X-Forwarded-For": fakeIP,
        "X-Real-IP": fakeIP,
        "CF-Connecting-IP": fakeIP,
        "True-Client-IP": fakeIP,
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return new NextResponse(`Failed to fetch: ${response.statusText}`, {
        status: response.status,
      })
    }

    const html = await response.text()

    // <base> тег — относительные URL ресурсов Kodik (скрипты, стили) 
    // будут загружаться с оригинального домена, а не с нашего
    const baseUrl = new URL(finalUrl)
    const baseOrigin = `${baseUrl.protocol}//${baseUrl.host}`
    const baseTag = `<base href="${baseOrigin}${baseUrl.pathname}">`

    // Внедряем <base>, CSS и JS для блокировки рекламы
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
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return new NextResponse("Request timeout", { status: 504 })
    }
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
