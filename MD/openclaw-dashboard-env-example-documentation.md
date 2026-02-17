# openclaw-dashboard/.env.example Documentation

## File
`/openclaw-dashboard/.env.example`

## Purpose
Template environment file showing how to enable and configure live OpenClaw API/WebSocket integration in local development.

## Key Contents
- `REACT_APP_OPENCLAW_LIVE_DATA` toggle
- API base URL (`REACT_APP_OPENCLAW_API_BASE_URL`)
- Optional explicit WebSocket URL (`REACT_APP_OPENCLAW_WS_URL`)
- API timeout (`REACT_APP_OPENCLAW_API_TIMEOUT_MS`)

## When to Update
Update when runtime integration variables are added, renamed, or behavior changes.

## Related Files
- `openclaw-dashboard/src/config/runtimeConfig.js`
- `openclaw-dashboard/src/services/openclawApiClient.js`
- `openclaw-dashboard/src/services/openclawRealtime.js`
