# Marked Solutions — Contract workspace

A private Netlify application for SAM.gov opportunity screening and solicitation review. The existing marked.solutions GitHub Pages homepage and CNAME remain unchanged. The new app is contained in `contracts/`.

## Features

- Invite-only Netlify Identity login, with a server-side verified-email allowlist.
- SAM.gov public API import using configurable title search phrases, with pagination and explicit partial-scan warnings.
- Notice descriptions, source revisions, and saved decision tracking in site-scoped Netlify Blobs.
- AI bid/no-bid screening against an editable company profile, with exact-quote evidence checks.
- Manual PDF/text upload, PDF page markers, source inspection, and pipeline decisions with notes.
- Daily scan at 12:00 UTC, disabled until enabled in the company profile.
- Explicit example workspace at `/?demo=1`. The example is fictional, client-only, and cannot access private data.

## Deploy this branch to the existing Netlify project

Project: `marked-contracts`
Site ID: `afaaa233-130f-49a8-b6da-4a149a6d39d6`

Use Node 22 or later.

```sh
cd contracts
npm ci
npm run check
npm test
npm run build
npx netlify login
npx netlify link --id afaaa233-130f-49a8-b6da-4a149a6d39d6
npx netlify deploy --prod --dir dist
```

For continuous deployment, connect `marklueken/MarkedSolutions`, select this app branch, and set **Base directory** to `contracts`. The build command is `npm run build`; publish directory is `dist`; functions directory is `netlify/functions` relative to the base. The `contracts/netlify.toml` configures these settings.

## Required setup

1. Enable Netlify Identity in Project configuration. Set registration to **Invite only**.
2. Invite the approved owner account through Netlify Identity and set its password from the invitation link. Invitation sending is an owner action; the implementation has not sent an invitation.
3. `ALLOWED_EMAILS` is preconfigured for `mark@marked.solutions`. Update if a different address is used. Access requires a confirmed Identity account AND an exact email match. Empty configuration denies all access.
4. Add `SAM_API_KEY` as a secret environment variable scoped to Functions. Obtain the public API key from SAM.gov Account Details. Do not use a client-side VITE_ variable.
5. Use Netlify AI Gateway on a supported credit-based plan or configure `OPENAI_API_KEY`. `OPENAI_BASE_URL` is optional for provider-compatible gateways. The default model is `gpt-4.1-mini`; `AI_MODEL` can override it with a supported model.
6. `AUTOMATION_TOKEN` has been provisioned as a secret. It authenticates internal scheduled/background calls. If replacing it, use at least 32 cryptographically random characters.
7. Redeploy after changing environment variables. Complete the company profile, test a scan and analysis, then enable daily scanning.

The Netlify project and the two access/automation environment variables were created during implementation. Identity, production upload, DNS, live SAM, and AI require final activation and end-to-end verification.

## Connect only the subdomain

Add `contracts.marked.solutions` to the Netlify project's production domains first. At the authoritative DNS provider, add:

| Type | Name | Target |
| --- | --- | --- |
| CNAME | contracts | marked-contracts.netlify.app |

Use the provider's default TTL. Keep the existing apex, www, mail records and nameservers. Do not edit the GitHub Pages root CNAME file. Once DNS resolves, verify Netlify's managed HTTPS certificate and the custom hostname before using real data.

## Review coverage and operating limits

- Searches match notice **titles**, not every attachment or description. They are a focused intake, not exhaustive procurement coverage.
- Initial lookback is 30 days; subsequent scans overlap seven days. Up to 1,000 results per phrase are read. A cap produces a visible partial-scan warning.
- Up to 100 saved decisions are considered for refresh; pursued/partner/monitored notices are queried using a one-year posting window.
- Automated analysis reads notice metadata and accessible SAM descriptions. Linked attachments must be added manually. Changes to attachment links are detected; replacement bytes behind unchanged links are not automatically compared.
- PDF extraction uses text layers; scanned PDFs require OCR. Maximum PDF upload is 15 MB/150 pages, maximum uploaded text is 150,000 characters, and total analysis sources are limited to 160,000 characters. Raw PDF bytes stay in the browser; extracted text is stored server-side and sent for AI analysis.
- Up to ten changed notices are analyzed per scan. Remaining notices can be analyzed individually. No email digest is configured; the dashboard is the results inbox.
- A fit score measures service alignment, not eligibility or probability of winning. Missing profile facts remain unverified. Exact quote checks can identify unsupported quotations but do not prove the interpretation correct.
- Source changes discard old analysis and save the prior record. Profile changes require manual reanalysis of existing notices.
- AI and Netlify usage consume the owner's service quota. This version never submits bids or contacts agencies.

## Local development and validation

```sh
npm ci
npm run check
npm test
npx netlify dev --offline
```

The example workspace can be reviewed locally. Identity requires a Netlify deployment for a full sign-in test. Run live smoke tests for login, denied access, manual upload, evidence analysis, SAM import, saved decisions, and scheduled dispatch before enabling unattended use.
