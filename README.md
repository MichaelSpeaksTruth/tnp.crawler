# Universal Training and Placement (T&P) Monitoring Engine

An open-source, automated recruitment tracking and real-time notification engine designed for university placement portals. The system autonomously monitors institutional portals, validates student eligibility criteria, discards expired listings, and broadcasts instant push alerts to mobile devices with zero external database dependencies.

---

## 1. Abstract and Purpose

University Training and Placement (T&P) portals frequently publish high-priority application windows, online assessment (OA) links, and interview schedules with minimal advance notice. Students face operational challenges in monitoring these portals continuously due to:

- Short application windows (frequently closing within 2 to 4 hours of posting).
- High volume of irrelevant postings (drives targeted at non-eligible batches, unpermitted degree branches, or completed academic sessions).
- Absence of native push notification infrastructure on institutional web platforms.

This project provides a universal, serverless monitoring engine that acts as a continuous background sentinel. It simulates secure student sessions, analyzes newly posted drives, filters for user-specific graduation batches and internship classifications, and delivers instant, high-priority notifications to mobile devices.

---

## 2. Core Architectural Principles

```text
+-----------------------------------------------------------------------------------+
|                           SCHEDULING LAYER (Zero Server)                          |
|         GitHub Actions Cron (Every 3 Hours: 06:00 AM to 12:00 Midnight IST)       |
|                 [Off-Hours: 12:00 Midnight to 06:00 AM IST Disabled]              |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                        SESSION AND EXTRACTION SUBSYSTEM                           |
|   - HTTP Session Management (Cookie Jar Support via tough-cookie)                 |
|   - CodeIgniter / Apache Redirect & Refresh Header Resolution                     |
|   - Server-Side HTML DOM Parsing (cheerio)                                        |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                        INTELLIGENT FILTERING PIPELINE                             |
|   - Active Deadline Verification: Discards all expired listings (DD/MM/YYYY)     |
|   - Batch Eligibility Validator: Checks JAF session codes & graduation batch     |
|   - Role Classifier: Categorizes into 2M, 3M, 6M Internships and Full-Time (FTE) |
|   - Institutional Eligibility Cross-Check: Reads portal eligibility modals        |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                        DEDUPLICATION AND STATE STORAGE                            |
|   - Single-file State Ledger: seen_jobs.json (Tracked via automated Git commits)  |
|   - Historical Drive Seeding: Eliminates duplicate notifications across cycles   |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                        DISPATCH AND ALERTING SUBSYSTEM                            |
|   - ntfy.sh Protocol: Priority 5 (Maximum Urgency) Heads-Up Push Notification    |
|   - Interactive Actions: One-click portal redirection from device lock screen     |
|   - Optional Email Relay: Automatic forwarding to personal inbox                  |
+-----------------------------------------------------------------------------------+
```

### 2.1. Zero Database Infrastructure
Traditional scrapers require external database instances (PostgreSQL, MySQL, Redis) to record seen state. This engine utilizes an atomic, file-based ledger (`seen_jobs.json`). In scheduled cloud execution (GitHub Actions), state changes are committed and pushed back to the private repository automatically, ensuring zero hosting cost and zero database maintenance.

### 2.2. Lightweight Session Emulation
Rather than spinning up resource-intensive headless browser runtimes (such as Chromium or Puppeteer, which consume 400 MB to 1 GB RAM and frequently crash on container free tiers), the engine performs pure HTTP session emulation with automated cookie persistence. A complete inspection cycle executes in under 3 seconds using less than 30 MB of system memory.

### 2.3. Universal Portal Compatibility
While configured out of the box for Sankalp Infotech (SIIPL) placement ERP systems (e.g., BIT Mesra at `tp.bitmesra.co.in`), the parser follows a modular pattern that can be extended to other university placement platforms (such as Superset or custom college portals) by implementing standard extraction interfaces.

---

## 3. Classification and Filtering Logic

### 3.1. Role Classification
Opportunities are classified using strict string pattern matching:

- **2M (Two-Month Internship)**: Summer Internship Programmes (SIP), 8-week engagements, summer placements.
- **3M (Three-Month Internship)**: Specialized intermediate internship drives.
- **6M (Six-Month Internship)**: Spring or final-semester industrial training drives.
- **FTE (Full-Time Employment)**: Direct graduate recruitment, Graduate Engineer Trainees (GET), campus placements.

### 3.2. Batch and Graduation Year Verification
To prevent junior students from receiving notifications for graduating batches:
- The engine checks Job Announcement Form (JAF) session identifiers. For example, `JAF-BITM2627` identifies the 2026-2027 graduating batch, whereas `JAF-BITM2728` identifies the 2027-2028 graduating batch.
- 6M and FTE drives targeted strictly at final-year batches are excluded for junior students unless the job description explicitly designates their graduating year.
- 2M drives targeted at pre-final year students (SIP) are prioritized.

### 3.3. Deadline Validation
Deadlines in the format `DD/MM/YYYY` are parsed into UTC timestamps and compared against current system time. Expired drives are automatically archived in `seen_jobs.json` as skipped, guaranteeing that only active opportunities trigger alerts.

---

## 4. Setup and Installation

### 4.1. Mobile Application Configuration (ntfy)
1. Install the **ntfy** application:
   - Android: Available via Google Play and F-Droid.
   - iOS: Available via Apple App Store.
2. Open the application, tap **+ (Subscribe to topic)**.
3. Choose a private, high-entropy topic name (e.g., `bit-placement-student-9821`).
4. In device settings:
   - Enable notifications for ntfy.
   - Permit lock-screen banners and sound.
   - Set battery management to **Unrestricted** to prevent the operating system from terminating background sync.

### 4.2. Cloud Execution Setup (GitHub Actions)

This is the recommended deployment method. It requires zero servers and costs zero dollars.

#### Step 1: Create a Private GitHub Repository
1. Navigate to [github.com/new](https://github.com/new).
2. Set the repository visibility to **Private** to ensure your credentials and state ledger remain strictly confidential.
3. Push this codebase to your repository:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```

#### Step 2: Configure Encrypted Secrets
In your GitHub repository, navigate to **Settings > Secrets and variables > Actions**, and click **New repository secret**. Add the following four variables:

| Secret Name | Description | Example |
| :--- | :--- | :--- |
| `LOGIN_ID` | Student Portal Login Identifier | `TPBIT-BTECH1017324` |
| `PASSWORD` | Student Portal Account Password | `your_portal_password` |
| `GRADUATION_YEAR` | Student Graduation Year | `2028` |
| `NTFY_TOPIC` | Subscribed private ntfy channel identifier | `bit-placement-student-9821` |

#### Step 3: Verify Automated Workflow
- Under the **Actions** tab of your repository, select **BIT Mesra Placement Monitor**.
- Click **Run workflow** to initiate a manual verification cycle.
- The runner will checkout the repository, execute the crawl cycle, notify your phone if active eligible jobs exist, and commit any state updates back to `seen_jobs.json`.

---

## 5. Execution Schedules and Quota Consumption

### 5.1. Active vs. Inactive Hours
The workflow is configured to execute strictly during campus active hours to conserve runner minutes:

- **Active Hours**: 06:00 AM to 12:00 Midnight Indian Standard Time (IST).
- **Execution Interval**: Every 3 hours.
- **Off-Hours Inactivity**: 12:00 Midnight to 06:00 AM IST. Zero executions occur during this period, and zero runner minutes are billed.

### 5.2. Monthly Quota Utilization
- Total executions per day: 7 runs.
- Execution duration: ~20 seconds per run (billed as 1 minute).
- Daily quota usage: 7 minutes / day.
- Monthly quota usage: ~210 minutes / month.
- GitHub Free Allowance: 2,000 minutes / month.
- **Resource Utilization**: ~10.5% of free allocation.

---

## 6. Local Daemon and Webhook Execution

For users operating a local server, Raspberry Pi, or continuous container:

### 6.1. Environment Configuration
Create a local `.env` file based on `.env.example`:

```env
PORTAL_URL=https://tp.bitmesra.co.in
LOGIN_ID=your_roll_number
PASSWORD=your_password
GRADUATION_YEAR=2028
WATCH_ROLES=2M,3M,6M,FTE
NTFY_TOPIC=bit-placement-student-9821
CHECK_INTERVAL_MINUTES=10
```

### 6.2. CLI Commands
```bash
# Install dependencies
npm ci

# Execute a one-time crawl cycle
npm run check-now

# Start the continuous background server (HTTP server + automated timer)
npm start
```

### 6.3. Health and Webhook Endpoints
When running `npm start`, the internal HTTP service exposes:
- `GET /`: Returns service health, uptime, and count of tracked opportunities.
- `GET /api/check`: Triggers an immediate scraping cycle. Ideal for integration with external monitoring systems (e.g., UptimeRobot).

---

## 7. Extending for Other Institutional Portals

To adapt this framework for another university placement portal:

1. Create a portal driver in `adapters/<institution_name>.js`.
2. Implement the standard driver interface:
   - `login(client, credentials)`: Manages cookie/token authentication.
   - `getStudentProfile(client)`: Retrieves batch, department, and eligible companies.
   - `getJobFeed(client)`: Parses the recruitment drive table.
   - `getJobDetails(client, jobUrl)`: Extracts designation, CTC/stipend, deadlines, and criteria.
3. Import the adapter into `crawler.js`.

---

## 8. Security and Compliance

- **No Credential Exposure**: Credentials are never hardcoded or committed to git. They are managed exclusively through environment variables or GitHub encrypted secrets.
- **Respectful Crawling**: The engine executes with controlled intervals (3 hours in production, 10 minutes in local mode) and completes its inspection in under 3 seconds, generating negligible load on institutional infrastructure.
- **Sanitized State Storage**: `seen_jobs.json` records only public identifiers, company titles, and review timestamps. No personal student records or passwords are saved to disk.

---

## 9. Governance and License

This project is licensed under the **Apache License, Version 2.0**. See the [LICENSE](LICENSE) file for terms and conditions.

Contributions, bug reports, and portal adapter submissions are welcome. Please consult [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md) for contribution guidelines and security disclosure policies.
