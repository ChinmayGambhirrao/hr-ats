import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['unpdf', 'mammoth'],
  turbopack: {},
}

export default nextConfig