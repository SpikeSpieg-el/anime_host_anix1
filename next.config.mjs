// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true, // Это решает проблему с 127.0.0.1
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Разрешаем всё
      },
    ],
  },
  experimental: {
    allowedDevOrigins: ['192.168.0.16']
  }
};

export default nextConfig;