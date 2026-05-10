import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['unpdf', 'mammoth', '@xenova/transformers'],
  turbopack: {},
}

export default nextConfig