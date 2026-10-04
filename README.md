# Handle

A personal customer-service agent you text through iMessage.

Tell Handle what you need and which business to call. It gathers the details, talks to the business on your behalf, and sends you the outcome. If a new fee or a change needs your approval, it texts you before agreeing.

The request determines the conversation. Ask about opening hours, check a delivery, get troubleshooting advice, reschedule something, or describe another task. Handle asks for identifying details only when that task needs them; asking a question does not authorize changing an account or booking.

Built at MHacks.

## How it works

1. **Send a request.** Describe the problem and provide the business's phone number.
2. **Fill in the details.** Handle asks for missing information. With Gmail connected, it can look up relevant receipts and reservations.
3. **Let Handle call.** The voice agent explains your request and works through the conversation.
4. **Get an update.** Handle reports the result or asks for a decision when needed.

For example:

> Cancel my nail appointment tomorrow at 2pm at Maple Nail Studio. My name is Alex Demo. Their number is 734-555-0100. Don't agree to a cancellation fee.

The example uses fictional details. A request is marked resolved after its outcome is checked against the business transcript. Silence never approves a fee.

## What's available

- **iMessage intake** for enrolled users, with conversation history and automatic reconnection.
- **Voice conversations** through ElevenLabs, with Twilio and a prepared Photon SIP adapter for outbound telephone calls.
- **A live dashboard** for requests, activity, transcripts, and approval decisions.
- **Past call memory** from verified outcomes, scoped to the same customer and business.
- **Optional Gmail access** to find supporting emails, with read-only permissions.
- **Browser rehearsals** that use the real voice agent without dialing a phone.

The iMessage round trip and live ElevenLabs rehearsals have been tested. Real telephone audio still needs validation after a voice line is connected. Calling remains paused; Gmail is optional and disconnected. See the [voice setup guide](docs/VOICE.md) for the remaining steps.

## Try Handle

The hosted demo is currently invite-only; there is no public number to text yet. Making this repository public does not open the running service to new users.

For a local voice demo, create a request in the dashboard and choose **Browser rehearsal**. You play the business representative while Handle handles the request. Try confirming a free cancellation, then introducing a fee to see the approval flow.

Once a voice line is connected, an enrolled user can text `Demo call` followed by a consenting participant's phone number. Handle introduces itself and has a short conversation without asking for reservation details. Demo calls cannot access email or customer history and do not count as resolved customer-service requests. While calling is paused, the command prepares the demo for a manual start from the dashboard.

## Run locally

Requires **Node.js 24 or newer** and credentials for the services you want to use.

```sh
npm ci
cp .env.example .env
```

Follow the [setup guide](docs/SETUP.md) to configure credentials, the dashboard login, and provider connections. Preserve your existing `.env` if you have already configured Handle.

```sh
npm run build
npm start
```

Open [localhost:4327](http://localhost:4327). The **Connections** page checks the services and shows any remaining setup steps.

## Stack

| Service             | Role                                                        |
| ------------------- | ----------------------------------------------------------- |
| Photon / Spectrum   | Receive and reply to iMessages                              |
| Gemini              | Understand texts and verify call outcomes                   |
| ElevenLabs          | Run voice conversations                                     |
| Twilio / Photon SIP | Place outbound phone calls                                  |
| SpacetimeDB         | Primary state, transactional writes, and live subscriptions |
| Gmail OAuth         | Retrieve relevant emails with permission                    |
| React + Express     | Dashboard and integration server                            |

## Development

```sh
npm run format  # Apply formatting and spacing rules
npm run check   # Check formatting, lint rules, and TypeScript
npm test        # Run isolated tests
npm run doctor  # Check the running service without placing a call
```

Add `GEMINI_API_KEY` to `.env` to use Gemini directly for intake and outcome verification, then restart the server. With `TEXT_PROVIDER=auto` (the default), an absent key keeps the ElevenLabs text agents active. Set `TEXT_PROVIDER=elevenlabs` to select them explicitly. Voice conversations continue through ElevenLabs. The direct model defaults to `gemini-3.8-flash` and can be changed with `GEMINI_MODEL`.

`npm run check:intake` checks varied requests against the selected text provider. It uses fictional inputs and consumes provider quota, but never places a phone call. Provider failures surface as errors; Handle does not silently switch providers or approve an unverified outcome.

`npm run check:outcomes` checks the selected verifier against fictional transcripts: a short answer, a promise, a confirmed action, and an unauthorized fee.

Active development is pushed to `dev`; changes reach `main` through reviewed pull requests.

Application logic lives in `src/core`, integrations in `src/providers`, and the dashboard in `web`. The SpacetimeDB module is in `spacetimedb`.

## Privacy

Credentials, local case data, and OAuth tokens are excluded from Git. Gmail tokens are encrypted locally. The dashboard requires authentication, and iMessage access is limited to explicitly allowed senders.

Handle is currently designed for a controlled demo. Public onboarding, per-user dashboard access, usage limits, and persistent hosting are required before opening it to everyone.

### State and recovery

SpacetimeDB is the primary database for cases, transcripts, approvals, incoming messages, and delivery jobs. Handle waits for database confirmation before acknowledging writes. Its server subscribes to private tables and forwards committed updates to the authenticated dashboard; the browser never receives the database credential.

Reducers enforce write versions, approval expiry and ownership, and a lease that permits one active backend. During a database interruption, new actions pause. On reconnect, Handle restores its subscription and resumes pending work. The integration server still needs to be running for iMessage and voice tools.

SQLite is used only for isolated tests and importing the original installation. To migrate an older installation, stop its server and run `npm run state:migrate` once. This creates a local backup, verifies imported records, and refuses to overwrite existing cloud state. New installations start directly from SpacetimeDB.

`npm run check:state` checks subscriptions, private access, transactional rejection, and recovery against the configured database using temporary fictional records. Stop the backend first so the check can acquire its writer lease. It never sends texts or places calls. Regenerate client bindings with `npm run state:generate` after module changes.
