/**
 * Dev log receiver — run this in a separate terminal while developing:
 *
 *   node bryce-app/logs/log-server.js
 *
 * The app's devLogger POSTs structured scan logs to this server.
 * Each scan is written as a timestamped JSON file in bryce-app/logs/.
 *
 * To find your machine's IP (needed when the app is on the same Wi-Fi):
 *   Windows:  ipconfig  (look for IPv4 Address)
 *   Mac/Linux: ifconfig or ip route
 *
 * Set LOG_HOST in your .env or pass it as an env var:
 *   LOG_HOST=192.168.1.42 node bryce-app/logs/log-server.js
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT    = 9988;
const LOG_DIR = __dirname; // writes alongside this file in bryce-app/logs/

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const log = JSON.parse(body);
        const ts  = new Date(log.startedAt || Date.now())
          .toISOString()
          .replace(/T/, '_')
          .replace(/:/g, '-')
          .replace(/\.\d+Z$/, 'Z');
        const filename = `scan-${ts}.json`;
        fs.writeFileSync(path.join(LOG_DIR, filename), JSON.stringify(log, null, 2), 'utf8');
        console.log(`[log-server] ✅  ${filename}  (${(log.durationMs / 1000).toFixed(1)}s  ${log.result?.questionsGenerated ?? '?'} questions)`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        console.error('[log-server] ❌ parse error:', e.message);
        res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404); res.end();
});

server.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const ips = Object.values(networkInterfaces())
    .flat()
    .filter(n => n.family === 'IPv4' && !n.internal)
    .map(n => n.address);
  console.log(`[log-server] Listening on port ${PORT}`);
  console.log(`[log-server] Set LOG_HOST in the app to one of these IPs:`);
  ips.forEach(ip => console.log(`               ${ip}`));
  console.log(`[log-server] Waiting for scan logs…`);
});
