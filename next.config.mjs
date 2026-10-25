/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build standalone: ideal para deploy em VPS (Hostinger) com PM2.
  // Na Vercel o `standalone` nao e usado (a plataforma monta as funcoes
  // serverless a partir do build padrao), entao so aplicamos fora dela.
  output: process.env.VERCEL ? undefined : "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // O driver do Neon e o pacote `ws` nao devem ser empacotados pelo webpack:
  // carregamos direto do node_modules em runtime (evita erros de bundling do
  // `ws` e de modulos nativos opcionais).
  serverExternalPackages: [
    "@prisma/adapter-neon",
    "@neondatabase/serverless",
    "@aws-sdk/client-s3",
    "ws",
  ],
  experimental: {
    // Mantem a API enxuta em ambientes serverless/VPS.
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
