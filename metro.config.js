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
};

module.exports = config;
