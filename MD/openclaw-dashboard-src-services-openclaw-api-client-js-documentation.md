# openclaw-dashboard/src/services/openclawApiClient.js Documentation

## File
`/openclaw-dashboard/src/services/openclawApiClient.js`

## Purpose
Provides a dedicated HTTP client layer for OpenClaw Mission Control APIs, including snapshot fetches, chat messaging, and task/emergency mutations.

## Key Contents
- Base URL-aware endpoint builder (`buildUrl`)
- Timeout-aware fetch wrapper with JSON handling and HTTP error checks
- Snapshot fetch API (`fetchMissionSnapshot`)
- Emergency command API (`postEmergencyAction`)
- Task mutation APIs (`postTaskColumnUpdate`, `postTaskUpdate`, `deleteTaskById`)
- Mission chat send API (`postMissionChatMessage`)

## When to Update
Update when OpenClaw endpoint contracts, request payloads, or timeout/error handling behavior changes.

## Related Files
- `openclaw-dashboard/src/config/runtimeConfig.js`
- `openclaw-dashboard/src/services/openclawRealtime.js`
- `openclaw-dashboard/src/MissionControl.jsx`
