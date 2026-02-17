import React, { useState, useEffect } from 'react';

// Token Usage Monitor Component
export const TokenUsageMonitor = ({ isExpanded, onToggle }) => {
  const [tokenData] = useState({
    today: 1200000,
    cost: 18.50,
    budget: 25.00,
    topConsumers: [
      { agent: 'Jarvis', tokens: 450000, cost: 6.75, color: '#ec4899' },
      { agent: 'Friday', tokens: 320000, cost: 4.80, color: '#f59e0b' },
      { agent: 'Vision', tokens: 280000, cost: 4.20, color: '#6366f1' }
    ],
    weeklyTrend: [800000, 950000, 1100000, 1300000, 1200000, 1400000, 1200000]
  });

  const budgetPercent = (tokenData.cost / tokenData.budget) * 100;
  const getBudgetColor = () => {
    if (budgetPercent >= 90) return '#ef4444';
    if (budgetPercent >= 75) return '#f59e0b';
    return '#10b981';
  };

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
              <div className="token-value">{(tokenData.today / 1000000).toFixed(1)}M</div>
              <div className="token-label">Tokens Today</div>
            </div>
            <div className="token-stat">
              <div className="token-value" style={{ color: getBudgetColor() }}>
                ${tokenData.cost.toFixed(2)}
              </div>
              <div className="token-label">Cost Today</div>
            </div>
          </div>

          <div className="budget-bar">
            <div className="budget-fill" style={{ 
              width: `${Math.min(budgetPercent, 100)}%`,
              background: getBudgetColor()
            }}></div>
          </div>
          <div className="budget-text">
            {budgetPercent.toFixed(0)}% of ${tokenData.budget}/day budget
          </div>

          <div className="top-consumers">
            <div className="section-label">Top Consumers</div>
            {tokenData.topConsumers.map((consumer, idx) => (
              <div key={idx} className="consumer-item">
                <div className="consumer-avatar" style={{ background: consumer.color }}>
                  {consumer.agent[0]}
                </div>
                <div className="consumer-info">
                  <div className="consumer-name">{consumer.agent}</div>
                  <div className="consumer-usage">
                    {(consumer.tokens / 1000).toFixed(0)}K tokens • ${consumer.cost.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="trend-chart">
            <div className="section-label">7 Day Trend</div>
            <div className="mini-chart">
              {tokenData.weeklyTrend.map((value, idx) => {
                const height = (value / Math.max(...tokenData.weeklyTrend)) * 100;
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
            <div className="suggestion-item">
              • Switch Jarvis to Claude Sonnet (-40% cost)
            </div>
            <div className="suggestion-item">
              • Reduce Friday's context window (-20% tokens)
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Security Dashboard Component
export const SecurityDashboard = ({ isExpanded, onToggle }) => {
  const [securityData] = useState({
    score: 85,
    alerts: [
      { severity: 'high', message: 'API Key exposed in logs', action: 'Fix Now' },
      { severity: 'medium', message: 'Untrusted skill "WebScraper"', action: 'Review' }
    ],
    apiKeys: [
      { name: 'OpenAI', status: 'active', expires: '30d', exposed: false },
      { name: 'Anthropic', status: 'active', expires: '45d', exposed: false },
      { name: 'Google', status: 'warning', expires: '15d', exposed: true }
    ],
    skills: [
      { name: 'EmailSender', rating: 5, safe: true },
      { name: 'WebScraper', rating: 3, safe: false },
      { name: 'FileManager', rating: 5, safe: true }
    ],
    recentActivity: [
      { time: '2 min ago', agent: 'Jarvis', action: 'accessed Gmail API' },
      { time: '5 min ago', agent: 'Friday', action: 'read USER.md' },
      { time: '8 min ago', agent: 'Vision', action: 'made external API call' }
    ]
  });

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

          {securityData.alerts.length > 0 && (
            <div className="security-alerts">
              <div className="section-label">⚠️ Alerts</div>
              {securityData.alerts.map((alert, idx) => (
                <div key={idx} className="alert-item" style={{ 
                  borderLeftColor: getSeverityColor(alert.severity)
                }}>
                  <div className="alert-message">{alert.message}</div>
                  <button className="alert-action">{alert.action}</button>
                </div>
              ))}
            </div>
          )}

          <div className="api-keys">
            <div className="section-label">🔑 API Keys</div>
            {securityData.apiKeys.map((key, idx) => (
              <div key={idx} className="api-key-item">
                <div className="key-info">
                  <div className="key-name">
                    {key.exposed ? '⚠️' : '✅'} {key.name}
                  </div>
                  <div className="key-expires">Expires: {key.expires}</div>
                </div>
                {key.exposed && (
                  <button className="key-action danger">REVOKE</button>
                )}
              </div>
            ))}
          </div>

          <div className="recent-activity-security">
            <div className="section-label">📊 Recent Activity</div>
            {securityData.recentActivity.slice(0, 3).map((activity, idx) => (
              <div key={idx} className="activity-item-small">
                • {activity.time}: {activity.agent} {activity.action}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Agent Health Monitor Component
export const AgentHealthMonitor = ({ agents, isExpanded, onToggle }) => {
  const [healthData, setHealthData] = useState({
    healthy: 9,
    degraded: 2,
    down: 0,
    systemHealth: [
      { name: 'OpenAI API', status: 'operational', latency: '120ms' },
      { name: 'Anthropic API', status: 'operational', latency: '95ms' },
      { name: 'Database', status: 'connected', latency: '12%' },
      { name: 'File System', status: 'accessible', latency: '45%' }
    ],
    recentErrors: [
      { agent: 'Friday', error: 'Timeout on OpenAI call', count: 3 },
      { agent: 'Vision', error: 'Failed to read CRON.md', count: 1 }
    ]
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Update health data (in real app, this would come from WebSocket)
      setHealthData(prev => ({
        ...prev,
        systemHealth: prev.systemHealth.map(sys => ({
          ...sys,
          latency: sys.name.includes('API') 
            ? `${Math.floor(Math.random() * 50 + 80)}ms`
            : sys.latency
        }))
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Add health status to agents
  const agentsWithHealth = agents.map(agent => ({
    ...agent,
    health: agent.status === 'awake' ? 'healthy' : 'idle',
    lastHeartbeat: agent.status === 'awake' ? '2s ago' : '45s ago',
    responseTime: agent.status === 'awake' ? '234ms' : '1.2s',
    successRate: agent.status === 'awake' ? 98 : 87,
    cpuUsage: agent.status === 'awake' ? 12 : 45,
    tasks: agent.status === 'awake' ? '3/5' : '0/5'
  }));

  const getHealthColor = (health) => {
    if (health === 'healthy') return '#10b981';
    if (health === 'degraded' || health === 'idle') return '#f59e0b';
    return '#ef4444';
  };

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
                ✅ {healthData.healthy}
              </div>
              <div className="health-label">Healthy</div>
            </div>
            <div className="health-stat">
              <div className="health-value" style={{ color: '#f59e0b' }}>
                ⚠️ {healthData.degraded}
              </div>
              <div className="health-label">Degraded</div>
            </div>
            <div className="health-stat">
              <div className="health-value" style={{ color: '#ef4444' }}>
                🔴 {healthData.down}
              </div>
              <div className="health-label">Down</div>
            </div>
          </div>

          <div className="agents-health-list">
            {agentsWithHealth.slice(0, 3).map((agent, idx) => (
              <div key={idx} className="agent-health-card">
                <div className="agent-health-header">
                  <div className="agent-health-status" style={{ 
                    background: getHealthColor(agent.health)
                  }}></div>
                  <div className="agent-health-name">{agent.name}</div>
                  <div className="agent-health-time">{agent.lastHeartbeat}</div>
                </div>
                <div className="agent-health-metrics">
                  <span>Response: {agent.responseTime}</span>
                  <span>Success: {agent.successRate}%</span>
                  <span>CPU: {agent.cpuUsage}%</span>
                </div>
                {agent.health === 'degraded' || agent.health === 'idle' ? (
                  <div className="agent-health-warning">
                    ⚠️ High response time, investigating...
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="system-health">
            <div className="section-label">🖥️ System Status</div>
            {healthData.systemHealth.map((sys, idx) => (
              <div key={idx} className="system-item">
                <span className="system-name">
                  {sys.status === 'operational' || sys.status === 'connected' || sys.status === 'accessible' ? '✅' : '⚠️'} {sys.name}
                </span>
                <span className="system-latency">{sys.latency}</span>
              </div>
            ))}
          </div>

          {healthData.recentErrors.length > 0 && (
            <div className="recent-errors">
              <div className="section-label">🐛 Recent Errors</div>
              {healthData.recentErrors.map((error, idx) => (
                <div key={idx} className="error-item">
                  • {error.agent}: {error.error} ({error.count}x)
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
