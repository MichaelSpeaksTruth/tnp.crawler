import http from 'http';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { runScraper } from './crawler.js';

dotenv.config();

const PORT = process.env.PORT || 3000;
const INTERVAL_MIN = parseInt(process.env.CHECK_INTERVAL_MINUTES || '10', 10);
const DATA_DIR = process.env.DATA_DIR || '.';
const SEEN_FILE = path.resolve(DATA_DIR, 'seen_jobs.json');

let lastRunTime = null;
let lastResult = null;
let isRunning = false;

async function triggerScraper() {
  if (isRunning) {
    console.log('[MONITOR] Previous scraping cycle is still in progress. Skipping.');
    return { status: 'already_running' };
  }

  isRunning = true;
  lastRunTime = new Date().toISOString();
  try {
    lastResult = await runScraper();
  } catch (err) {
    lastResult = { success: false, error: err.message };
  } finally {
    isRunning = false;
  }
  return lastResult;
}

// Background Timer for automated polling
console.log(`[SERVICE] Scheduled background execution interval: ${INTERVAL_MIN} minutes.`);
setInterval(triggerScraper, INTERVAL_MIN * 60 * 1000);

// Initial execution after startup
setTimeout(triggerScraper, 3000);

// HTTP Interface for health checks and external webhooks (e.g. UptimeRobot)
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/api/check') {
    console.log('[WEBHOOK] Inbound check trigger received at /api/check.');
    const result = await triggerScraper();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ triggered: true, timestamp: new Date().toISOString(), result }));
    return;
  }

  if (url.pathname === '/') {
    let seenCount = 0;
    try {
      if (fs.existsSync(SEEN_FILE)) {
        const store = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf-8'));
        seenCount = Object.keys(store.jobs || {}).length;
      }
    } catch (e) {}

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: 'BIT Mesra Placement Monitor',
      status: 'healthy',
      intervalMinutes: INTERVAL_MIN,
      lastRunTime,
      trackedOpportunitiesCount: seenCount,
      lastResult,
    }, null, 2));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Resource Not Found');
});

server.listen(PORT, () => {
  console.log(`[SERVICE] Server listening on port ${PORT}`);
  console.log(`[SERVICE] Webhook endpoint: http://localhost:${PORT}/api/check`);
});
