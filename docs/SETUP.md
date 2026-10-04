# Setup

Handle runs as a local Node.js service with a React dashboard. External providers supply messaging, voice, telephony, and optional email access.

## 1. Configure the local service

Install Node.js 24 or newer, then run:

```sh
npm ci
cp .env.example .env
```

Only copy the example on a fresh checkout. Keep existing credentials and encryption keys when updating an installation.

Generate two separate values:

```sh
openssl rand -hex 24  # DASHBOARD_TOKEN
openssl rand -hex 32  # ENCRYPTION_KEY
```

Save them under the matching names in `.env`. Set `ALLOWED_SENDERS` to the permitted users' phone numbers in international format, separated by commas. Keep `CALLING_ENABLED=false` during setup.

Keep the encryption key safe: existing Gmail tokens cannot be decrypted without it.

## 2. Start Handle

```sh
npm run build
npm start
```

Open [localhost:4327](http://localhost:4327) and sign in with `DASHBOARD_TOKEN`.

A public HTTPS endpoint must forward to this server for voice tools and Gmail callbacks. Set that address as `PUBLIC_URL`. A Cloudflare quick tunnel works for a local demo; its address changes when restarted. The Mac, server, and tunnel must remain running.

Restart Handle after editing `.env` directly.

## 3. Connect the providers

### ElevenLabs

Set `ELEVENLABS_API_KEY`, then run:

```sh
npm run setup:voice
```

This creates or updates the text planner, voice agent, outcome verifier, and case-specific tools. Run it again whenever `PUBLIC_URL` changes.

Browser rehearsals use the actual voice agent and consume ElevenLabs credits.

### Photon / Spectrum

Set `PHOTON_PROJECT_ID` and `PHOTON_PROJECT_SECRET`. You can also save the secret through **Connections → Service credentials** on the local dashboard.

Enroll the intended users through Photon and add their numbers to `ALLOWED_SENDERS`. Each user should text the managed number assigned to them by Photon. Your personal number identifies you as a customer; the managed line sends Handle's replies.

An SDK connection does not prove delivery. Send a first message and verify that Handle replies and creates a request in the dashboard.

### SpacetimeDB

Publish the module in `spacetimedb/` using the SpacetimeDB CLI. Set:

- `SPACETIMEDB_URL`
- `SPACETIMEDB_DATABASE`
- `SPACETIMEDB_TOKEN`

Use the publisher's token. Tables are private, and the publisher owns the write reducer. SpacetimeDB is the primary store; Handle subscribes to committed state and pauses new actions during a database interruption.

### Twilio

Save `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` in `.env` or the local **Service credentials** form.

Check for an owned voice number:

```sh
npm run setup:phone
```

This command does not buy a number or make a call. If the account has several eligible numbers, set `TWILIO_PHONE_NUMBER` to the one intended for Handle.

Connect the selected number to ElevenLabs:

```sh
npm run setup:phone -- --connect
```

Restart Handle, open **Connections**, and review the checks before enabling calls. Enabling calls allows ready requests to dial automatically.

Use a paid Twilio account for ElevenLabs voice calls: current trials block its audio streaming. A trial walkthrough number may also be unavailable for import.

### Photon voice — alternative

The Photon SIP adapter is prepared alongside Twilio. It needs confirmed voice access and a project-owned iMessage line. Run `npm run setup:photon` for a read-only preflight. Follow the [voice setup and test guide](VOICE.md) before connecting the trunk or enabling calls.

### Gmail — optional

1. Create a web OAuth client in Google Cloud and enable the Gmail API.
2. Register `${PUBLIC_URL}/oauth/google/callback` as an authorized redirect URI.
3. Add your Google account as a test user while the OAuth app is in testing mode.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then restart Handle.
5. Choose **Connect Gmail** in the dashboard, or text `connect gmail`, and complete consent.

Access is read-only. Handle encrypts tokens before storing them in private SpacetimeDB state. Keep `ENCRYPTION_KEY` unchanged across restarts. Without Gmail, users can supply reservation and receipt details in their messages.

Connection links expire after ten minutes and work once. Complete consent in the same browser that opened the link. If you cancel or the link expires, request a new one. The **Disconnect Gmail** button revokes Google's grant and removes the saved tokens.

With Handle running, verify the connection without reading or printing any emails:

```sh
npm run check:gmail
```

Then use the dashboard's Gmail search with a specific receipt or reservation query to check evidence retrieval. Gmail search is restricted to the connected user; demo calls cannot access it.

If Google shows `redirect_uri_mismatch`, update the web client's authorized redirect URI to exactly match `${PUBLIC_URL}/oauth/google/callback`. A new tunnel address requires a new registered URI and a Handle restart. Never commit tunnel credentials, OAuth secrets, or consent links.

Google's External / Testing mode requires the account to be listed as a test user. Gmail grants in this mode expire after seven days; reconnect when prompted. Public onboarding needs Google's production verification process.

## 4. Rehearse before dialing

Create a request with fictional appointment details and select **Browser rehearsal**. Allow microphone access and play the business representative.

Check two paths:

- Confirm a cancellation and provide a reference number. Handle should report the confirmed result.
- Introduce a cancellation fee. Handle should request approval, wait for `YES <code>` or `NO <code>`, and follow the answer.

Rehearsals are labeled separately and excluded from the handled count. An ended conversation alone is never treated as a successful resolution.

## 5. Check the installation

```sh
npm run check
npm test
npm run doctor
```

`doctor` checks authentication and compares local case/event records against SpacetimeDB without printing private contents. **Connections** shows pending message deliveries and cloud writes.

Use **Connections** for live provider checks. Keep calls paused until the caller number and intended test recipient are ready.

## Storage and access

- `.env` contains credentials and local settings.
- SpacetimeDB holds private cases and encrypted OAuth tokens.
- `.data` contains local logs and any legacy migration backups.
- `work` contains local development files.

All three are ignored by Git. Do not publish their contents or share the dashboard token with demo participants. The current dashboard is an operator workspace that can view all enrolled users' requests.

## Past call memory

After a call, a separate verifier checks the proposed outcome against the business transcript. A successful result must include a matching business quote. Only then can the outcome become memory. If verification is unavailable or inconclusive, the case needs follow-up.

Handle recalls up to three confirmed outcomes from the last 90 days, restricted to the same enrolled user, business name, and business phone. Rehearsals and unconfirmed outcomes are excluded. Past approvals never authorize a new action.

In a completed case's **Context** tab, choose **Exclude from future recall** to stop reuse. This preserves the original case record; it does not delete transcripts or recall already supplied to an active conversation. Memory fields and exclusion choices replicate with the private case record in SpacetimeDB. This is retrieval of past outcomes, not model training.
