# Lette Backend — AI-Powered Viewing Slot Manager

## Overview

The backend is an Express + TypeScript REST API that lets a property manager describe viewing slots in plain English and automatically generates personalised invitation emails for each lead. It uses Firebase Firestore for persistence, the Vercel AI SDK for structured LLM output, and Gemini 2.0 Flash as the default model — with Anthropic Claude available via a single environment variable switch.

## Architecture

The service layer is split into four focused modules:

| File | Responsibility |
|---|---|
| `services/llm.ts` | Provider-agnostic AI layer — wraps Vercel AI SDK and exposes `getModel()` and `generateObject`. Switching between Gemini and Anthropic requires only an env var change. |
| `services/slots.ts` | Parses natural-language scheduling input into structured slot objects via LLM, then persists them to Firestore. |
| `services/invitations.ts` | Drafts personalised invitation emails, runs them through an LLM-as-Judge quality check, retries with feedback on failure, and humanises any remaining errors for the admin. |
| `services/firebase.ts` | Thin Firestore helpers (`createDoc`, `getDoc`, `updateDoc`, `queryCollection`) with typed generics. Document IDs are set to the object's own UUID so lookups are predictable. |

## AI Design Decisions

### 1. Provider-agnostic LLM layer

`getModel()` reads `LLM_PROVIDER` from the environment and constructs a provider using the Vercel AI SDK's OpenAI-compatible adapter. Both Gemini (via Google's OpenAI-compat endpoint) and Anthropic Claude are supported. Swapping providers requires changing one env var — no code changes needed.

### 2. `generateObject` with Zod schemas

Every LLM call uses `generateObject` with an explicit Zod schema rather than free-form text generation. The SDK enforces the schema at the API level, so the application always receives a typed, validated object — no manual JSON parsing, no silent field omissions.

### 3. LLM-as-Judge quality layer

Every invitation message goes through a two-step process:

1. **Draft** — the LLM writes a warm, personalised email using the slot and lead details.
2. **Judge** — a second LLM call evaluates the draft against seven explicit rules (correct address, date, time, lead name, no unfilled placeholders, professional tone, no invented details).

If the draft fails, it is retried once with the judge's specific feedback injected into the prompt. This catches the most common failure modes (hallucinated details, generic sign-offs left as placeholders) without requiring manual review of every message.

### 4. Humanised error messages

If both draft attempts fail the judge, a third LLM call translates the raw technical failure reason into a short, friendly clarification question addressed to the property manager. The admin never sees internal error strings — only actionable plain-English prompts like "Could you double-check the property address?"

## Setup Instructions

### Prerequisites

- Node.js v18+
- A Google AI Studio API key — free at [aistudio.google.com](https://aistudio.google.com)
- A Firebase project with Firestore enabled (Spark plan is sufficient)

### Installation

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Create your environment file
cp .env.example .env

# 3. Fill in .env (see Environment Variables section below)

# 4. Add your Firebase service account
#    In the Firebase console: Project Settings → Service Accounts → Generate new private key
#    Save the downloaded file as backend/firebase-service-account.json
#    (this file is gitignored — never commit it)

# 5. Start the dev server
npm run dev
```

The server starts on `http://localhost:3001` by default.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `LLM_PROVIDER` | No | `gemini` (default) or `anthropic` |
| `GEMINI_API_KEY` | Yes (if gemini) | API key from [aistudio.google.com](https://aistudio.google.com) |
| `ANTHROPIC_API_KEY` | Yes (if anthropic) | API key from [console.anthropic.com](https://console.anthropic.com) |
| `FIREBASE_PROJECT_ID` | Yes | Your Firebase project ID (e.g. `my-project-12345`) |

## API Endpoints

### Slots

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/slots/parse` | Sends natural-language input to the LLM for parsing. Returns structured slot data or a clarifying question if the input is ambiguous. |
| `POST` | `/api/slots/confirm` | Creates slot documents in Firestore and generates AI-drafted invitations for all leads. Returns the created slots and invitations. |
| `GET` | `/api/slots/:slotId` | Fetches a single slot by ID. |
| `GET` | `/api/slots/:slotId/invitations` | Returns all invitations associated with a slot. |

**POST /api/slots/parse — request body**
```json
{ "input": "Set up 2 viewings for 22 Maple Street next Tuesday at 10am and 2pm" }
```

**POST /api/slots/confirm — request body**
```json
{
  "parsed": { "slots": [...], "leadNames": [...], "ambiguous": false },
  "leads": [{ "id": "...", "name": "John", "email": "john@example.com" }]
}
```

### Invitations

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/invitations/:invitationId` | Fetches a single invitation. Used by the lead-facing accept page. |
| `POST` | `/api/invitations/:invitationId/accept` | Confirms a lead's acceptance. Re-checks slot capacity at accept time; returns alternative slots if the slot is now full. |
| `PATCH` | `/api/invitations/:invitationId/message` | Lets the admin edit the AI-drafted message before sending. |

### Leads

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/leads` | Returns all leads. |
| `POST` | `/api/leads` | Creates a new lead. Requires `name` and `email`; `notes` is optional. |
| `DELETE` | `/api/leads/:leadId` | Permanently removes a lead. |

## Running Tests

```bash
npm test
```

All LLM and Firebase calls are mocked — no API key or Firestore connection is needed to run the test suite. The two test suites cover:

- **`capacity.test.ts`** — `acceptInvitation` correctly enforces slot capacity, increments attendee count, and returns alternative slots when full.
- **`llm-parsing.test.ts`** — Zod schemas correctly accept valid LLM responses and reject malformed ones (invalid date/time formats, negative durations, missing required fields).

## Trade-offs & What I'd Improve

**Authentication** — the admin API has no auth. In production I'd add JWT middleware (or Firebase Auth tokens) and scope the leads/slots endpoints to verified admin users only.

**Rate limit handling** — LLM calls are currently sequential with fixed 2-second delays between leads and slots to stay within Gemini's free-tier rate limits. In production I'd replace this with a proper job queue (e.g. BullMQ + Redis) that handles back-pressure, retries with exponential backoff, and gives the frontend real-time progress updates.

**Judge retry count** — the judge retries exactly once. A configurable `maxRetries` with exponential backoff would be more robust without adding much complexity.

**Email delivery** — invitations are stored in Firestore but not actually sent. The natural next step is to integrate a transactional email provider (Resend or SendGrid) and trigger sends from the `createInvitations` function after each message passes the judge.

**Capacity race condition** — `acceptInvitation` re-checks capacity before updating, but two concurrent accepts could both pass the check and both increment the counter. A Firestore transaction would make this atomic.
