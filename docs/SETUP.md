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

This creates or updates the text planner, voice agent, and case-specific tools. Run it again whenever `PUBLIC_URL` changes.

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

Use the publisher's token. Tables are private, and the publisher owns the write reducer. Handle keeps a local journal and retries cloud replication after interruptions.

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

Twilio trial accounts restrict calls to verified recipients. The number displayed in a trial walkthrough may not be an owned number available for import.

### Gmail — optional

1. Create a web OAuth client in Google Cloud and enable the Gmail API.
2. Register `${PUBLIC_URL}/oauth/google/callback` as an authorized redirect URI.
3. Add your Google account as a test user while the OAuth app is in testing mode.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then restart Handle.
5. Choose **Connect Gmail** in the dashboard, or text `connect gmail`, and complete consent.

Access is read-only. Tokens are encrypted locally. Testing-mode consent may need renewal after seven days. Without Gmail, users can supply reservation and receipt details in their messages.

Changing the tunnel address also requires updating the OAuth redirect URI.

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

Use **Connections** for live provider checks. Keep calls paused until the caller number and intended test recipient are ready.

## Storage and access

- `.env` contains credentials and local settings.
- `.data` contains case data and encrypted OAuth tokens.
- `work` contains local development files.

All three are ignored by Git. Do not publish their contents or share the dashboard token with demo participants. The current dashboard is an operator workspace that can view all enrolled users' requests.
