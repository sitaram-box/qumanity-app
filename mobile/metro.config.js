// Learn more: https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ../shared holds domain logic used by the app, Cloud Functions and tools.
config.watchFolders = [path.resolve(__dirname, '../shared')];

module.exports = config;
