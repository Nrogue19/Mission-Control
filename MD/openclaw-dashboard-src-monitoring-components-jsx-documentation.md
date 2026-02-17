# openclaw-dashboard/src/MonitoringComponents.jsx Documentation

## File
`/openclaw-dashboard/src/MonitoringComponents.jsx`

## Purpose
Houses the dashboard monitoring widgets for token consumption, security status, and agent health.

## Key Contents
- `TokenUsageMonitor` component
- `SecurityDashboard` component
- `AgentHealthMonitor` component
- Data normalization and fallback defaults for token/security/health payloads
- Alert dismissal behavior in security panel
- Live health rendering based on backend snapshot telemetry (no random simulated updates)

## When to Update
Update when monitoring UI, metrics, or alert behavior changes.

## Related Files
- `openclaw-dashboard/src/MonitoringStyles.css`
- `openclaw-dashboard/src/MissionControl.jsx`
