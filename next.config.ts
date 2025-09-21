import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {} as any;
    (config.resolve as any).fallback = {
      ...((config.resolve as any).fallback || {}),
      fs: false,
      path: false,
      crypto: false,
    };

    // Evita que o server bundle toque no face-api (s cliente)
    if (isServer) {
      const externals = (config as any).externals || [];
      (config as any).externals = [...externals, ({ request }: any, cb: any) => {
        if (request && request.includes('@vladmandic/face-api')) return cb(null, 'commonjs ' + request);
        cb();
      }];
    }

    // Silencia o aviso "Critical dependency" do face-api
    (config as any).ignoreWarnings = [
      ...((config as any).ignoreWarnings || []),
      (warning: any) =>
        typeof warning?.message === 'string' &&
        warning.message.includes('require function is used in a way in which dependencies cannot be statically extracted') &&
        (
          (typeof warning?.file === 'string' && warning.file.includes('@vladmandic/face-api')) ||
          (warning?.module && typeof warning.module.resource === 'string' && warning.module.resource.includes('@vladmandic/face-api'))
        ),
    ];

    // Reforbo: filtra via stats tambm
    (config as any).stats = {
      ...((config as any).stats || {}),
      warningsFilter: [
        /@vladmandic[\\/]+face-api[\\/]+dist[\\/]+face-api\.esm\.js.*require function is used in a way in which dependencies cannot be statically extracted/,
      ],
    };

    // Desativa o flag "critical" apenas para o arquivo do face-api
    (config as any).module = (config as any).module || {};
    (config as any).module.rules = [
      ...((config as any).module.rules || []),
      {
        test: /@vladmandic[\\\/]face-api[\\\/]dist[\\\/]face-api\.esm\.js$/,
        parser: { javascript: { exprContextCritical: false, unknownContextCritical: false } },
      },
    ];

    // Reduz ruso geral de infra warnings no dev
    (config as any).infrastructureLogging = { level: 'error' };

    return config;
  },
};

export default nextConfig;
