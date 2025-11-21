/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  basePath: '/han',
  trailingSlash: true,
};

module.exports = nextConfig;
