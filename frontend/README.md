# Lette Frontend — AI-Powered Viewing Slot Manager

## Overview

React + TypeScript frontend for the Lette take-home challenge. A property manager uses a chat interface to create viewing slots and draft invitation emails via AI. Leads receive a direct link to an invitation acceptance page. Built with Vite, Ant Design, and React Router.

## Key Design Decisions

### 1. Chat interface instead of forms

The AI is the primary interface. The admin describes what they want in natural language ("set up 3 viewings for 22 Maple Street next Tuesday") rather than filling in structured fields. The backend handles ambiguity resolution — if the request is unclear, the assistant asks a clarifying question before presenting a confirmation card.

### 2. Both views mounted simultaneously (CSS display toggle)

The admin tab and invitee tab are both rendered at all times; the inactive one is hidden with `display: none` rather than being unmounted. This preserves the full chat state — messages, parsed slots, confirmation cards — when the admin switches tabs to preview an invitation and then switches back.

### 3. Confirmation card anchored to chat message

When the LLM parses a scheduling request, the confirmation card is rendered inline below the specific assistant bubble that prompted it. If the admin asks a follow-up question (triggering another parse round), the card remains anchored to the original message, keeping the conversation coherent.

### 4. URL-based invitation routing

Invitation emails contain a direct link: `/invite/:invitationId`. React Router handles this route and `InviteePage` auto-loads the invitation from the URL param on mount. The page works standalone — no tab bar, no admin UI — so leads see only their invitation details and an accept button.

## Setup Instructions

```bash
# 1. Install dependencies
cd frontend
npm install

# 2. Make sure the backend is running on port 3001
# (see backend/README.md)

# 3. Start the dev server
npm run dev
```

The app opens at `http://localhost:5173`.

## Pages

| Route | Description |
|---|---|
| `/` | Admin chat interface with leads panel on the right |
| `/invite/:invitationId` | Lead-facing invitation page — loaded from email link |

## Trade-offs & What I'd Improve With More Time

**No real admin auth** — the admin view is open to anyone who visits the URL. In production I'd gate it behind a Google login (the OAuth flow is already in the backend) and redirect unauthenticated users.

**Hardcoded API URL** — all `axios` calls point to `http://localhost:3001`. In production I'd use a `VITE_API_URL` environment variable so the same build can talk to different backend environments without code changes.

**No optimistic UI** — confirmation and acceptance actions wait for the server round-trip before updating the UI. For the invitation accept flow in particular, optimistic updates would make the interaction feel much faster.

**No message editing UI** — the backend has a `PATCH /api/invitations/:id/message` endpoint that lets an admin edit AI-drafted messages before they are sent, but there is no corresponding UI for it yet. This would be a natural addition to the slot detail view.
