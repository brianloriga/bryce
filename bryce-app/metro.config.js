const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle 3D model files
config.resolver.assetExts.push('glb', 'gltf', 'bin', 'hdr');

module.exports = config;
