const { getDefaultConfig } = require('expo/metro-config');

// CSS-Unterstützung fürs Web (maplibre-gl bringt eigenes Stylesheet mit)
const config = getDefaultConfig(__dirname, { isCSSEnabled: true });

module.exports = config;
