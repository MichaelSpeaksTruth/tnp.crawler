# Contributing to University T&P Crawler and Monitor

Thank you for your interest in contributing to the University Training and Placement (T&P) Monitoring Engine. This document outlines the policies, coding standards, and procedures required to submit contributions to this project.

---

## 1. Code of Conduct

All contributors and maintainers are expected to adhere to high standards of professional conduct. Interactions must remain respectful, constructive, and strictly focused on technical merits. Personal attacks, harassment, and discriminatory behavior will not be tolerated.

---

## 2. Design Principles

When submitting code or proposing architectural changes, adhere to the following principles:

1. **Zero Database Dependency**: The core engine must remain operational without external database servers (e.g., PostgreSQL, MongoDB, Redis). State persistence must be self-contained and file-based or serverless-compatible.
2. **Resource Efficiency**: Scrapers must execute within lightweight environments (e.g., GitHub Actions runners with strict execution limits). Avoid headless browser engines (Puppeteer, Playwright) unless dynamic JavaScript rendering is strictly mandatory and cannot be solved via HTTP session emulation.
3. **Pluggable Architecture**: Scrapers and parsers must be modularized to support adaptation to diverse university placement portals (e.g., Sankalp Infotech, Superset, custom institutional ERPs).
4. **Professionalism in Messaging**: Notifications and log messages must strictly avoid slang, emojis, or colloquial text. Keep all log statements and alert payloads formal, structured, and parseable.

---

## 3. Development Workflow

### 3.1. Prerequisites
- Node.js version 20.x or higher
- npm version 10.x or higher
- Git version 2.x or higher

### 3.2. Local Setup
1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/tnp.crawler.git
   cd tnp.crawler
   ```
3. Install project dependencies:
   ```bash
   npm ci
   ```
4. Copy the environment configuration template:
   ```bash
   cp .env.example .env
   ```
5. Populate `.env` with your institution's portal credentials and your private notification topic.

---

## 4. Submitting Pull Requests

### 4.1. Branch Naming Conventions
Create a feature or bugfix branch with a descriptive prefix:
- `feat/feature-name` (for new portal drivers, notification adapters, or features)
- `fix/issue-description` (for bug fixes or parser adjustments)
- `docs/topic-name` (for documentation updates)
- `refactor/subsystem-name` (for structural code improvements)

### 4.2. Commit Guidelines
Commit messages must follow the Conventional Commits specification:
- Format: `<type>(<scope>): <subject>`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`
- Provide a detailed explanation in the commit body explaining what was changed and why.
- Do not use emojis in commit messages.
- Do not use em-dashes in commit titles or descriptions.

### 4.3. Pull Request Checklist
Before submitting a Pull Request, verify:
- Code adheres to ES Module standards (`type: module`).
- No sensitive credentials or `.env` files are tracked by Git.
- Parsing logic contains proper error handling and fallback routines for network timeouts.
- State deduplication logic is verified to prevent repeat alert dispatches.
- The Pull Request description provides clear reproduction steps or test verification output.

---

## 5. Adding Support for New University Portals

To implement an adapter for another institution:
1. Identify the portal authentication scheme (Cookie session, Bearer Token, OAuth).
2. Create a dedicated parser module under `adapters/` implementing the standard crawler interface:
   - `authenticate(credentials)`
   - `fetchDashboard(session)`
   - `fetchListings(session)`
   - `parseJobDetails(jobUrl, session)`
3. Ensure the return object conforms to the standard opportunity schema:
   ```javascript
   {
     company: string,
     roleType: '2M' | '3M' | '6M' | 'FTE' | 'OTHER',
     designation: string,
     deadline: string,
     postedOn: string,
     ctc: string,
     link: string,
     graduationYear: string
   }
   ```
4. Submit your pull request with accompanying unit tests or sample fixtures.

---

## 6. License

By contributing to this project, you agree that your contributions will be licensed under the Apache License, Version 2.0.
