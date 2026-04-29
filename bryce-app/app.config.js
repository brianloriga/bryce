// app.config.js — dynamic Expo config that extends app.json.
// Injects LOG_HOST from the environment so devLogger can find the log server
// without hardcoding an IP address in source code.
//
// Usage (set in your terminal before starting Expo, or add to .env):
//   LOG_HOST=192.168.1.42 npx expo start --tunnel

const baseConfig = require('./app.json');

module.exports = {
  ...baseConfig.expo,
  extra: {
    ...(baseConfig.expo.extra ?? {}),
    // Set to your LAN IP when running the log server (node bryce-app/logs/log-server.js)
    logHost: process.env.LOG_HOST ?? null,
  },
};
