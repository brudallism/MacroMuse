const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add path mapping for @facades and other custom paths
config.resolver.alias = {
  '@app': path.resolve(__dirname, 'app/app'),
  '@ui': path.resolve(__dirname, 'app/ui'),
  '@domain': path.resolve(__dirname, 'app/domain'),
  '@infra': path.resolve(__dirname, 'app/infra'),
  '@data': path.resolve(__dirname, 'app/data'),
  '@state': path.resolve(__dirname, 'app/state'),
  '@lib': path.resolve(__dirname, 'app/lib'),
  '@tests': path.resolve(__dirname, 'app/tests'),
  '@facades': path.resolve(__dirname, 'app/facades'),
};

module.exports = config;