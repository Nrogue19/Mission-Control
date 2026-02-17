# openclaw-dashboard/src/data.js Documentation

## File
`/openclaw-dashboard/src/data.js`

## Purpose
Provides the single source of truth for shared seed data (agents, files, tasks, feed items, mission chat transcript, audit timeline events, skill integrations, memory spaces, graph links, and configuration validation data) used by the React dashboard.

## Key Contents
- Exported color map and entity arrays
- Stable demo schema for local development
- Canonical data consumed by `MissionControl.jsx`
- Seed timeline events for the Activity Timeline tab
- Seed mission chat transcript for the full-width chat section
- Seed skill/integration catalog for the Skills tab
- Seed memory spaces and graph links for the Memory tab
- Seed validator health/issues/file states for the Config tab

## When to Update
Update when demo data schema or default values need to align with component expectations.

## Related Files
- `openclaw-dashboard/src/MissionControl.jsx`
- `/data.js`
