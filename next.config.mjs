// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Увеличиваем таймаут статической генерации, чтобы тяжёлый sitemap не падал на Vercel
  staticPageGenerationTimeout: 300,
  // Скрываем X-Powered-By: Next.js
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
    // Custom loader delegates to Coolify image service (bypasses Vercel transformations)
    // In dev, use default Next.js image optimization instead
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
              "connect-src 'self' https://*.supabase.co https://*.vercel.app https://*.analytics.vercel.com wss://*.vercel.app https://nhost.weebx.duckdns.org:8443 wss://nhost.weebx.duckdns.org:8443",
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