const nextConfig = {
  webpack: (config) => {
    config.ignoreWarnings = config.ignoreWarnings || [];
    config.ignoreWarnings.push((warning) => {
      const msg = typeof warning?.message === 'string' ? warning.message : '';
      const resource = warning?.module && (warning.module.resource || '');
      return /Critical dependency: require function/.test(msg) && /@vladmandic[\\\/]face-api/.test(String(resource));
    });
    return config;
  },
};

module.exports = nextConfig;

