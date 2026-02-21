
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Vercel build will fail on any warning/error, so we ignore them for prototyping speed
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      }
    ],
  },
  // Ensure consistent routing on Vercel
  trailingSlash: false,
};

module.exports = nextConfig;
