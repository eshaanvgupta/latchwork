/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_STATIC_PREVIEW: process.env.GITHUB_PAGES === 'true' ? 'true' : 'false' },
  ...(process.env.GITHUB_PAGES === 'true' ? {
    output: 'export',
    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '/latchwork',
    trailingSlash: true,
    images: { unoptimized: true },
  } : {}),
  transpilePackages: [
    '@latchwork/shared',
    '@latchwork/circuit-compiler',
    '@latchwork/tapeout-adapter',
    '@latchwork/contracts',
    '@latchwork/sdk'
  ],
};

export default nextConfig;

