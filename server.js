const express = require('express');
const path = require('path');
const os = require('os');
const http = require('http');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);

server.listen(PORT, '0.0.0.0', () => {
  const interfaces = os.networkInterfaces();
  const networkAddrs = [];
  for (const [name, ifaceList] of Object.entries(interfaces)) {
    for (const iface of ifaceList) {
      if (iface.family === 'IPv4' && !iface.internal) {
        networkAddrs.push({ name, address: iface.address });
      }
    }
  }

  console.log(`\n  Measurement Master is running!\n`);
  console.log(`  Local:   http://localhost:${PORT}`);
  networkAddrs.forEach(({ name, address }) => {
    console.log(`  Network: http://${address}:${PORT}  (${name})`);
  });
  console.log(`\n  Your son can connect via WiFi using one of the Network URLs above.\n`);
});
