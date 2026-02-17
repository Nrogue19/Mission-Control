# openclaw-dashboard/src/config/runtimeConfig.js Documentation

## File
`/openclaw-dashboard/src/config/runtimeConfig.js`

## Purpose
Centralized runtime environment parsing for OpenClaw integration settings (live mode toggle, API URL, WebSocket URL, and request timeout).

## Key Contents
- Boolean/number parsing helpers for CRA `REACT_APP_*` environment values
- Trailing slash normalization for base URLs
- API-to-WS URL inference when explicit WS URL is omitted
- Exported `runtimeConfig` object consumed by dashboard services/components

## Environment Variables
- `REACT_APP_OPENCLAW_LIVE_DATA`
- `REACT_APP_OPENCLAW_API_BASE_URL`
- `REACT_APP_OPENCLAW_WS_URL`
- `REACT_APP_OPENCLAW_API_TIMEOUT_MS`

## When to Update
Update when adding new environment-driven runtime behavior or changing connection defaults.

## Related Files
- `openclaw-dashboard/.env.example`
- `openclaw-dashboard/src/services/openclawApiClient.js`
- `openclaw-dashboard/src/services/openclawRealtime.js`
- `openclaw-dashboard/src/MissionControl.jsx`
