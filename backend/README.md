# Lette Backend — AI-Powered Viewing Slot Manager

## Overview

Full-stack AI-native backend for managing property viewing slots. A property manager types a natural-language request; the backend parses it into structured slot data, creates viewing slots in Firestore, drafts personalised invitation emails via LLM, and sends them through the admin's own Gmail account. Built with Express + TypeScript, Firebase Firestore, the Vercel AI SDK, and Google OAuth.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| Framework | Express |
| Database | Firebase Firestore |
| AI | Vercel AI SDK · Gemini 2.0 Flash (default) |
| Email | Gmail API via Google OAuth |
| Calendar | Google Calendar API via Google OAuth |
| Validation | Zod |

## AI Architecture

### 1. Provider-agnostic LLM layer

`getModel()` in `services/llm.ts` reads `LLM_PROVIDER` from the environment and constructs a provider using the Vercel AI SDK's OpenAI-compatible adapter. Both Gemini (via Google's OpenAI-compat endpoint) and Anthropic Claude are supported. Swapping providers requires changing one env var — no code changes needed.

### 2. `generateObject` with Zod schemas

Every LLM call uses `generateObject` with an explicit Zod schema rather than free-form text generation. The SDK enforces the schema at the API level, so the application always receives a typed, validated object — no manual JSON parsing, no silent field omissions. The same Zod schemas serve as both the LLM output contract and the TypeScript type source.

### 3. LLM-as-Judge pattern

Every invitation message is validated before being saved:

1. **Draft** — the LLM writes a personalised email from the slot and lead details.
2. **Judge** — a second LLM call checks the draft against seven rules: correct address, date, time, lead name, no unfilled placeholders, professional tone, no invented details.
3. **Retry** — if the draft fails, it is retried once with the judge's feedback injected into the prompt.

This catches hallucinated details and generic placeholders without requiring manual review.

### 4. Humanised error messages

If both draft attempts fail the judge, a third LLM call translates the raw failure reason into a short, friendly clarification question for the property manager. The admin never sees internal error strings — only actionable plain-English prompts.

## Setup Instructions

### Prerequisites

- Node.js v18+
- Google AI Studio API key — free at [aistudio.google.com](https://aistudio.google.com)
- Firebase project with Firestore enabled (Spark plan is sufficient)
- Google Cloud project with the Gmail API and Calendar API enabled
- OAuth 2.0 Client ID from Google Cloud Console → APIs & Services → Credentials

### Installation

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Create your environment file
cp .env.example .env

# 3. Fill in all .env values (see Environment Variables below)

# 4. Add your Firebase service account
#    Firebase Console → Project Settings → Service Accounts → Generate new private key
#    Save the downloaded file as backend/firebase-service-account.json
#    (this file is gitignored — never commit it)

# 5. Start the dev server
npm run dev
```

The server starts on `http://localhost:3001`.

### Connecting Google (first run)

After the server starts, visit `http://localhost:3001/auth/google`. Complete the consent screen — tokens are saved to Firestore and the admin UI will show a green "Google connected" banner. Gmail and Calendar features activate automatically.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `LLM_PROVIDER` | No | `gemini` (default) or `anthropic` |
| `GEMINI_API_KEY` | Yes | From [aistudio.google.com](https://aistudio.google.com) — free tier available |
| `ANTHROPIC_API_KEY` | No | From [console.anthropic.com](https://console.anthropic.com) — alternative provider |
| `FIREBASE_PROJECT_ID` | Yes | Your Firebase project ID |
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth 2.0 Client Secret |
| `GOOGLE_REDIRECT_URI` | Yes | `http://localhost:3001/auth/google/callback` (dev) |
| `FRONTEND_URL` | Yes | `http://localhost:5173` (dev) |

## API Endpoints

### Slots

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/slots/parse` | Natural language input → structured slot preview (or clarifying question) |
| `POST` | `/api/slots/confirm` | Save confirmed slots, draft and send invitations |
| `GET` | `/api/slots/:slotId` | Fetch single slot |
| `GET` | `/api/slots/:slotId/invitations` | All invitations for a slot |

### Invitations

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/invitations/:id` | Fetch invitation |
| `POST` | `/api/invitations/:id/accept` | Accept with real-time capacity enforcement |
| `PATCH` | `/api/invitations/:id/message` | Edit AI-drafted message |

### Leads

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/leads` | List all leads |
| `POST` | `/api/leads` | Create lead (requires `name` and `email`) |
| `DELETE` | `/api/leads/:id` | Delete lead |

### Auth

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/google` | Redirect admin to Google OAuth consent screen |
| `GET` | `/auth/google/callback` | Exchange code for tokens, save to Firestore |
| `GET` | `/auth/status` | Returns `{ connected: boolean, email?: string }` |

## Running Tests

```bash
npm test
```

No API key or Firestore connection required — all LLM and Firebase calls are mocked. The two test suites cover:

- **`capacity.test.ts`** — `acceptInvitation` capacity enforcement, attendee count increment, and alternative slot handling.
- **`llm-parsing.test.ts`** — Zod schema validation for LLM responses: valid inputs accepted, invalid date/time formats, negative durations, and missing fields all rejected correctly.

## Trade-offs & What I'd Improve With More Time

**Authentication** — admin auth is Google OAuth but there is no lead-facing auth. In production, invitation links would be signed or time-limited so only the intended recipient can accept.

**Rate limiting** — LLM calls are currently sequential with fixed 2-second delays to stay within Gemini's free-tier rate limits. In production I'd replace this with a job queue (BullMQ + Redis) that handles back-pressure, exponential backoff, and real-time progress updates to the frontend.

**Token refresh** — Google OAuth tokens expire after one hour. In production I'd add middleware that detects expired tokens and refreshes them automatically using the stored `refresh_token` before each API call.

**Calendar conflict detection** — the current implementation creates calendar events but does not check for conflicts first. In production I'd query the calendar's free/busy data before confirming slots to prevent double-booking.

**Email templates** — emails are built with inline HTML strings. React Email would give richer, more maintainable templates with preview support.
