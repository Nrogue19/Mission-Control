import React, { useEffect, useMemo, useState } from 'react';

const DEFAULT_TOKEN_USAGE = {
  today: 0,
  cost: 0,
  budget: 25,
  topConsumers: [],
  weeklyTrend: [0, 0, 0, 0, 0, 0, 0],
  suggestions: ['Waiting for live token usage data...']
};

const DEFAULT_SECURITY = {
  score: 100,
  alerts: [],
  apiKeys: [],
  recentActivity: []
};

const DEFAULT_HEALTH = {
  healthy: 0,
  degraded: 0,
  down: 0,
  systemHealth: [],
  recentErrors: [],
  agents: []
};

const toNumber = (value, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const getScoreColor = (score) => {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
};

const getSeverityColor = (severity) => {
  if (severity === 'high') return '#ef4444';
  if (severity === 'medium') return '#f59e0b';
  return '#3b82f6';
};

const getHealthColor = (health) => {
  if (health === 'healthy') return '#10b981';
  if (health === 'degraded' || health === 'idle') return '#f59e0b';
  return '#ef4444';
};

export const TokenUsageMonitor = ({ data, isExpanded, onToggle }) => {
  const tokenData = useMemo(() => {
    const incomingData = data && typeof data === 'object' ? data : DEFAULT_TOKEN_USAGE;

    return {
      ...DEFAULT_TOKEN_USAGE,
      ...incomingData,
      today: toNumber(incomingData.today, DEFAULT_TOKEN_USAGE.today),
      cost: toNumber(incomingData.cost, DEFAULT_TOKEN_USAGE.cost),
      budget: Math.max(1, toNumber(incomingData.budget, DEFAULT_TOKEN_USAGE.budget)),
      topConsumers: Array.isArray(incomingData.topConsumers) ? incomingData.topConsumers : [],
      weeklyTrend: Array.isArray(incomingData.weeklyTrend) && incomingData.weeklyTrend.length > 0
        ? incomingData.weeklyTrend
        : DEFAULT_TOKEN_USAGE.weeklyTrend,
      suggestions: Array.isArray(incomingData.suggestions) && incomingData.suggestions.length > 0
        ? incomingData.suggestions
        : DEFAULT_TOKEN_USAGE.suggestions
    };
  }, [data]);

  const budgetPercent = (tokenData.cost / tokenData.budget) * 100;
  const budgetColor = getScoreColor(100 - Math.min(100, budgetPercent));
  const trendMaxValue = Math.max(...tokenData.weeklyTrend, 1);

  return (
    <div className="monitor-section">
      <div className="monitor-header" onClick={onToggle}>
        <div className="monitor-title">
          <span>💰</span>
          <span>TOKEN USAGE</span>
        </div>
        <span className={`monitor-toggle ${isExpanded ? 'open' : ''}`}>▼</span>
      </div>

      {isExpanded && (
        <div className="monitor-content">
          <div className="token-summary">
            <div className="token-stat">
              <div className="token-value">{(tokenData.today / 1000000).toFixed(2)}M</div>
              <div className="token-label">Tokens Today</div>
            </div>
            <div className="token-stat">
              <div className="token-value" style={{ color: budgetColor }}>
                ${tokenData.cost.toFixed(2)}
              </div>
              <div className="token-label">Cost Today</div>
            </div>
          </div>

          <div className="budget-bar">
            <div className="budget-fill" style={{
              width: `${Math.min(budgetPercent, 100)}%`,
              background: budgetColor
            }}></div>
          </div>
          <div className="budget-text">
            {budgetPercent.toFixed(0)}% of ${tokenData.budget}/day budget
          </div>

          <div className="top-consumers">
            <div className="section-label">Top Consumers</div>
            {tokenData.topConsumers.length > 0 ? tokenData.topConsumers.map((consumer, idx) => (
              <div key={`${consumer.agent}-${idx}`} className="consumer-item">
                <div className="consumer-avatar" style={{ background: consumer.color || '#6366f1' }}>
                  {String(consumer.agent || '?').charAt(0)}
                </div>
                <div className="consumer-info">
                  <div className="consumer-name">{consumer.agent}</div>
                  <div className="consumer-usage">
                    {(toNumber(consumer.tokens) / 1000).toFixed(0)}K tokens • ${toNumber(consumer.cost).toFixed(2)}
                  </div>
                </div>
              </div>
            )) : (
              <div className="activity-item-small">No token consumers reported yet.</div>
            )}
          </div>

          <div className="trend-chart">
            <div className="section-label">7 Day Trend</div>
            <div className="mini-chart">
              {tokenData.weeklyTrend.map((value, idx) => {
                const height = (toNumber(value) / trendMaxValue) * 100;
                return (
                  <div key={idx} className="chart-bar" style={{ height: `${height}%` }}></div>
                );
              })}
            </div>
            <div className="chart-labels">
              <span>7d</span>
              <span>Today</span>
            </div>
          </div>

          <div className="suggestions">
            <div className="section-label">💡 Suggestions</div>
            {tokenData.suggestions.map((suggestion, index) => (
              <div key={`${suggestion}-${index}`} className="suggestion-item">
                • {suggestion}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const SecurityDashboard = ({ data, isExpanded, onToggle }) => {
  const securityData = useMemo(() => {
    const incomingData = data && typeof data === 'object' ? data : DEFAULT_SECURITY;

    return {
      ...DEFAULT_SECURITY,
      ...incomingData,
      score: Math.max(0, Math.min(100, toNumber(incomingData.score, DEFAULT_SECURITY.score))),
      alerts: Array.isArray(incomingData.alerts) ? incomingData.alerts : [],
      apiKeys: Array.isArray(incomingData.apiKeys) ? incomingData.apiKeys : [],
      recentActivity: Array.isArray(incomingData.recentActivity) ? incomingData.recentActivity : []
    };
  }, [data]);

  const [dismissedAlertIndexes, setDismissedAlertIndexes] = useState([]);

  useEffect(() => {
    setDismissedAlertIndexes([]);
  }, [securityData.alerts]);

  const visibleAlerts = securityData.alerts.filter((_, index) => !dismissedAlertIndexes.includes(index));

  return (
    <div className="monitor-section">
      <div className="monitor-header" onClick={onToggle}>
        <div className="monitor-title">
          <span>🛡️</span>
          <span>SECURITY</span>
        </div>
        <span className={`monitor-toggle ${isExpanded ? 'open' : ''}`}>▼</span>
      </div>

      {isExpanded && (
        <div className="monitor-content">
          <div className="security-score">
            <div className="score-circle">
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path
                  className="circle-bg"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle"
                  strokeDasharray={`${securityData.score}, 100`}
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  style={{ stroke: getScoreColor(securityData.score) }}
                />
              </svg>
              <div className="score-text">{securityData.score}</div>
            </div>
            <div className="score-label">Security Score</div>
          </div>

          {visibleAlerts.length > 0 && (
            <div className="security-alerts">
              <div className="section-label">⚠️ Alerts</div>
              {visibleAlerts.map((alert, idx) => {
                const originalIndex = securityData.alerts.findIndex((candidate) => candidate === alert);

                return (
                  <div key={`${alert.message || 'alert'}-${idx}`} className="alert-item" style={{
                    borderLeftColor: getSeverityColor(alert.severity)
                  }}>
                    <div className="alert-message">{alert.message}</div>
                    <button
                      className="alert-action"
                      onClick={() => setDismissedAlertIndexes((current) => [...current, originalIndex])}
                    >
                      {alert.action || 'Resolve'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="api-keys">
            <div className="section-label">🔑 API Keys</div>
            {securityData.apiKeys.length > 0 ? securityData.apiKeys.map((key, idx) => (
              <div key={`${key.name || 'key'}-${idx}`} className="api-key-item">
                <div className="key-info">
                  <div className="key-name">
                    {key.exposed ? '⚠️' : '✅'} {key.name}
                  </div>
                  <div className="key-expires">Expires: {key.expires || 'n/a'}</div>
                </div>
                {key.exposed && (
                  <button className="key-action danger">REVOKE</button>
                )}
              </div>
            )) : (
              <div className="activity-item-small">No key status data available.</div>
            )}
          </div>

          <div className="recent-activity-security">
            <div className="section-label">📊 Recent Activity</div>
            {securityData.recentActivity.length > 0 ? securityData.recentActivity.slice(0, 3).map((activity, idx) => (
              <div key={`${activity.action || 'activity'}-${idx}`} className="activity-item-small">
                • {activity.time}: {activity.agent} {activity.action}
              </div>
            )) : (
              <div className="activity-item-small">No security events in the current window.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const AgentHealthMonitor = ({ agents, data, isExpanded, onToggle }) => {
  const normalizedHealthData = useMemo(() => {
    const incomingData = data && typeof data === 'object' ? data : DEFAULT_HEALTH;
    const fallbackAgents = Array.isArray(agents) ? agents : [];

    const derivedAgents = fallbackAgents.map((agent) => ({
      name: agent.name,
      health: agent.status === 'awake' ? 'healthy' : 'idle',
      lastHeartbeat: agent.status === 'awake' ? 'just now' : '1m ago',
      responseTime: agent.status === 'awake' ? '180ms' : '1.1s',
      successRate: agent.status === 'awake' ? 98 : 88,
      cpuUsage: agent.status === 'awake' ? 18 : 42,
      tasks: agent.status === 'awake' ? '2/5' : '0/5'
    }));

    const agentsWithHealth = Array.isArray(incomingData.agents) && incomingData.agents.length > 0
      ? incomingData.agents
      : derivedAgents;

    const healthy = incomingData.healthy ?? agentsWithHealth.filter((agent) => agent.health === 'healthy').length;
    const degraded = incomingData.degraded ?? agentsWithHealth.filter((agent) => agent.health !== 'healthy').length;

    return {
      ...DEFAULT_HEALTH,
      ...incomingData,
      healthy,
      degraded,
      down: incomingData.down ?? Math.max(0, agentsWithHealth.length - healthy - degraded),
      systemHealth: Array.isArray(incomingData.systemHealth) ? incomingData.systemHealth : [],
      recentErrors: Array.isArray(incomingData.recentErrors) ? incomingData.recentErrors : [],
      agents: agentsWithHealth
    };
  }, [agents, data]);

  return (
    <div className="monitor-section">
      <div className="monitor-header" onClick={onToggle}>
        <div className="monitor-title">
          <span>🏥</span>
          <span>HEALTH</span>
        </div>
        <span className={`monitor-toggle ${isExpanded ? 'open' : ''}`}>▼</span>
      </div>

      {isExpanded && (
        <div className="monitor-content">
          <div className="health-summary">
            <div className="health-stat">
              <div className="health-value" style={{ color: '#10b981' }}>
                ✅ {normalizedHealthData.healthy}
              </div>
              <div className="health-label">Healthy</div>
            </div>
            <div className="health-stat">
              <div className="health-value" style={{ color: '#f59e0b' }}>
                ⚠️ {normalizedHealthData.degraded}
              </div>
              <div className="health-label">Degraded</div>
            </div>
            <div className="health-stat">
              <div className="health-value" style={{ color: '#ef4444' }}>
                🔴 {normalizedHealthData.down}
              </div>
              <div className="health-label">Down</div>
            </div>
          </div>

          <div className="agents-health-list">
            {normalizedHealthData.agents.slice(0, 3).map((agent, idx) => (
              <div key={`${agent.name || 'agent'}-${idx}`} className="agent-health-card">
                <div className="agent-health-header">
                  <div className="agent-health-status" style={{
                    background: getHealthColor(agent.health)
                  }}></div>
                  <div className="agent-health-name">{agent.name}</div>
                  <div className="agent-health-time">{agent.lastHeartbeat}</div>
                </div>
                <div className="agent-health-metrics">
                  <span>Response: {agent.responseTime}</span>
                  <span>Success: {toNumber(agent.successRate)}%</span>
                  <span>CPU: {toNumber(agent.cpuUsage)}%</span>
                </div>
                {(agent.health === 'degraded' || agent.health === 'idle') ? (
                  <div className="agent-health-warning">
                    ⚠️ Agent is running below healthy threshold.
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="system-health">
            <div className="section-label">🖥️ System Status</div>
            {normalizedHealthData.systemHealth.length > 0 ? normalizedHealthData.systemHealth.map((systemItem, idx) => (
              <div key={`${systemItem.name || 'system'}-${idx}`} className="system-item">
                <span className="system-name">
                  {systemItem.status === 'operational' || systemItem.status === 'connected' || systemItem.status === 'accessible' ? '✅' : '⚠️'} {systemItem.name}
                </span>
                <span className="system-latency">{systemItem.latency}</span>
              </div>
            )) : (
              <div className="activity-item-small">System health telemetry not available yet.</div>
            )}
          </div>

          {normalizedHealthData.recentErrors.length > 0 && (
            <div className="recent-errors">
              <div className="section-label">🐛 Recent Errors</div>
              {normalizedHealthData.recentErrors.map((error, idx) => (
                <div key={`${error.error || 'error'}-${idx}`} className="error-item">
                  • {error.agent}: {error.error} ({toNumber(error.count, 1)}x)
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
