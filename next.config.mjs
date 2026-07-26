/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // jsdom's own dependency tree (html-encoding-sniffer -> @exodus/bytes, parse5) is now ESM-only,
  // which breaks if bundled into the server chunk. Keep it external so it's loaded via Node's own
  // require() from node_modules. NOTE: this alone isn't enough on Vercel — see NODE_OPTIONS in the
  // project's environment variables (--experimental-require-module) for the rest of the fix.
  serverExternalPackages: ['jsdom'],
}

export default nextConfig
