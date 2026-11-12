# Security Policy

## 1. Supported Versions

Security updates and patches are applied to the active development branch (`main`).

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | Yes                |
| < 1.0   | No                 |

---

## 2. Reporting a Vulnerability

The project maintainers take credential safety and network security seriously. If you discover a security vulnerability, please do not open a public GitHub issue.

Instead, please report security issues privately:
- Contact repository maintainers via security advisory on GitHub: [Security Advisory](https://github.com/MichaelSpeaksTruth/tnp.crawler/security/advisories)
- Include detailed reproduction steps, network request payloads (with sanitized credentials), and affected components.

---

## 3. Credential Handling Guidelines

- Portal credentials (`LOGIN_ID`, `PASSWORD`) must never be hardcoded or checked into revision control.
- In production environments (such as GitHub Actions), all sensitive tokens must be injected via repository secrets.
- Notification topics should be treated as private identifiers and generated with high-entropy random strings to prevent eavesdropping on open notification streams.
