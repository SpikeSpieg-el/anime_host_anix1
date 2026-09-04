/** @type {import('next').NextConfig} */
const nextConfig = {
  staticPageGenerationTimeout: 300,
  poweredByHeader: false,
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
            key: 'Referrer-Policy',
            value: 'no-referrer'
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://assets.vercel.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https: http:",
              "font-src 'self' data:",
              "connect-src 'self' https: http: wss:",
              "frame-src 'self' https: http:",
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