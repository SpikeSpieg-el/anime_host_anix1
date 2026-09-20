#!/usr/bin/env node

/**
 * Скрипт для автоматической загрузки шрифтов Unbounded, Inter / Geist, JetBrains Mono
 * Использование: node scripts/download-fonts.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Папка для шрифтов (public/fonts)
const fontsDir = path.join(__dirname, '..', 'public', 'fonts');

// User-Agent, позволяющий получить от Google Fonts цельный .woff2 файл со всеми символами (включая кириллицу)
const USER_AGENT = 'Mozilla/5.0 (Windows NT 6.3; rv:39.0) Gecko/20100101 Firefox/39.0';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Создана папка: ${dir}`);
  }
}

/**
 * Выполняет GET-запрос и возвращает тело ответа в виде текста (с поддержкой редиректов)
 */
function fetchText(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const nextUrl = new URL(res.headers.location, url).href;
        return fetchText(nextUrl).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Ошибка HTTP ${res.statusCode} при запросе ${url}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
  });
}

/**
 * Скачивает файл по ссылке в указанное место (с поддержкой редиректов)
 */
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { headers: { 'User-Agent': USER_AGENT } }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const nextUrl = new URL(response.headers.location, url).href;
        downloadFile(nextUrl, dest).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} при загрузке: ${url}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          console.log(`  ✅ Загружен: ${path.basename(dest)}`);
          resolve();
        });
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    });

    req.on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

/**
 * Скачивает шрифт из Google Fonts через генерацию CSS и парсинг прямых woff2 URL
 */
async function downloadFromGoogleFonts(family, weightsMap, targetDir) {
  const weights = Object.keys(weightsMap).join(';');
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weights}`;
  
  const css = await fetchText(cssUrl);

  const blockRegex = /@font-face\s*\{([^}]+)\}/g;
  const foundUrls = {};
  let match;

  while ((match = blockRegex.exec(css)) !== null) {
    const block = match[1];
    const weightMatch = block.match(/font-weight:\s*(\d+)/);
    const srcMatch = block.match(/url\((https:\/\/[^)]+?\.woff2)\)/);

    if (weightMatch && srcMatch) {
      const weight = weightMatch[1];
      if (weightsMap[weight] && !foundUrls[weight]) {
        foundUrls[weight] = srcMatch[1];
      }
    }
  }

  for (const [weight, fileName] of Object.entries(weightsMap)) {
    const url = foundUrls[weight];
    if (!url) {
      throw new Error(`Не найден URL для начертания ${weight} шрифта ${family}`);
    }
    const dest = path.join(targetDir, fileName);
    await downloadFile(url, dest);
  }
}

/**
 * Загрузка шрифта Unbounded
 */
async function downloadUnboundedFonts() {
  console.log('\n🎭 Загрузка Unbounded...');
  const unboundedDir = path.join(fontsDir, 'unbounded');
  ensureDir(unboundedDir);

  const weights = {
    '400': 'Unbounded-Regular.woff2',
    '500': 'Unbounded-Medium.woff2',
    '700': 'Unbounded-Bold.woff2',
  };

  await downloadFromGoogleFonts('Unbounded', weights, unboundedDir);
}

/**
 * Загрузка шрифта Inter (альтернатива Geist)
 */
async function downloadInterFonts() {
  console.log('\n🎨 Загрузка Inter...');
  const interDir = path.join(fontsDir, 'inter');
  ensureDir(interDir);

  // Прямые официальные CDN-ссылки автора Inter (Rasmus Andersson) со всеми глифами
  const directUrls = {
    'Inter-Regular.woff2': 'https://rsms.me/inter/font-files/Inter-Regular.woff2',
    'Inter-Medium.woff2': 'https://rsms.me/inter/font-files/Inter-Medium.woff2',
    'Inter-Bold.woff2': 'https://rsms.me/inter/font-files/Inter-Bold.woff2',
  };

  try {
    for (const [fileName, url] of Object.entries(directUrls)) {
      await downloadFile(url, path.join(interDir, fileName));
    }
  } catch (err) {
    console.warn(`  ⚠️ Ошибка прямого CDN, переключаемся на Google Fonts API... (${err.message})`);
    await downloadFromGoogleFonts('Inter', {
      '400': 'Inter-Regular.woff2',
      '500': 'Inter-Medium.woff2',
      '700': 'Inter-Bold.woff2',
    }, interDir);
  }
}

/**
 * Загрузка шрифта JetBrains Mono (альтернатива Geist Mono)
 */
async function downloadJetBrainsMonoFonts() {
  console.log('\n💻 Загрузка JetBrains Mono...');
  const monoDir = path.join(fontsDir, 'jetbrains-mono');
  ensureDir(monoDir);

  // Официальный репозиторий JetBrains
  const directUrls = {
    'JetBrainsMono-Regular.woff2': 'https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/fonts/webfonts/JetBrainsMono-Regular.woff2',
    'JetBrainsMono-Medium.woff2': 'https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/fonts/webfonts/JetBrainsMono-Medium.woff2',
    'JetBrainsMono-Bold.woff2': 'https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/fonts/webfonts/JetBrainsMono-Bold.woff2',
  };

  try {
    for (const [fileName, url] of Object.entries(directUrls)) {
      await downloadFile(url, path.join(monoDir, fileName));
    }
  } catch (err) {
    console.warn(`  ⚠️ Ошибка GitHub CDN, переключаемся на Google Fonts API... (${err.message})`);
    await downloadFromGoogleFonts('JetBrains Mono', {
      '400': 'JetBrainsMono-Regular.woff2',
      '500': 'JetBrainsMono-Medium.woff2',
      '700': 'JetBrainsMono-Bold.woff2',
    }, monoDir);
  }
}

/**
 * Загрузка оригинальных Geist Sans и Geist Mono (от Vercel)
 */
async function downloadGeistOriginalFonts() {
  console.log('\n⚡ Загрузка оригинальных Geist Sans и Geist Mono (Vercel CDN)...');
  
  const geistSansDir = path.join(fontsDir, 'geist-sans');
  const geistMonoDir = path.join(fontsDir, 'geist-mono');
  ensureDir(geistSansDir);
  ensureDir(geistMonoDir);

  const geistSansFiles = {
    'Geist-Regular.woff2': 'https://cdn.jsdelivr.net/npm/geist@1.5.1/dist/fonts/geist-sans/Geist-Regular.woff2',
    'Geist-Medium.woff2': 'https://cdn.jsdelivr.net/npm/geist@1.5.1/dist/fonts/geist-sans/Geist-Medium.woff2',
    'Geist-Bold.woff2': 'https://cdn.jsdelivr.net/npm/geist@1.5.1/dist/fonts/geist-sans/Geist-Bold.woff2',
  };

  const geistMonoFiles = {
    'GeistMono-Regular.woff2': 'https://cdn.jsdelivr.net/npm/geist@1.5.1/dist/fonts/geist-mono/GeistMono-Regular.woff2',
    'GeistMono-Medium.woff2': 'https://cdn.jsdelivr.net/npm/geist@1.5.1/dist/fonts/geist-mono/GeistMono-Medium.woff2',
    'GeistMono-Bold.woff2': 'https://cdn.jsdelivr.net/npm/geist@1.5.1/dist/fonts/geist-mono/GeistMono-Bold.woff2',
  };

  for (const [name, url] of Object.entries(geistSansFiles)) {
    await downloadFile(url, path.join(geistSansDir, name));
  }
  for (const [name, url] of Object.entries(geistMonoFiles)) {
    await downloadFile(url, path.join(geistMonoDir, name));
  }
}

async function main() {
  console.log('🚀 Начинаем скачивание шрифтов в public/fonts/ ...');
  
  try {
    ensureDir(fontsDir);

    // 1. Unbounded
    await downloadUnboundedFonts();

    // 2. Inter (замена Geist)
    await downloadInterFonts();

    // 3. JetBrains Mono (замена Geist Mono)
    await downloadJetBrainsMonoFonts();

    // 4. Оригинальные шрифты Geist (на случай, если проект настроен именно на них)
    await downloadGeistOriginalFonts();

    console.log('\n🎉 Все шрифты успешно скачаны!');
    console.log(`📂 Расположение: ${fontsDir}`);
  } catch (error) {
    console.error('\n❌ Ошибка при загрузке шрифтов:', error);
    process.exit(1);
  }
}

main();