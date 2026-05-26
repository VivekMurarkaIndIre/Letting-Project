# Lette Backend

Express + TypeScript API powering the AI-native viewing slot manager.

## Setup

### Prerequisites
- Node.js v22+
- Google AI Studio API key (free at aistudio.google.com — 15 RPM free tier)
- Firebase project with Firestore enabled
- Google Cloud project with Gmail API + Google Calendar API enabled
- OAuth 2.0 credentials

### Installation

```bash
cd backend
npm install
cp .env.example .env
# Fill in all values — see Environment Variables below
# Add firebase-service-account.json to backend/ (never commit this)
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `LLM_PROVIDER` | No | `gemini` (default) or `anthropic` |
| `GEMINI_API_KEY` | Yes | From aistudio.google.com |
| `ANTHROPIC_API_KEY` | No | From console.anthropic.com |
| `FIREBASE_PROJECT_ID` | No | Only needed locally (read from service account in prod) |
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth 2.0 Client Secret |
| `GOOGLE_REDIRECT_URI` | Yes | `http://localhost:3001/auth/google/callback` (dev) |
| `FRONTEND_URL` | Yes | `http://localhost:5173` (dev) |

### Firebase Service Account (Local)

Download from Firebase Console → Project Settings → Service Accounts → Generate new private key. Save as `backend/firebase-service-account.json`. This file is gitignored — never commit it.

### Connecting Google (first run)

After the server starts, visit `http://localhost:3001/auth/google`. Complete the consent screen — tokens are saved to Firestore and the admin UI shows a green "Google connected" banner.

## Running Tests

```bash
npm test
```

No API key required. All LLM and Firebase calls are mocked.

## API Endpoints

### Slots
- `POST /api/slots/parse` — natural language → structured preview
- `POST /api/slots/confirm` — save slots + draft invitations
- `GET /api/slots/:slotId` — get single slot
- `GET /api/slots/:slotId/invitations` — get invitations for slot

### Invitations
- `GET /api/invitations/:id` — get invitation
- `POST /api/invitations/:id/accept` — accept with capacity enforcement
- `PATCH /api/invitations/:id/message` — edit AI drafted message

### Leads
- `GET /api/leads` — list all leads
- `POST /api/leads` — create lead
- `DELETE /api/leads/:id` — delete lead

### Auth
- `GET /auth/google` — initiate Google OAuth
- `GET /auth/google/callback` — OAuth callback
- `GET /auth/status` — check connection status

## Deployment (Railway)

Critical lessons learned deploying to Railway:

**1. Firebase credentials**

Do NOT split the service account into individual env vars (`FIREBASE_PRIVATE_KEY` etc). The private key newline escaping causes parsing failures. Instead store the entire JSON as one variable:

```
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":...}
```

Get the minified JSON:
```bash
cat firebase-service-account.json | python3 -m json.tool --compact
```

**2. Node version**

Railway defaults to Node 18 regardless of `.nvmrc` or `railway.toml`. Set this as a Railway Variable (not just a config file):

```
NIXPACKS_NODE_VERSION=22
```

**3. uuid version**

`uuid` v9+ is ESM-only and incompatible with CommonJS builds. Pin to v8:

```bash
npm install uuid@8 @types/uuid@8
```

**4. Build deps**

Railway runs `npm install --omit=dev` by default. Move `typescript`, `ts-node`, `nodemon`, and all `@types/*` to `dependencies` (not `devDependencies`) so they are available during the build step.
