// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Увеличиваем таймаут статической генерации, чтобы тяжёлый sitemap не падал на Vercel
  staticPageGenerationTimeout: 300,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
    // Custom loader delegates to Coolify image service (bypasses Vercel transformations)
    loader: 'custom',
    loaderFile: './lib/coolify-image-loader.js',
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
        ],
      },
    ]
  }
};

export default nextConfig;