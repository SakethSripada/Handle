# Voice setup and live tests

Handle can use Twilio or Photon SIP for telephone calls. Both routes connect to the same ElevenLabs agent. The dashboard keeps calling paused until the selected route passes its configuration checks.

## Photon setup

Ask Photon to confirm these items for the Handle project:

- Outbound SIP access is enabled, with an iMessage caller line **owned by the project**. Enrolling your personal phone as a messaging user is a separate step.
- ElevenLabs may connect using SIP Digest authentication over TLS to `sip.spectrum.photon.codes:5061`, without SIP registration.
- PCMU/8000 audio, RTP reachability, and keypad tones work for outbound calls to the intended test destination.
- Which countries, concurrent calls, and call durations are allowed; the actual plan and per-minute charges.
- Whether encrypted media and an API for immediate call termination are available.

No upgrade, number purchase, or phone call is performed by the setup command.

After Photon confirms access, put the owned caller line in `PHOTON_VOICE_NUMBER` and set `PHOTON_VOICE_ENABLED=true` in your ignored `.env`.

```sh
npm run setup:photon             # Read-only preflight
npm run setup:photon -- --connect
```

`--connect` installs the project's SIP credentials in ElevenLabs. It creates or updates the Photon trunk, preserves the Twilio number configuration, and leaves calling paused. Restart Handle, select **Photon SIP** in **Connections**, and run the connection checks.

The setup uses TLS for signaling and offers PCMU. Media encryption is negotiated using ElevenLabs' `allowed` setting. TLS signaling alone does not imply encrypted audio. Confirm the media requirements with Photon before handling sensitive calls.

### Stopping a Photon call

Handle revokes the agent's authority as soon as a stop request arrives. Every subsequent tool response tells the agent to end the call. The agent checks context before business actions and after hold.

Immediate remote hangup has not been verified for this SIP integration. During hold, a stop may wait until the next agent tool check. The dashboard shows **Stop requested** until ElevenLabs reports the call ended. Keep the provider console available during tests; do not interpret the request as a confirmed hangup.

## Twilio setup

Use a paid Twilio account with an owned voice number. Current trial restrictions block the audio streaming used by the ElevenLabs native integration; recipient verification alone is insufficient.

For the US demo, enable **United States → Low-risk numbers** under Twilio Voice geographic permissions. An upgraded account can still have this disabled. Handle checks it before enabling calls or starting a dial. High-risk destinations do not need to be enabled.

```sh
npm run setup:phone
npm run setup:phone -- --connect
```

Restart Handle, select **Twilio**, and check connections. Both providers retain separate ElevenLabs number IDs. Pause calling and finish active calls before switching. Handle never automatically retries a failed dial or switches carriers mid-call.

## Latency

There is no verified Photon-versus-Twilio latency benchmark for this application. SIP may avoid a WebSocket media bridge, but carrier routing, codec conversion, endpointing, model inference, speech generation, and tool round trips all contribute to the experience.

The case's **Context** tab records ElevenLabs' agent-audio and model-first-token metrics when supplied. These are processing measurements, not the complete delay heard on the telephone. Browser rehearsals are labeled separately and cannot establish carrier performance.

For a useful comparison, call the same consenting test recipient with the same agent and script on each provider. Test interruptions, short answers, an IVR, and a hold period. Compare several turns and listen for clipped speech, echo, silence, and delayed interruption handling. Verify two-way audio before calling an actual business.

## First live test

### Conversation with a judge

Ask the judge whether they would like to receive a short AI demo call, then text Handle:

```text
Demo call +1 202 555 0110
```

Replace the fictional number with the judge's number. They do not need a Handle account to answer a phone call; the carrier must permit calling that destination without recipient verification.

Handle introduces itself as an AI and asks whether it is a good time. The judge can chat, ask about Handle, or try a fictional role-play. This mode cannot read Gmail, retrieve private call history, or request payment approvals. It saves the conversation transcript and sends a completion text. It never marks a customer-service problem resolved.

If calling is paused, the text prepares a request without dialing. Connect the line and choose **Start call** on that request. Enabling calling alone does not dial queued requests. Try this with your own phone before presenting it to a judge.

Keep the server and public tunnel running, and prevent the demo laptop from sleeping. A replacement tunnel needs an updated `PUBLIC_URL` and `npm run setup:voice`, followed by a server restart. `npm run doctor` checks the public endpoint, agent access, messaging connection, delivery queues, and SpacetimeDB parity. Gmail and an unconfigured voice line are shown as waiting; other failed checks need attention before the demo.

### Customer-service scenario

1. Run `npm run doctor`. Verify empty delivery queues and matching SpacetimeDB records.
2. Confirm your phone can text Handle and receive a reply. Keep the caller line separate from the customer's enrolled number.
3. Prepare a consenting test recipient acting as a business. Use fictional appointment details and no payment.
4. Enable calling in **Connections**, then send the request from iMessage. An existing ready request can be started from the dashboard.
5. Confirm the recipient hears Handle, and Handle hears the recipient. Test interruption and a brief hold.
6. Have the recipient offer to cancel, then explicitly confirm completion with a reference. Handle should verify the completed transcript before texting the result.
7. Repeat with a fee; decline it through iMessage. Check that the fee is not accepted.
8. Check the transcript, final state, and SpacetimeDB parity. Test stop behavior. Pause calling after testing.

Gmail is optional. The current installation leaves it disconnected. If the public tunnel changes, update both the voice tools (`npm run setup:voice`) and the Google OAuth redirect before connecting Gmail.

## References

- [Photon outbound SIP](https://photon.codes/docs/spectrum-ts/providers/voice/outbound-calls)
- [ElevenLabs SIP trunking](https://elevenlabs.io/docs/eleven-agents/phone-numbers/sip-trunking)
- [ElevenLabs SIP outbound-call API](https://elevenlabs.io/docs/api-reference/sip-trunk/outbound-call)
- [Twilio trial restrictions](https://www.twilio.com/docs/usage/trials/try-out-voice)
