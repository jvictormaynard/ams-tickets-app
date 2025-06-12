/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  
  // Configuração de imagens
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

  // Forçar HTTPS em produção
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
            value: "default-src 'self'; img-src 'self' https: data:; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' https:; connect-src 'self' https:;"
          }
        ]
      }
    ];
  },

  // Redirecionamento HTTP para HTTPS em produção
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
