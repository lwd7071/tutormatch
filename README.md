# TutorMatch

Next.js application for one-to-one tutoring, prepaid packages, confirmed lessons, refunds, and tutor withdrawals.

## Run locally

1. `npm install`
2. Fill `.env.local` using `.env.example`. The file is ignored by Git.
3. To use the server locally, add `FIREBASE_SERVICE_ACCOUNT_JSON` to `.env.local` as a single-line JSON value. In Vercel, configure it as a server environment variable instead.
4. `npm run dev`

Enable Google sign-in in Firebase Authentication and create a Firestore database. Deploy `firestore.rules` with the Firebase CLI; business data passes through authenticated server routes. Create a Cloudinary account and set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` as server environment variables locally and in Vercel. Uploaded tutor photos and verification documents are stored as authenticated Cloudinary assets and served through the app. Set `ADMIN_GOOGLE_EMAIL` to the Google account that should administer the site. The admin creates subjects before tutors can publish packages.

For PDF verification documents on Cloudinary's Free plan, enable **Allow delivery of PDF and ZIP files** under Console Settings → Security. Cloudinary disables PDF delivery by default on Free accounts.

Tutor applications require a portrait and a verification document (up to 4 MB each). Replacements and profile edits are reviewed as a separate submission while the approved profile stays live. Admins can suspend a tutor to stop new sales and trial requests without deleting existing orders.

For rollout, deploy Firestore indexes first (see below), then deploy this code with its legacy read fallback. Run `node scripts/migrate-tutor-profiles.mjs` with a configured service account. The dry run lists IDs for legacy profiles, missing files, missing photo URLs, and blocked tutors still marked approved. Run `node scripts/migrate-tutor-profiles.mjs --apply`, then run the dry run again and confirm `legacy`, `photoBackfills`, and `blockedApproved` are empty. IDs under `needsUpload` require tutors to upload missing files and resubmit; these profiles become editable after migration. Keep the legacy read fallback until the migration has been verified on production data.

## Payments

Set `APP_PAYMENT_PROVIDER=payos`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, and `PAYOS_CHECKSUM_KEY` when ready. Configure the payOS payment webhook URL to `https://YOUR_DOMAIN/api/payments/webhook`. Redirects never activate an order; only a verified webhook does. Refunds and tutor withdrawals are manual bank transfers recorded by an admin. Verify the money-holding and payout arrangement before taking live payments.

Set `CRON_SECRET` in Vercel for `/api/cron`. The daily Vercel Cron is compatible with Hobby. Users cannot accept an order or confirm a session after its 24-hour deadline; overdue records move to refund or dispute during a later cron run. Payment reconciliation, overdue orders, overdue sessions, and listing refresh each have a separate cursor and time budget. The cron response reports `changed`, `failed`, and `groups`; investigate failures and `more: true` in function logs. An admin can run another bounded group through the dashboard.

### Staging QR payment check

Create a separate Vercel staging deployment with a separate Firebase project, Cloudinary cloud, and payOS payment channel. Set `APP_ENV=staging`, `APP_PAYMENT_PROVIDER=payos`, the staging Firebase service account and client config, `ADMIN_GOOGLE_EMAIL`, and the staging payOS keys there. Vercel production (`VERCEL_ENV=production`) returns 404 for `/payment-test` and its API even if `APP_ENV` is set incorrectly. Configure the staging payOS webhook URL as `https://STAGING_DOMAIN/api/payments/webhook`.

Sign in as admin at `/payment-test` on staging and select **Tạo QR 2.000đ**. The server fixes the amount at 2,000 VND, allows one open test per admin and three new tests per UTC day. The QR and checkout link are from payOS. After transferring exactly 2,000 VND, select **Kiểm tra lại** and compare the page status with `paymentTests/{orderCode}` and the payOS dashboard or receiving bank account. The test never writes to `orders`, the business ledger, tutor wallets, or refunds. It verifies the transfer and webhook path only; separately test a real order, ledger, and refund before enabling public sales.

## Technical public launch

Use a separate Firebase project, Cloudinary cloud, Vercel environment, and payOS payment channel for integration testing. Keep the staging service account and Cloudinary secret outside Git. payOS has no isolated sandbox, so use a channel under your control and make one small real payment only after mock tests pass. Reconcile the webhook, order state, payment ledger, and refund before taking public payments.

Before switching catalog reads in production:

1. Back up Firestore and verify the backup can be read. Keep payments disabled during the cutover.
2. Deploy `firestore.indexes.json` with `firebase deploy --only firestore:indexes --project YOUR_FIREBASE_PROJECT_ID` and wait until every new index is `READY`.
3. Run `npx tsx scripts/migrate-public-listings.ts` to list IDs and counts. This is read only. Compare the expected count with approved, unblocked tutors.
4. Run `npx tsx scripts/migrate-public-listings.ts --apply` using the service account for the intended project. The script can be rerun and enables the indexed catalog only after verifying every listing and offer row. Run the dry run again; `changedCount`, `staleCount`, and `staleOffers` should be empty. Until then the catalog retains its legacy read path. Once `publicOfferReady` is enabled, `/api/data?scope=public` returns 410; use `/api/catalog`.
5. Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run test:ui` against staging. The UI smoke test covers mobile and desktop public pages and the signed out app; test signed in student, tutor, and admin flows manually in staging.
6. After deployment monitor API errors by `requestId`, webhook and cron failures, `settings/paymentReconciliation`, pending payment orders, and catalog query read warnings. Leave payments disabled if any new index is building or the migration verification fails.

The `/api/action` route accepts strict, action specific JSON and returns `{ data }` or `{ error: { code, message, fieldErrors? }, requestId }`. Public search returns 24 tutors per page; private lists return 50 records per page. Payment creation uses a client idempotency key. The daily cron checks payOS links that are at least five minutes old; a payOS timeout leaves the order pending for reconciliation instead of declaring it unpaid.

## Tutor discovery and trial scheduling

The tutor profile form stores province and ward codes after admin review. The bundled Vietnam administrative divisions dataset is [Open Admin Data](https://github.com/open-admin-data/vietnam-administrative-divisions), licensed CC-BY-4.0 (snapshot dated 2026-09-08). Existing free-text locations and availability remain visible; tutors must add coded locations and weekly slots before those filters or trial booking can use them. Approved tutors update weekly 30-minute-aligned windows and closed dates directly in the profile tab. The public listing sync copies weekly windows and location codes; `/api/catalog/[uid]/slots` checks dated exceptions and reserved sessions when showing the next 14 days.

A student proposes one 60-minute trial slot in Vietnam time. The tutor's acceptance rechecks availability and reserves both calendars atomically. If the slot becomes unavailable, the tutor rejects the request so the student can choose again. Legacy trial requests without a proposed slot continue through the existing chat and manual scheduling flow. Favorites are stored locally for guests and synchronized to the signed-in account; the comparison view shows at most three public tutors. `/api/match` provides deterministic suggestions from subject, mode, budget, schedule, and location.

## Checks

Run `npm test`, `npm run typecheck`, and `npm run build`. For browser smoke checks, start the app with `npm run dev` or `npm start`, then run `npm run test:ui` in another terminal. A live end-to-end payment test requires a separate Firebase project and a payOS channel. Never commit `.env.local` or service-account JSON.
