/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // jsdom pulls in an ESM-only dep (html-encoding-sniffer -> @exodus/bytes) that breaks when
  // bundled into the server chunk (ERR_REQUIRE_ESM on Vercel). Keep it external so Node's own
  // module resolution loads it from node_modules at runtime instead.
  serverExternalPackages: ['jsdom'],
}

export default nextConfig
