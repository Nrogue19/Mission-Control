# openclaw-custom Standalone Documentation

## Folder
`/openclaw-custom`

## Purpose
Provides a standalone, custom-runner clone of the existing OpenClaw Mission Board so you can iterate on your own version without breaking the original `openclaw-dashboard` app.

## Isolation Strategy
- Frontend runs on port `3100`
- Backend runs on port `8797`
- Frontend live-data env points to `http://localhost:8797`
- WebSocket env points to `ws://localhost:8797`
- Backend reads `.env` directly to support Telegram and runtime settings in standalone mode
- `OPENCLAW_STANDALONE_MODE=true` by default so status/chat logic runs without OpenClaw CLI
- Optional bridge mode remains available (`OPENCLAW_STANDALONE_MODE=false`) to use real OpenClaw CLI when installed

## Standalone Feature Completeness
- Full dashboard UI preserved (kanban, feed, monitoring, memory/config panels, chat)
- Agent/task CRUD + realtime WebSocket updates preserved
- Mission chat history persistence preserved across polling/reconnects
- Synthetic status/session telemetry generated in standalone mode to keep monitoring widgets fully populated

### Intelligent Chat Engine
- Context-aware assistant that understands natural language (greetings, questions, commands)
- Responds to: status, tasks, agents, files, metrics, priorities, help, identity, time, Telegram info
- Conversation memory (last 20 messages) for contextual replies
- Reads live mission state (tasks, agents, workspace files) for every reply
- No more generic "Standalone mode processed" fallbacks — every message gets a meaningful response

### Workspace Files
- All 10 OpenClaw `.md` files auto-scaffolded on first startup:
  - `USER.md`, `AGENT.md`, `AGENTS.md`, `HEARTBEAT.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `BOOTSTRAP.md`, `MEMORY.md`, `CRON.md`
- Workspace file viewer/editor modal in the frontend (view, edit, save, create, delete)
- Full workspace file CRUD API:
  - `GET /api/mission-control/workspace/files` — list all workspace files
  - `GET /api/mission-control/workspace/file/:name` — read file content
  - `PUT /api/mission-control/workspace/file/:name` — update file content
  - `POST /api/mission-control/workspace/file` — create new file
  - `DELETE /api/mission-control/workspace/file/:name` — delete file

### Telegram Integration (Multi-Channel)
- Bidirectional chat sync with Telegram (when bot token is set)
- Multi-channel support: add, switch, and remove channels at runtime
- Auto-discovers channels from incoming messages
- Telegram Settings modal accessible from the header (📱 button)
- Send test messages to verify connection
- Telegram channel management API:
  - `GET /api/mission-control/telegram/status` — bot status + channels
  - `GET /api/mission-control/telegram/channels` — list known channels
  - `POST /api/mission-control/telegram/channels` — add a channel
  - `POST /api/mission-control/telegram/channels/switch` — switch active channel
  - `DELETE /api/mission-control/telegram/channels/:id` — remove a channel
  - `POST /api/mission-control/telegram/test` — send test message

## Validation Performed
- Backend syntax check: `node --check mock-backend.js` — passed
- Production build: `npm run build` — compiled successfully, zero warnings
- Full API smoke test suite (21/21 passed):
  - snapshot, chat (hello, status, help, hey guys, are you down, tasks, files, agents, metrics, priorities, who are you, thanks, no response), telegram status, telegram channels, telegram add channel, workspace files, workspace read, agents list, task move

## Key Files Updated
- `openclaw-custom/package.json`
- `openclaw-custom/package-lock.json`
- `openclaw-custom/.env`
- `openclaw-custom/.env.example`
- `openclaw-custom/mock-backend.js`
- `openclaw-custom/telegramService.js`
- `openclaw-custom/README.md`
- `openclaw-custom/src/MissionControl.jsx`
- `openclaw-custom/src/MissionControl.css`
- `openclaw-custom/src/services/openclawApiClient.js`

## Run Commands
```bash
npm install
npm run start:standalone
```

## Compatibility Notes
- Keeps parity with current mission features by cloning current implementation.
- Can run in parallel with `openclaw-dashboard` because ports are isolated.

## Related Files
- `openclaw-dashboard/`
- `RUN DASHBOARD.md`
- `PROJECT_STRUCTURE.md`
- `SUMMARY.md`
