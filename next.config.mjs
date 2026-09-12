/** @type {import('next').NextConfig} */
// Umami (self-hosted analytics in Coolify): the browser fetches the tracker
// (<umami>/script.js) and posts events to the same origin (/api/send). The
// default host matches DEFAULT_UMAMI_ORIGIN in lib/analytics.ts, so setting
// only NEXT_PUBLIC_UMAMI_WEBSITE_ID is enough.
const UMAMI_ORIGIN = (() => {
  const DEFAULT_ORIGIN = 'https://analytics.weeb-x.com'
  const raw = process.env.NEXT_PUBLIC_UMAMI_URL
  if (!raw) return DEFAULT_ORIGIN
  try {
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(withScheme).origin
  } catch {
    return DEFAULT_ORIGIN
  }
})()

const PVP_SERVER_ORIGIN = (() => {
  const raw = process.env.NEXT_PUBLIC_PVP_SERVER_URL
  if (!raw) return ''
  try {
    const url = new URL(raw)
    // Add both https and wss for WebSocket connections
    return `${url.origin} wss://${url.host}`
  } catch {
    return ''
  }
})()

const nextConfig = {
  staticPageGenerationTimeout: 300,
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: '/stats/tracker.js',
        destination: 'https://analytics.weeb-x.com/script.js',
      },
      {
        source: '/stats/api/send',
        destination: 'https://analytics.weeb-x.com/api/send',
      },
    ];
  },
  images: {
    remotePatterns: [
      // Development uses direct external image URLs from many artwork providers.
      ...(process.env.NODE_ENV !== 'production'
        ? [
            {
              protocol: 'http',
              hostname: '**',
              pathname: '/**',
            },
            {
              protocol: 'https',
              hostname: '**',
              pathname: '/**',
            },
          ]
        : []),
      // 1. MyAnimeList
      {
        protocol: 'https',
        hostname: 'cdn.myanimelist.net',
        pathname: '/images/**',
      },
      // 2. Shikimori (Добавлены все возможные домены и поддомены)
      {
        protocol: 'https',
        hostname: 'shikimori.one',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'shikimori.io',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.shikimori.one',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.shikimori.io',
        pathname: '/**',
      },
      // 3. AniList
      {
        protocol: 'https',
        hostname: 's4.anilist.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.anilist.co',
        pathname: '/**',
      },
      // 4. Kitsu
      {
        protocol: 'https',
        hostname: 'media.kitsu.app',
        pathname: '/**',
      },
      // 5. Yande.re artwork used by the gacha collection
      {
        protocol: 'https',
        hostname: 'yande.re',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'files.yande.re',
        pathname: '/**',
      },
      // 6. Safebooru artwork used by the gacha collection
      {
        protocol: 'https',
        hostname: 'safebooru.org',
        pathname: '/**',
      },
    ],
    // Disable the default optimizer in dev so newly added external art hosts work
    // without requiring a config change for every source.
    unoptimized: process.env.NODE_ENV !== 'production',
    // Custom loader delegates to Coolify image service (bypasses Vercel transformations)
    ...(process.env.NODE_ENV === 'production' && {
      loader: 'custom',
      loaderFile: './lib/coolify-image-loader.js',
    }),
    qualities: [50, 60, 70, 80, 85],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            // strict-origin-when-cross-origin: Umami берёт referrer из
            // document.referrer, no-referrer обнулял бы отчёт «Источники».
            // Внешним сайтам уходит только origin, без полного URL.
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${UMAMI_ORIGIN}`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' data: https://fonts.gstatic.com",
              `connect-src 'self' https://*.supabase.co https://nhost.weebx.duckdns.org:8443 wss://nhost.weebx.duckdns.org:8443 ${UMAMI_ORIGIN} /stats https://shikimori.one https://shikimori.io https://*.shikimori.one https://*.shikimori.io ${PVP_SERVER_ORIGIN}`,
              "frame-src 'self' https: http:",
              // worker-src: hls.js (запасной плеер) создаёт Worker из blob:
              "worker-src 'self' blob:",
              "media-src 'self' https: http: blob:",
              "object-src 'none'",
              "base-uri 'self'",
            ].join('; ')
          },
        ],
      },
    ]
  }
};

export default nextConfig;