# openclaw-dashboard/package.json Documentation

## File
`/openclaw-dashboard/package.json`

## Purpose
Defines project metadata, npm scripts, dependencies, lint config, and browser support targets for the React dashboard app.

## Key Contents
- App identity (`name`, `version`, `private`)
- GitHub Pages publish target (`homepage`)
- Runtime and dev dependencies (React, react-scripts, testing libs)
- Script commands (`start`, `start:backend`, `start:live`, `build`, `predeploy`, `deploy`, `test`, `eject`)
- ESLint and browserslist config

## New Dependencies
- `react`
- `react-dom`
- `react-scripts`
- `web-vitals`
- `@testing-library/*`
- `concurrently` (dev dependency for one-command local live startup)
- `gh-pages` (dev dependency for publish)

## When to Update
Update when dependency versions, scripts, or build/test configurations change.

## Related Files
- `openclaw-dashboard/package-lock.json`
- `openclaw-dashboard/src/index.js`
