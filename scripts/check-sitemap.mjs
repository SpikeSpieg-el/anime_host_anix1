#!/usr/bin/env node
/**
 * Быстрая проверка живого sitemap.xml (без зависимостей).
 *
 * Запуск:  npm run sitemap:check
 *          node scripts/check-sitemap.mjs https://weeb-x.com/sitemap.xml
 *
 * Проверяет то, на чём спотыкаются Яндекс и Google:
 *   — HTTP-статус и Content-Type;
 *   — XML well-formedness (парность тегов, корректность entity-ссылок);
 *   — отсутствие «сырых» &, < и управляющих символов;
 *   — абсолютные http(s) URL без пробелов и не-ASCII;
 *   — корректные lastmod (ISO 8601, не в будущем);
 *   — дубликаты <loc>.
 * Выход с кодом 1, если найдены ошибки (удобно для CI).
 */

const DEFAULT_URL = process.env.SITEMAP_URL || 'https://weeb-x.com/sitemap.xml'
const target = process.argv[2] || DEFAULT_URL

const errors = []
const warnings = []
const fail = (m) => errors.push(m)
const warn = (m) => warnings.push(m)

function decodeEntities(xml) {
  return xml
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Минимальная проверка well-formedness: парность тегов + легальные entity. */
function checkWellFormed(xml) {
  const badEntity = xml.match(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9A-Fa-f]+);)/)
  if (badEntity) fail(`найден «сырой» & (не XML-entity) на позиции ${badEntity.index}`)

  const control = xml.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/)
  if (control) fail(`управляющий символ в XML на позиции ${control.index}`)

  const stack = []
  const tagRe = /<(\/?)([A-Za-z_][\w:.-]*)([^>]*?)(\/?)>|<\?[^>]*\?>|<!--[\s\S]*?-->/g
  let m
  while ((m = tagRe.exec(xml))) {
    if (m[0].startsWith('<?') || m[0].startsWith('<!--')) continue
    const [, closing, name, , selfClosing] = m
    if (selfClosing) continue
    if (closing) {
      const open = stack.pop()
      if (open !== name) fail(`нарушена вложенность: </${name}> закрывает <${open ?? 'ничего'}>`)
    } else {
      stack.push(name)
    }
  }
  if (stack.length) fail(`не закрыты теги: ${stack.join(', ')}`)
}

function parseEntries(xml) {
  const entries = []
  const urlRe = /<url>([\s\S]*?)<\/url>/g
  let m
  while ((m = urlRe.exec(xml))) {
    const block = m[1]
    const loc = block.match(/<loc>([\s\S]*?)<\/loc>/)
    const lastmod = block.match(/<lastmod>([\s\S]*?)<\/lastmod>/)
    const images = [...block.matchAll(/<image:loc>([\s\S]*?)<\/image:loc>/g)].map((i) => i[1])
    const line = xml.slice(0, m.index).split('\n').length
    entries.push({
      line,
      loc: loc ? decodeEntities(loc[1].trim()) : null,
      lastmod: lastmod ? lastmod[1].trim() : null,
      images: images.map((i) => decodeEntities(i.trim())),
    })
  }
  return entries
}

function checkUrl(url, where, line) {
  if (!url) return fail(`строка ${line}: пустой ${where}`)
  if (!/^https?:\/\//i.test(url)) fail(`строка ${line}: ${where} не абсолютный URL: ${url}`)
  if (!/^[\x20-\x7E]+$/.test(url)) fail(`строка ${line}: ${where} содержит не-ASCII: ${url}`)
  if (/[\s"'<>\\]/.test(url)) fail(`строка ${line}: ${where} содержит пробел/кавычку/бэкслеш: ${url}`)
  if (/%(?![0-9A-Fa-f]{2})/.test(url)) fail(`строка ${line}: ${where} битый %-escape: ${url}`)
  if (url.length > 1024) fail(`строка ${line}: ${where} длиннее 1024 символов`)
}

const response = await fetch(target, { redirect: 'follow', headers: { 'user-agent': 'sitemap-check/1.0' } })
const contentType = response.headers.get('content-type') || ''
if (!response.ok) fail(`HTTP ${response.status} ${response.statusText}`)
if (!/xml/i.test(contentType)) warn(`Content-Type не XML: ${contentType}`)
const xml = await response.text()

checkWellFormed(xml)
const entries = parseEntries(xml)

const seen = new Map()
const now = Date.now()
let withImages = 0
for (const entry of entries) {
  checkUrl(entry.loc, 'loc', entry.line)
  if (entry.loc) {
    if (seen.has(entry.loc)) warn(`дубликат <loc> на строке ${entry.line}: ${entry.loc} (первый — строка ${seen.get(entry.loc)})`)
    else seen.set(entry.loc, entry.line)
  }
  if (!entry.lastmod) {
    warn(`строка ${entry.line}: нет <lastmod>`)
  } else {
    if (!/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/.test(entry.lastmod))
      fail(`строка ${entry.line}: некорректный lastmod: ${entry.lastmod}`)
    else if (Date.parse(entry.lastmod) > now)
      fail(`строка ${entry.line}: lastmod в будущем: ${entry.lastmod}`)
  }
  for (const image of entry.images) checkUrl(image, 'image:loc', entry.line)
  if (entry.images.length) withImages++
}

console.log(`Проверен ${target}`)
console.log(`  размер: ${xml.length} байт, строк: ${xml.split('\n').length}`)
console.log(`  <url>: ${entries.length}, из них с картинками: ${withImages}`)
for (const w of warnings) console.log(`  ⚠ ${w}`)
for (const e of errors) console.log(`  ✗ ${e}`)
console.log(errors.length ? `\nОшибок: ${errors.length}` : '\nОшибок не найдено')
process.exit(errors.length ? 1 : 0)
