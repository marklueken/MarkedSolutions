# Production activation record

Inspection date: October 28, 2026 (America/Chicago).
Inspected PR #3 head before this change: `685ecdc1c791cd9f7e39bd852b84bc2439e01f59`.
Project: `marked-contracts`, site ID `afaaa233-130f-49a8-b6da-4a149a6d39d6`.

## Verified

- PR #3 is open and draft. No review, merge or intake approval was performed.
- Netlify reports production deploy `6ac12ec48e544d42d43b42bf` ready and published on October 3, with all seven functions and `daily-scan` scheduled at `0 12 * * *`.
- That deployment has no commit reference. Its main JavaScript and CSS assets match the local build of the inspected PR head byte for byte; this does not establish server-function provenance.
- `https://contracts.marked.solutions/` loads successfully using default HTTPS certificate verification. Direct DNS lookup is unavailable in the execution environment; authoritative DNS records were not independently verified.
- Signed-out GET requests to `/api/contracts/state`, `/api/partners/list`, `/api/resume-intake/list`, `/api/partners/resume?id=smoketest0001`, and `/api/resume-intake/resume?id=smoketest0001` return 401 and `Cache-Control: no-store`.
- A signed-out POST to `/api/contracts/profile` returns 401. No profile was changed.
- Identity's public settings report `disable_signup: true` and `autoconfirm: false`. No owner login or confirmation is established by this result.
- Resend's webhook is enabled for `email.received` at `https://contracts.marked.solutions/api/resume-intake/webhook`. Its delivery-history query returned no events; delivery is not proven.
- Netlify's site environment listing contains production Functions coverage for `ALLOWED_EMAILS`, `AUTOMATION_TOKEN`, `SAM_API_KEY`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, and `RESUME_INTAKE_ADDRESS`. Values and provider validity are not established by presence. No site-level OpenAI variables were listed; runtime AI Gateway injection remains unverified.
- Local TypeScript check and all 27 tests pass, including webhook route-exclusion and unsigned-request signature-verification regression checks. The Netlify production-context offline build packages all seven functions and emits the webhook exclusion in the review function's `excludedRoutes` manifest.

## Blocking routing fix in this change

The published webhook currently returns 401 with `Sign in to continue.` for an unsigned POST, instead of the webhook handler's 400 `Invalid signature.`. The authenticated `/api/resume-intake/:action` route overlaps the signed public webhook.

`netlify/functions/resume-review.ts` now explicitly excludes `/api/resume-intake/webhook` using Netlify's `excludedPath` configuration. The webhook still requires a valid Resend signature. Review, approval, recovery and original-download routes still require an approved confirmed workspace account. This fix must be published and verified live before declaring email intake operational.

## Next activation steps, in order

1. Sign in to the existing Netlify project, verify its base directory is `contracts`, and publish a validated build of this change with its source commit recorded in the deploy message. Keep `.netlify/` ignored. Do not point Git deployment at `main` before the app is merged. If Git CD is configured, its next production-branch push can replace a manual upload; inspect that setting first.
2. Repeat the unsigned webhook POST below: require 400 `Invalid signature.`. Repeat the signed-out private API/download checks: require 401. Check that all seven functions and the PDF worker/native dependencies are present in the published deployment.
3. Confirm the owner is invited, email-confirmed, and matches `ALLOWED_EMAILS` (README's intended owner is `mark@marked.solutions`). Complete password/invitation actions as the owner. Verify login, page reload, session refresh, logout, and rejection of an unconfirmed/nonallowlisted account. Do not weaken the allowlist or confirmation requirement to make testing work.
4. With the owner signed in, inspect saved profile and connection status at `/api/contracts/state`. Keep `automation:false`; preserve existing company facts. If AI is absent, verify the supported-plan AI Gateway settings or provide server-side `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`, and optional `AI_MODEL` (default `gpt-4.1-mini`). Redeploy after environment changes. Do not set empty provider variables that override Gateway injection.
5. Run one narrow manual SAM scan via the dashboard (`POST /api/contracts/scan`). Poll `/api/contracts/state` until final status, inspect warnings and source descriptions, and analyze one notice (`POST /api/contracts/analyze`). Dispatch/202 alone is not completion. Save a decision and notes, reload, and verify persistence. Import one synthetic PDF/text solicitation and verify extraction, evidence and coverage limitations.
6. Verify forwarding `partners@marked.solutions` to `partners@narieeldia.resend.app`, the exact `RESUME_INTAKE_ADDRESS`, and a signed webhook delivery using a fresh synthetic text-based PDF. Confirm queued/processing becomes pending, original download works only when signed in, and quoted evidence is visible. Recover/replay the same email and verify no duplicate intake or partner. Exercise a recoverable extraction error with an unsupported/scanned/oversized fixture.
7. Keep the existing received test draft unapproved. Use separate synthetic fixtures in an isolated test workspace to exercise editing, rejection, approval into one partner, interrupted/repeated approval, explicit merge, and matching after reanalysis. Pending submissions must never enter matching; archived/excluded partners must stay out. Do not use real candidate data for this test.
8. Enable profile automation only after all manual smoke tests pass. Verify one actual scheduled invocation finishes, including its worker status and logs. The fixed 12:00 UTC cron is 7 a.m. Central in daylight time and 6 a.m. in standard time. A successful manual scan bypasses the automation gate and does not validate the schedule.

## Repeatable checks

From `contracts/`, on Node 22 or later:

```sh
npm ci
npm run check
npm test
NETLIFY_SITE_ID=afaaa233-130f-49a8-b6da-4a149a6d39d6 npx netlify build --offline
```

Public checks (the unsigned webhook probe does not queue an email):

```sh
curl -I https://contracts.marked.solutions/
curl -i https://contracts.marked.solutions/api/contracts/state
curl -i https://contracts.marked.solutions/api/partners/list
curl -i https://contracts.marked.solutions/api/resume-intake/list
curl -i -X POST https://contracts.marked.solutions/api/resume-intake/webhook \
  -H 'Content-Type: application/json' --data '{}'
```

Private endpoint implementations: `netlify/functions/api.ts`, `partners.ts`, and `resume-review.ts`. Intake delivery/extraction: `resume-webhook.ts`, `resume-background.ts`, and `_shared/intake.ts`. Access enforcement: `_shared/access.ts` and `_shared/platform.ts`. Scan dispatch/execution: `daily-scan.ts`, `scan-background.ts`, and `_shared/scan.ts`. AI calls: `_shared/analyze.ts` and `_shared/intake.ts`. Session refresh/recovery: `src/request.ts`.

No production deployment, environment change, invitation, outgoing email, authenticated write, partner approval or automation enablement was performed during this inspection. Remaining authenticated checks require the owner session; deployment requires Netlify sign-in.
