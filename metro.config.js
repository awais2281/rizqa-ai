const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add support for binary model files
config.resolver.assetExts.push('bin');

// Add support for @xenova/transformers (if needed)
config.resolver.sourceExts.push('wasm');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'wasm');

module.exports = config;

