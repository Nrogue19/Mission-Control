# openclaw-dashboard/src/MissionControl.jsx Documentation

## File
`/openclaw-dashboard/src/MissionControl.jsx`

## Purpose
Main feature component for the React dashboard, handling kanban workflow UI, task editing modal, monitoring widgets, emergency controls, activity timeline, skill manager view, memory visualization, configuration validation, persisted dark mode toggling, and optional live OpenClaw API/WebSocket synchronization.

## Key Contents
- Imports shared seed datasets from `src/data.js`
- Multiple composed UI subcomponents
- State and event handlers for task interactions
- Time/date updates and dark mode side effects
- Sidebar integration of token, security, and health monitoring widgets
- Dark mode preference persistence using `localStorage` (`openclaw.darkMode`)
- Emergency control actions (stop, lockdown, safe restart, resume) with status banner
- Activity timeline tab with filtering/search in the right sidebar
- Skill & integration manager tab for security/rating visibility
- Memory manager tab with space switching, totals, graph preview, and cleanup actions
- Configuration validator tab with health score, issue quick-fix actions, and validated-file status
- Runtime-config driven data mode (`mock` vs `live`) with status/error indicators
- Seed datasets are applied only when live mode is disabled; live mode initializes empty collections until snapshot hydration
- Snapshot hydration + realtime event updates via service layer
- Monitoring widget state (`tokenUsage`, `security`, `health`) hydrated from live mission snapshot payloads
- Periodic live snapshot polling keeps monitoring metrics fresh while WebSocket handles realtime events
- Live Feed tab datasets (`feedItems`, `timelineItems`, `skillIntegrations`, `memorySpaces`, `memoryGraphLinks`, `configurationValidator`) hydrate from snapshot payloads
- API mutation calls for emergency controls and task updates/deletes when live mode is enabled
- Task interactions normalize task IDs to support numeric seed IDs and string-based live IDs consistently
- Full-width mission chat section with transcript rendering and compose form
- Chat send flow that uses live API replies when available and local fallback replies in mock mode

## When to Update
Update when dashboard interaction patterns, task flow, or layout structure changes.

## Related Files
- `openclaw-dashboard/src/MissionControl.css`
- `openclaw-dashboard/src/MonitoringComponents.jsx`
- `openclaw-dashboard/src/data.js`
- `openclaw-dashboard/src/App.test.js`
- `openclaw-dashboard/src/config/runtimeConfig.js`
- `openclaw-dashboard/src/services/openclawApiClient.js`
- `openclaw-dashboard/src/services/openclawRealtime.js`
