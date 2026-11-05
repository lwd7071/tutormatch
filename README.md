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

Set `CRON_SECRET` in Vercel for `/api/cron`. The daily Vercel Cron is compatible with Hobby. Users cannot accept an order or confirm a session after its 24-hour deadline; overdue records move to refund or dispute during the next daily cron run, which can be up to about a day later. Deploy the Firestore indexes in `firestore.indexes.json` before deploying the code (`firebase deploy --only firestore:indexes --project YOUR_FIREBASE_PROJECT_ID`) and wait until both indexes are ready. The cron response includes `changed` and `failed`; investigate nonzero failures in function logs.

## Checks

Run `npm test`, `npm run typecheck`, and `npm run build`. For browser smoke checks, start the app with `npm run dev` or `npm start`, then run `npm run test:ui` in another terminal. The UI check covers the mobile homepage, help page, and signed-out app. A live end-to-end payment test requires Firebase credentials and a payOS channel. Never commit `.env.local` or service-account JSON.
