# Handle

A personal customer-service agent you text through iMessage.

Tell Handle what you need and which business to call. It gathers the details, talks to the business on your behalf, and sends you the outcome. If a new fee or a change needs your approval, it texts you before agreeing.

Built at MHacks.

## How it works

1. **Send a request.** Describe the problem and provide the business's phone number.
2. **Fill in the details.** Handle asks for missing information. With Gmail connected, it can look up relevant receipts and reservations.
3. **Let Handle call.** The voice agent explains your request and works through the conversation.
4. **Get an update.** Handle reports the result or asks for a decision when needed.

For example:

> Cancel my nail appointment tomorrow at 2pm at Maple Nail Studio. My name is Alex Demo. Their number is 734-555-0100. Don't agree to a cancellation fee.

The example uses fictional details. A request is marked resolved only when the business confirms completion. Silence never approves a fee.

## What's available

- **iMessage intake** for enrolled users, with conversation history and automatic reconnection.
- **Voice conversations** through ElevenLabs, with Twilio for outbound telephone calls.
- **A live dashboard** for requests, activity, transcripts, and approval decisions.
- **Optional Gmail access** to find supporting emails, with read-only permissions.
- **Browser rehearsals** that use the real voice agent without dialing a phone.

Live iMessage delivery and telephone calls still need end-to-end validation. The current installation keeps calling paused while phone setup is completed. Gmail is optional and currently disconnected.

## Try Handle

The hosted demo is currently invite-only; there is no public number to text yet. Making this repository public does not open the running service to new users.

For a local voice demo, create a request in the dashboard and choose **Browser rehearsal**. You play the business representative while Handle handles the request. Try confirming a free cancellation, then introducing a fee to see the approval flow.

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

| Service                  | Role                                                     |
| ------------------------ | -------------------------------------------------------- |
| Photon / Spectrum        | Receive and reply to iMessages                           |
| ElevenLabs               | Plan requests and run voice conversations                |
| Twilio                   | Place outbound phone calls                               |
| SpacetimeDB              | Replicate case state and events                          |
| Gmail OAuth              | Retrieve relevant emails with permission                 |
| React + Express + SQLite | Dashboard, application server, and durable local storage |

## Development

```sh
npm run format  # Apply formatting and spacing rules
npm run check   # Check formatting, lint rules, and TypeScript
npm test        # Run isolated tests
npm run doctor  # Check the running service without placing a call
```

Application logic lives in `src/core`, integrations in `src/providers`, and the dashboard in `web`. The SpacetimeDB module is in `spacetimedb`.

## Privacy

Credentials, local case data, and OAuth tokens are excluded from Git. Gmail tokens are encrypted locally. The dashboard requires authentication, and iMessage access is limited to explicitly allowed senders.

Handle is currently designed for a controlled demo. Public onboarding, per-user dashboard access, usage limits, and persistent hosting are required before opening it to everyone.
