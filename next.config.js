/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    // optimizeCss: true, // Desabilitado para depuração
    // optimizePackageImports: ['next', 'react', 'react-dom'], // Desabilitado para depuração
  },
  webpack: (config, { dev, isServer }) => {
    // Removida otimização de CSS para depuração de erros de carregamento
    // if (!dev && !isServer) {
    //   config.optimization.splitChunks.cacheGroups.styles = {
    //     name: 'styles',
    //     test: /\.(css|scss)$/,
    //     chunks: 'all',
    //     enforce: true,
    //     priority: 20,
    //   };
    // }
    return config;
  },
  
  // Image configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 's3.dev.amssergipe.com.br',
        port: '',
        pathname: '/general/**',
      },
      {
        protocol: 'https',
        hostname: 'suporte.amssergipe.com.br',
        port: '',
        pathname: '/**',
      },
    ],
  },

  // Force HTTPS in production
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; img-src 'self' https: data:; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https:;"
          }
        ]
      }
    ];
  },

  // HTTP to HTTPS redirect in production
  async redirects() {
    return process.env.NODE_ENV === 'production'
      ? [
          {
            source: '/:path*',
            has: [
              {
                type: 'header',
                key: 'x-forwarded-proto',
                value: 'http'
              }
            ],
            permanent: true,
            destination: 'https://:host/:path*'
          }
        ]
      : [];
  }
};

module.exports = nextConfig;
