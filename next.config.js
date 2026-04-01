/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pg', 'bcryptjs'],
  },
  // Disable image optimization for simpler deploys
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
