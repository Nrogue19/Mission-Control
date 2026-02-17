# openclaw-dashboard/mock-backend.js Documentation

## File
`/openclaw-dashboard/mock-backend.js`

## Purpose
Provides a lightweight local HTTP server that mocks required OpenClaw Mission Control API endpoints so the dashboard can run in live-data mode during local development, while bridging mission chat prompts to a real OpenClaw agent through the CLI.

## Key Contents
- Node `http` server listening on port `8787`
- WebSocket server (`ws`) attached at `/ws/mission-control`
- CORS headers for browser requests from the dashboard dev server
- Snapshot endpoint: `GET /api/mission-control/snapshot`
- Snapshot payload is built from `openclaw status --json` (agents) plus workspace file scan (`localFiles`)
- Snapshot still avoids seeded mock tasks/chat content and returns empty collections for unavailable sections
- Mission queue tasks are generated dynamically from recent OpenClaw sessions and top workspace files
- Chat endpoint: `POST /api/mission-control/chat` (forwards prompt to `openclaw agent --json` and returns assistant text)
- Emergency endpoint: `POST /api/mission-control/emergency`
- Realtime bootstrap event: sends `mission.snapshot` payload on socket connect
- Task mutation endpoints for move/update/delete compatibility
- Chat bridge fallback reply when CLI invocation or parsing fails
- Fallback `404` JSON response for unknown routes

## Runtime Variables
- `OPENCLAW_AGENT_ID` (default: `main`)
- `OPENCLAW_AGENT_TIMEOUT_MS` (default: `120000`)

## When to Update
Update when the frontend integration adds or changes OpenClaw endpoint contracts, payload shapes, or local development port expectations.

## Related Files
- `openclaw-dashboard/.env`
- `openclaw-dashboard/.env.example`
- `openclaw-dashboard/src/services/openclawApiClient.js`
- `openclaw-dashboard/src/MissionControl.jsx`
