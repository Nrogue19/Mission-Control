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
- Snapshot still avoids seeded mock task/chat fixtures; unavailable sections default to empty collections
- Mission queue tasks are generated dynamically from top workspace files on first hydration (session continuation activity is kept out of the task board)
- In-memory mission task state persists move/update/delete changes across subsequent snapshot requests
- Snapshot also includes live monitoring telemetry (`tokenUsage`, `security`, `health`) derived from OpenClaw status and mission state
- Snapshot now includes dynamic Live Feed datasets (`feedItems`, `timelineItems`, `skillIntegrations`, `memorySpaces`, `memoryGraphLinks`, `configurationValidator`)
- Chat endpoint: `POST /api/mission-control/chat` (forwards prompt to `openclaw agent --json` and returns assistant text)
- Emergency endpoint: `POST /api/mission-control/emergency`
- Realtime bootstrap event: sends `mission.snapshot` payload on socket connect
- Task mutation endpoints are stateful (`POST /tasks/move`, `PUT /tasks/:id`, `DELETE /tasks/:id`) and validate IDs/columns
- Task mutations broadcast realtime `mission.tasks.replace` events over WebSocket for live queue synchronization
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
