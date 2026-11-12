# BIT Mesra Placement Crawler and Alert Engine

An automated, serverless notification system designed to monitor the Birla Institute of Technology (BIT) Mesra Training and Placement portal (tp.bitmesra.co.in) and deliver immediate mobile alerts for eligible recruitment drives and department notices.

---

## 1. System Overview

The engine operates without external database infrastructure by leveraging lightweight state persistence and scheduled continuous integration pipelines. It monitors:

- Two-Month Summer Internships (SIP / 2M)
- Three-Month Internships (3M)
- Six-Month Internships (6M)
- Full-Time Employment (FTE)

The system automatically filters opportunities according to student graduation year and profile status, completely eliminating notifications for expired deadlines and ineligible batches.

---

## 2. Technical Architecture

The architecture consists of three integrated components:

### 2.1. Authentication and Crawling Engine
- Implemented in Node.js using native HTTP sessions via `axios` and `tough-cookie`.
- Authenticates directly against the CodeIgniter portal endpoint (`POST /auth/login.html`) and tracks HTTP refresh headers.
- Parses server-rendered HTML tables and modal bodies using `cheerio`.
- Memory footprint is under 30 MB with sub-3-second execution time.

### 2.2. Eligibility and Deadline Verification Pipeline
- **Company Eligibility Verification**: Cross-references opportunities with the portal's dynamic `#eligibleModal` listing.
- **Deadline Validation**: Parses deadline dates (`DD/MM/YYYY`) and discards expired drives.
- **Batch Matching**: Checks Job Announcement Form (JAF) session codes (e.g., JAF-BITM2728 for the 2028 batch) and role requirements to guarantee only relevant opportunities trigger alerts.

### 2.3. State Deduplication
- Stores evaluated opportunities in `seen_jobs.json`.
- Pre-seeds historical drives so users receive alerts strictly for newly published opportunities.
- Prevents duplicate alerts across scheduled runs.

### 2.4. Real-Time Push Dispatcher
- Dispatches push notifications directly to the user's mobile device via `ntfy.sh`.
- Requires zero authentication or account registration.
- Configured with urgent priority flags and direct action links to open the placement portal upon interaction.

---

## 3. Scheduled Cloud Execution (GitHub Actions)

The crawler is orchestrated via GitHub Actions with zero hosting costs and zero server maintenance.

### 3.1. Schedule and Quota Consumption
- **Execution Frequency**: Every 3 hours during active hours (06:00 AM to 12:00 Midnight IST).
- **Off-Hours Inactivity**: Between 12:00 Midnight and 06:00 AM IST, no jobs run and zero minutes are billed.
- **Resource Usage**: 7 runs per day at approximately 20 seconds per run consume ~210 minutes per month against the 2,000 free monthly minutes provided by GitHub.

### 3.2. UTC Cron Mapping
```text
Cron Expression: 30 0,3,6,9,12,15,18 * * *

Active Indian Standard Time (IST) Runs:
- 06:00 AM IST (00:30 UTC)
- 09:00 AM IST (03:30 UTC)
- 12:00 PM IST (06:30 UTC)
- 03:00 PM IST (09:30 UTC)
- 06:00 PM IST (12:30 UTC)
- 09:00 PM IST (15:30 UTC)
- 12:00 AM IST (18:30 UTC)
```

---

## 4. Setup and Deployment

### 4.1. Mobile Application Setup
1. Install the `ntfy` client on your mobile device (available on Google Play and Apple App Store).
2. Tap `+` (Subscribe to topic).
3. Enter your private topic identifier (e.g., `bit-placement-anurag-9281`).

### 4.2. Repository Secrets Configuration
To enable the GitHub Actions runner to authenticate securely, add the following secrets in your repository settings under **Settings > Secrets and variables > Actions**:

| Secret Name | Description | Example Value |
| :--- | :--- | :--- |
| `LOGIN_ID` | Portal Student Roll Number / Login ID | `TPBIT-BTECH1017324` |
| `PASSWORD` | Portal Account Password | `your_password` |
| `GRADUATION_YEAR` | Target Graduation Year | `2028` |
| `WATCH_ROLES` | Comma-separated list of monitored role types | `2M,3M,6M,FTE` |
| `NTFY_TOPIC` | Subscribed private ntfy channel identifier | `bit-placement-anurag-9281` |

---

## 5. Local Execution and Testing

To execute a manual check locally:

```bash
# Install dependencies
npm ci

# Execute a one-time crawl cycle
npm run check-now

# Run as a continuous background daemon (10-minute interval)
npm start
```

---

## 6. Security Considerations

- Credentials are never hardcoded in source control.
- Local configuration is maintained exclusively within `.env`, which is strictly ignored by `.gitignore`.
- State tracking records only public job identifiers, company names, and review timestamps.
