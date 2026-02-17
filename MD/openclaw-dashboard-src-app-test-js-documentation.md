# openclaw-dashboard/src/App.test.js Documentation

## File
`/openclaw-dashboard/src/App.test.js`

## Purpose
Unit test file validating critical Mission Control behaviors (rendering, task interaction, drag/drop flow, dark mode toggling, emergency controls, timeline filtering, skills manager rendering, memory visualization, and configuration validation).

## Key Contents
- Renders `<App />`
- Checks for dashboard title text (`MISSION QUEUE`)
- Opens task modal when task cards are clicked
- Verifies drag/drop moves tasks between kanban columns
- Confirms dark mode toggle applies `dark-mode` class on `document.body`
- Verifies emergency stop locks interactions and blocks task movement
- Verifies timeline tab filtering by agent
- Verifies skills tab renders integration cards and risk state
- Verifies memory tab renders manager UI and supports memory-space switching
- Verifies config tab quick-fix action updates issue status
- Verifies default integration mode renders mock-data indicators when live mode is disabled
- Verifies full-width mission chat section renders with compose input
- Verifies mission chat posts user text and local fallback assistant response in mock mode

## When to Update
Update alongside major app UI changes.

## Related Files
- `openclaw-dashboard/src/App.js`
- `openclaw-dashboard/src/setupTests.js`
