# Handle

Text the problem. Handle gathers the details, calls the business, and keeps you posted. It asks about new fees or changed terms; your original request is already authorization to pursue that request.

## Run

Node 24 or newer. From this directory:

```sh
npm ci
cp .env.example .env  # only for a fresh checkout; preserve an existing .env
npm run build
npm start
```

Open http://localhost:4327. Sign in with `DASHBOARD_TOKEN` from the local `.env`. Generate that token with `openssl rand -hex 24` and `ENCRYPTION_KEY` with `openssl rand -hex 32` on a fresh checkout. Keep the encryption key: existing Gmail tokens cannot be recovered without it.

`npm run format` applies ESLint spacing rules, Stylelint rule separation, and Prettier formatting. Source uses four-space indentation, an 80-column target, and one JSX attribute per line. `npm run check` checks formatting, lint rules, and TypeScript, including unused imports. `npm test` runs the isolated checks. `npm run doctor` checks the running service and its authentication boundaries without making a call.

## Connections

- **ElevenLabs:** set the API key, then `npm run setup:voice`. This creates or updates the intake and voice agents and their six case-scoped tools. Rerun after changing `PUBLIC_URL`. Browser rehearsals use the actual agent and consume ElevenLabs credits.
- **Gmail:** create a web OAuth client, enable Gmail API, and register `${PUBLIC_URL}/oauth/google/callback`. Add your Google account as a test user while the app is in testing mode. Set the client ID and secret, restart, then connect in the dashboard or text `connect gmail`. Access is read-only. Refresh tokens are encrypted locally. Google testing-mode consent may need renewing after seven days.
- **SpacetimeDB:** publish `spacetimedb/`, set its database name and the publisher's token. Tables are private; the publisher owns the write reducer. A durable local journal retries replication through the outbox.
- **Photon:** set the project ID and secret. The local dashboard's **Service credentials** form can save the secret without returning it to the browser. Enroll your phone in the project's shared iMessage line through Photon, then text that line. `ALLOWED_SENDERS` limits who can use this installation. Your enrolled personal number is the customer; the managed Photon line sends Handle's replies. Handle reconnects automatically after interruptions.
- **Phone calls:** save Twilio credentials in the local dashboard. Run `npm run setup:phone` to check for an owned voice number; this does not purchase or import anything. Once an eligible number exists, `npm run setup:phone -- --connect` imports it into ElevenLabs and assigns Handle's agent. Restart, open **Connections**, and enable calls only after the connection checks pass. Trial accounts can call verified recipients only. The number shown in Twilio's trial demo is not necessarily an owned number available for this integration.

**Connections** checks the public endpoint, agents, phone integration, and database against the actual services. An iMessage SDK connection still needs a first incoming text to prove delivery. Gmail is optional: without it, paste the reservation or receipt details into your request.

A public HTTPS endpoint must reach this server for voice tools and Gmail callbacks. A Cloudflare quick tunnel is suitable for a local rehearsal but its URL changes when restarted; update Google redirects and rerun voice setup. This deployment stays online only while the Mac, server, and tunnel are running.

## Rehearse

Create a request such as “Cancel my nail appointment tomorrow at 2pm at Maple Nail Studio, 734-555-0100. My name is Alex Demo. No cancellation fee.” Once the details are ready, choose **Browser rehearsal** and allow the microphone. Play the business representative. This uses real voice and real tools without dialing a phone. Rehearsals are labeled and excluded from the handled count.

Try an uncomplicated cancellation with a reference number. Then try a new $25 fee: Handle should ask in the workspace chat, wait for `YES <code>` or `NO <code>`, and obey the answer. Silence does not authorize payment. The business must confirm completion before Handle reports a resolved request.

## Code

`src/core` owns intake, case transitions, approvals and durable queues. `src/providers` contains the service adapters. `src/routes` contains authenticated dashboard routes and narrowly scoped callbacks. `web` is the React workspace. `spacetimedb` is the deployed database module.

Live telephone milestones arrive through agent tools; the full telephone transcript is fetched after the conversation. Browser rehearsals stream their transcript through the client. An ended call is not treated as success. Provider failures are shown and message/state delivery retries; uncertain call initiation is never automatically redialed.

`.env`, `.data`, and `work` are ignored. `.data` contains private case information and encrypted OAuth tokens. Do not publish it. This is a local, enrolled-user deployment; broad public onboarding, stable hosting, verified OAuth publishing, and real telephone validation are separate launch work.
