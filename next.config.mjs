/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // pdfjs-dist canvas polyfill
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;

