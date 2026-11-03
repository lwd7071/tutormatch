# TutorMatch

Next.js application for one-to-one tutoring, prepaid packages, confirmed lessons, refunds, and tutor withdrawals.

## Run locally

1. `npm install`
2. Fill `.env.local` using `.env.example`. The file is ignored by Git.
3. To use the server locally, add `FIREBASE_SERVICE_ACCOUNT_JSON` to `.env.local` as a single-line JSON value. In Vercel, configure it as a server environment variable instead.
4. `npm run dev`

Enable Google sign-in in Firebase Authentication. Create a Firestore database and a Storage bucket. Deploy `firestore.rules` and `storage.rules` with the Firebase CLI; both deny direct client access because all business data passes through authenticated server routes. Set `FIREBASE_STORAGE_BUCKET` to the bucket name. Set `ADMIN_GOOGLE_EMAIL` to the Google account that should administer the site. The admin creates subjects before tutors can publish packages.

## Payments

Set `APP_PAYMENT_PROVIDER=payos`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, and `PAYOS_CHECKSUM_KEY` when ready. Configure the payOS payment webhook URL to `https://YOUR_DOMAIN/api/payments/webhook`. Redirects never activate an order; only a verified webhook does. Refunds and tutor withdrawals are manual bank transfers recorded by an admin. Verify the money-holding and payout arrangement before taking live payments.

Set `CRON_SECRET` in Vercel for `/api/cron`. The supplied daily Vercel Cron is compatible with Hobby; overdue orders and session confirmations are also reconciled whenever a signed-in user opens the app. Daily Cron can run after the exact 24-hour point, so use a more frequent external scheduler or Vercel Pro if background processing must happen promptly without a visit.

## Checks

Run `npm test`, `npm run typecheck`, and `npm run build`. For browser smoke checks, start the app with `npm run dev` or `npm start`, then run `npm run test:ui` in another terminal. The UI check covers the mobile homepage, help page, and signed-out app. A live end-to-end payment test requires Firebase credentials and a payOS channel. Never commit `.env.local` or service-account JSON.
