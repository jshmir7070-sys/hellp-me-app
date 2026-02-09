const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.watchFolders = [__dirname];

config.resolver.blockList = [
  /\.cache\/.*/,
  /node_modules\/.*\/android\/.*/,
  /node_modules\/.*\/ios\/.*/,
  /\.git\/.*/,
];

config.watcher = {
  ...config.watcher,
  additionalExts: ['cjs', 'mjs'],
  healthCheck: {
    enabled: true,
    timeout: 60000, // 60 seconds for Windows
    interval: 10000,
  },
  watchman: {
    deferStates: ['hg.update'],
  },
};

// Windows optimization: reduce file system load
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return middleware;
  },
};

// Increase timeout for Windows file system
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    compress: {
      drop_console: false,
    },
  },
};

module.exports = config;
