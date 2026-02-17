# openclaw-dashboard/src/services/openclawRealtime.js Documentation

## File
`/openclaw-dashboard/src/services/openclawRealtime.js`

## Purpose
Encapsulates WebSocket connection lifecycle for live OpenClaw events, including status callbacks and reconnect behavior.

## Key Contents
- `createOpenClawRealtimeClient` factory
- Connection status reporting callbacks (`connecting`, `connected`, `reconnecting`, etc.)
- JSON event parsing and event callback forwarding
- Exponential backoff reconnect scheduling
- Graceful disconnect handling
- Disabled-mode no-op behavior when WS URL is unavailable

## When to Update
Update when event transport pathing, reconnect strategy, or status callback expectations change.

## Related Files
- `openclaw-dashboard/src/config/runtimeConfig.js`
- `openclaw-dashboard/src/services/openclawApiClient.js`
- `openclaw-dashboard/src/MissionControl.jsx`
