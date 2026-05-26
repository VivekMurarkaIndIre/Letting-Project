# Lette Frontend

React + Vite + TypeScript frontend for the AI-powered viewing slot manager.

## Setup

```bash
cd frontend
npm install
# Backend must be running on port 3001
npm run dev
```

## Key Design Decisions

**Chat interface, not forms**

The admin input is a chat-like text area. There are no form fields. The AI interprets natural language — this is the core UX decision.

**CSS display toggle, not conditional rendering**

Both AdminChat and InviteePage are always mounted. Tab switching uses `display: none` rather than unmounting components, preserving chat history when the admin switches tabs.

**Confirmation card anchored to message**

The slot confirmation card is tied to a specific message via `showConfirmation` on the message object, not a separate boolean state. This means the card appears under the right message even across multiple clarifying question exchanges.

**URL-based invitation routing**

`/invite/:invitationId` loads the invitation directly from the URL — matching the link in the email. React Router handles this with a `BrowserRouter` wrapper.

**Dashboard tab**

The dashboard fetches all slots and their invitations on mount with a manual refresh button. It shows a capacity progress bar per slot and colour-coded status tags (green/orange/red) per invitee. Both pages are always mounted via CSS display toggle so state is preserved.

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API URL (default: `http://localhost:3001`) |

Create `.env.development` for local:

```
VITE_API_URL=http://localhost:3001
```

## Pages

- `/` — Admin chat interface with leads management panel
- `/dashboard` — (via tab) Admin dashboard showing all slots, capacity bars, and invitation statuses per lead
- `/invite/:invitationId` — Invitee acceptance page (accessed via email link)

## Deployment (Vercel)

**SPA routing**: `vercel.json` in the frontend folder handles client-side routing:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Without this, direct navigation to `/invite/:id` returns a 404.

**Environment variable**: Set `VITE_API_URL` in the Vercel dashboard to point to the Railway backend URL.
