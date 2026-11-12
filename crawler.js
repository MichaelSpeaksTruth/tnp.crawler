import axios from 'axios';
import * as cheerio from 'cheerio';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const PORTAL_URL = (process.env.PORTAL_URL || 'https://tp.bitmesra.co.in').replace(/\/+$/, '');
const LOGIN_ID = process.env.LOGIN_ID;
const PASSWORD = process.env.PASSWORD;
const GRADUATION_YEAR = parseInt(process.env.GRADUATION_YEAR || '2028', 10);
const WATCH_ROLES = (process.env.WATCH_ROLES || '2M,3M,6M,FTE')
  .split(',')
  .map(r => r.trim().toUpperCase());
const NTFY_TOPIC = process.env.NTFY_TOPIC || 'bit-placement-anurag-9281';

const DATA_DIR = process.env.DATA_DIR || '.';
const SEEN_FILE = path.resolve(DATA_DIR, 'seen_jobs.json');

function loadSeenStore() {
  try {
    if (fs.existsSync(SEEN_FILE)) {
      return JSON.parse(fs.readFileSync(SEEN_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('[ERROR] Unable to read seen_jobs.json. Reinitializing store.', err.message);
  }
  return { jobs: {}, notices: {} };
}

function saveSeenJob(jobId, jobData) {
  const store = loadSeenStore();
  if (!store.jobs) store.jobs = {};
  store.jobs[jobId] = {
    recordedAt: new Date().toISOString(),
    ...jobData,
  };
  fs.writeFileSync(SEEN_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function saveSeenNotice(noticeId, noticeData) {
  const store = loadSeenStore();
  if (!store.notices) store.notices = {};
  store.notices[noticeId] = {
    recordedAt: new Date().toISOString(),
    ...noticeData,
  };
  fs.writeFileSync(SEEN_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

async function sendNtfyAlert({ title, message, url, priority = '5' }) {
  const ntfyUrl = `https://ntfy.sh/${NTFY_TOPIC}`;
  try {
    await axios.post(ntfyUrl, message, {
      headers: {
        'Title': title,
        'Priority': '5',
        'Click': url || PORTAL_URL,
        'Actions': `view, Open Portal, ${url || PORTAL_URL}`,
      },
    });
    console.log(`[NTFY] Notification delivered: "${title}"`);
  } catch (err) {
    console.error(`[NTFY] Delivery failed:`, err.message);
  }
}

// Parse DD/MM/YYYY into a comparable Date object
function parsePortalDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day, 23, 59, 59);
  }
  return null;
}

function detectRoleType(text) {
  const t = (text || '').toLowerCase();
  if (t.includes('two months') || t.includes('2 month') || t.includes('2m') || t.includes('sip') || t.includes('summer')) return '2M';
  if (t.includes('three months') || t.includes('3 month') || t.includes('3m')) return '3M';
  if (t.includes('six months') || t.includes('6 month') || t.includes('6m') || t.includes('spring')) return '6M';
  if (t.includes('full time') || t.includes('fte') || t.includes('placement')) return 'FTE';
  return 'OTHER';
}

// Strict batch verification: 2028 batch is currently in 2nd/3rd year, eligible for 2M summer internships
function isDriveStrictlyEligibleForBatch(roleType, pageText, formTitle, userGradYear) {
  const text = (formTitle + ' ' + pageText).toLowerCase();

  // 1. If user is graduating in 2028 (currently 2nd year):
  // 6M and FTE drives are strictly for graduating students (2026 / 2027 batches)
  if (userGradYear >= 2028) {
    if (roleType === '6M' || roleType === 'FTE') {
      // 6M and FTE are not for 2028 batch unless explicitly stated in JD
      if (!text.includes('2028') && !text.includes('2728')) {
        return false;
      }
    }
  }

  // 2. Check JAF session codes:
  // JAF-BITM2627 => Batch graduating 2026-2027
  // JAF-BITM2728 => Batch graduating 2027-2028
  const prevYrShort = (userGradYear - 1).toString().slice(-2);
  const userYrShort = userGradYear.toString().slice(-2);
  const sessionCode = `${prevYrShort}${userYrShort}`; // "2728" for 2028

  if (text.includes(sessionCode) || text.includes(userGradYear.toString())) {
    return true;
  }

  // If drive specifies 2M Summer Internship (SIP), 2nd/3rd year students are the target group
  if (roleType === '2M' && (text.includes('summer') || text.includes('internship'))) {
    return true;
  }

  return false;
}

export async function runScraper() {
  console.log(`\n======================================================`);
  console.log(`[${new Date().toLocaleTimeString()}] Running Placement Monitor Cycle`);
  console.log(`Graduation Batch: ${GRADUATION_YEAR} | Monitored Roles: ${WATCH_ROLES.join(', ')}`);
  console.log(`======================================================`);

  if (!LOGIN_ID || !PASSWORD) {
    console.error('[ERROR] Missing LOGIN_ID or PASSWORD in environment configuration.');
    return { success: false, error: 'Missing credentials' };
  }

  const jar = new CookieJar();
  const client = wrapper(
    axios.create({
      jar,
      withCredentials: true,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      maxRedirects: 10,
      timeout: 30000,
    })
  );

  try {
    await client.get(`${PORTAL_URL}/login.html`);

    const params = new URLSearchParams();
    params.append('identity', LOGIN_ID);
    params.append('password', PASSWORD);
    params.append('submit', 'Login');

    const authRes = await client.post(`${PORTAL_URL}/auth/login.html`, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': `${PORTAL_URL}/login.html`,
      },
    });

    const refreshHeader = authRes.headers['refresh'];
    let dashboardUrl = `${PORTAL_URL}/index.html`;
    if (refreshHeader) {
      const match = refreshHeader.match(/url=(.*)/i);
      if (match) dashboardUrl = match[1].trim();
    }

    console.log('[AUTH] Logged in. Fetching student dashboard...');
    const dashRes = await client.get(dashboardUrl);
    const $dash = cheerio.load(dashRes.data);

    // Extract student's pre-computed eligible companies from #eligibleModal
    const officiallyEligibleCompanies = [];
    $dash('#eligibleModal .modal-body ul li').each((_, el) => {
      const name = $dash(el).text().trim();
      if (name) officiallyEligibleCompanies.push(name.toLowerCase());
    });

    console.log(`[PROFILE] Portal verified companies (${officiallyEligibleCompanies.length}):`, officiallyEligibleCompanies);

    const store = loadSeenStore();
    const isFirstRun = Object.keys(store.jobs || {}).length === 0;

    // Check live notice board (Shortlists, OA, Interview schedules)
    $dash('table.newseventsx1 tbody tr, .newseventsx1 tr').each((_, tr) => {
      const text = $dash(tr).text().replace(/\s+/g, ' ').trim();
      const dateText = $dash(tr).find('td').last().text().trim();
      if (!text || text.startsWith('Notification Details')) return;

      const noticeId = Buffer.from(text.slice(0, 80)).toString('base64');
      if (!store.notices || !store.notices[noticeId]) {
        saveSeenNotice(noticeId, { text, date: dateText });
        // Only alert for notices if not the initial cold seed
        if (!isFirstRun) {
          sendNtfyAlert({
            title: 'BIT Placement Notice / Shortlist',
            message: notice.text,
            url: `${PORTAL_URL}/index.html`,
            priority: '5',
          });
        }
      }
    });

    console.log('[JOBS] Fetching active openings from /applyjobs.html...');
    const jobsRes = await client.get(`${PORTAL_URL}/applyjobs.html`);
    const $jobs = cheerio.load(jobsRes.data);

    const rows = $jobs('#job-listings tbody tr');
    console.log(`[JOBS] Total openings listed: ${rows.length}`);

    const now = new Date();
    const newEligibleJobs = [];

    for (let i = 0; i < rows.length; i++) {
      const tr = rows.eq(i);
      const company = tr.find('td').eq(0).text().trim();
      const deadlineStr = tr.find('td').eq(1).text().trim();
      const postedOn = tr.find('td').eq(2).text().trim();
      const relInfoLink = tr.find('a[href*="job/info"]').attr('href');

      if (!company || !relInfoLink) continue;

      const jobId = relInfoLink.split('/').pop();

      // Check if already processed
      if (store.jobs && store.jobs[jobId]) {
        continue;
      }

      // 1. DEADLINE FILTER: Skip if deadline has already passed
      const deadlineDate = parsePortalDate(deadlineStr);
      if (deadlineDate && deadlineDate < now) {
        // Record as seen expired job so we never re-evaluate it
        saveSeenJob(jobId, { company, deadline: deadlineStr, expired: true });
        continue;
      }

      const fullInfoUrl = relInfoLink.startsWith('http')
        ? relInfoLink
        : `${PORTAL_URL}/${relInfoLink.replace(/^\//, '')}`;

      let roleType = 'OTHER';
      let designation = '';
      let ctcOrStipend = '';
      let pageText = '';
      let pageTitle = '';

      try {
        const detailRes = await client.get(fullInfoUrl);
        const $detail = cheerio.load(detailRes.data);
        pageText = $detail('body').text().replace(/\s+/g, ' ');
        pageTitle = $detail('title').text().trim();

        roleType = detectRoleType(pageText);

        const desigMatch = pageText.match(/Job Designation\s*([^\n\r|]{2,50})/i);
        if (desigMatch) designation = desigMatch[1].trim();

        const ctcMatch = pageText.match(/(?:CTC|Stipend)\s*(?:Rs\.?)?\s*([0-9,]+(?:\s*(?:LPA|per month|\/mo))?)/i);
        if (ctcMatch) ctcOrStipend = ctcMatch[0].trim();
      } catch (e) {
        console.error(`[WARNING] Failed to fetch details for ${company}:`, e.message);
      }

      // 2. STRICT BATCH & ROLE ELIGIBILITY CHECK
      const isBatchEligible = isDriveStrictlyEligibleForBatch(roleType, pageText, pageTitle, GRADUATION_YEAR);
      const roleMatches = WATCH_ROLES.includes(roleType) || WATCH_ROLES.includes('ALL');

      if (isBatchEligible && roleMatches) {
        const jobData = {
          company,
          roleType,
          designation: designation || roleType,
          deadline: deadlineStr,
          postedOn,
          ctc: ctcOrStipend,
          link: fullInfoUrl,
          graduationYear: GRADUATION_YEAR,
        };

        console.log(`[MATCH] Active eligible opening: [${roleType}] ${company} (Deadline: ${deadlineStr})`);
        newEligibleJobs.push(jobData);
        saveSeenJob(jobId, jobData);

        await sendNtfyAlert({
          title: `Active ${roleType} Opening: ${company}`,
          message: [
            `Company: ${company}`,
            designation ? `Role: ${designation}` : null,
            `Type: ${roleType}`,
            ctcOrStipend ? `Compensation: ${ctcOrStipend}` : null,
            `Deadline: ${deadlineStr}`,
            `Eligible Batch: ${GRADUATION_YEAR}`,
          ].filter(Boolean).join('\n'),
          url: fullInfoUrl,
          priority: '5',
        });
      } else {
        saveSeenJob(jobId, { company, roleType, isBatchEligible, skipped: true });
      }
    }

    console.log(`[SUMMARY] Finished check. ${newEligibleJobs.length} active eligible openings notified.`);
    return { success: true, newEligibleCount: newEligibleJobs.length, eligibleJobs: newEligibleJobs };
  } catch (err) {
    console.error('[ERROR] Failure during scraper execution:', err.message);
    return { success: false, error: err.message };
  }
}

if (process.argv[1]?.endsWith('crawler.js')) {
  runScraper();
}
