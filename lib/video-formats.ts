// --- START OF FILE lib/video-formats.ts ---
export async function checkVideoAvailability(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url, {
      method: 'GET', // Используем GET вместо HEAD, так как zap. может его блокировать
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "http://hentasis1.top/",
        "Range": "bytes=0-100" // Запрашиваем только кусочек
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    // 200, 206 или даже 403 (если файл есть, но защита сработала) считаем за успех
    return response.ok || response.status === 206 || response.status === 403;
  } catch (error) {
    clearTimeout(timeoutId);
    return false;
  }
}