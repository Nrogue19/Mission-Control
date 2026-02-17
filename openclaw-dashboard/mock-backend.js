const http = require('http');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Server: WebSocketServer } = require('ws');

const PORT = 8787;
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || 'main';
const OPENCLAW_AGENT_TIMEOUT_MS = Number(process.env.OPENCLAW_AGENT_TIMEOUT_MS || 120000);
const TASK_COLUMNS = new Set(['inbox', 'assigned', 'progress', 'review']);
const SOCKET_OPEN = 1;
const AGENT_COLORS = ['#ec4899', '#f59e0b', '#6366f1', '#10b981', '#ef4444', '#8b5cf6'];

const missionState = {
  tasks: null
};

let wsServer = null;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
};

const sendJson = (res, statusCode, data) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify(data));
};

const now = () => new Date().toLocaleTimeString('en-US', { hour12: false });

const escapePowerShellQuotedValue = (value) => String(value || '').replace(/'/g, "''");

const parseJsonFromCommandOutput = (outputText) => {
  const normalizedOutput = String(outputText || '').trim();
  const startIndex = normalizedOutput.indexOf('{');
  const endIndex = normalizedOutput.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }

  try {
    return JSON.parse(normalizedOutput.slice(startIndex, endIndex + 1));
  } catch {
    return null;
  }
};

const getOpenClawStatus = () =>
  new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-Command', 'openclaw status --json'],
      {
        timeout: 30000,
        maxBuffer: 4 * 1024 * 1024
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        const parsed = parseJsonFromCommandOutput(stdout);

        if (!parsed || typeof parsed !== 'object') {
          reject(new Error('OpenClaw status output could not be parsed.'));
          return;
        }

        resolve(parsed);
      }
    );
  });

const toTitleCase = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return 'Agent';
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const toAgentStatus = (ageMs) => {
  if (!Number.isFinite(ageMs)) {
    return 'idle';
  }

  return ageMs <= 5 * 60 * 1000 ? 'awake' : 'idle';
};

const toFileType = (filename) => {
  const extension = path.extname(filename).toLowerCase();

  if (['.md', '.txt', '.json', '.yaml', '.yml'].includes(extension)) {
    return 'config';
  }

  if (['.js', '.jsx', '.ts', '.tsx'].includes(extension)) {
    return 'code';
  }

  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(extension)) {
    return 'media';
  }

  return 'data';
};

const toFileIcon = (fileType) => {
  if (fileType === 'config') {
    return '[CFG]';
  }

  if (fileType === 'code') {
    return '[JS]';
  }

  if (fileType === 'media') {
    return '[IMG]';
  }

  return '[FILE]';
};

const formatFileAge = (modifiedAtMs) => {
  if (!Number.isFinite(modifiedAtMs)) {
    return 'Unknown';
  }

  const elapsedMs = Date.now() - modifiedAtMs;
  const elapsedMinutes = Math.max(1, Math.round(elapsedMs / 60000));

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min ago`;
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} hr ago`;
  }

  const elapsedDays = Math.round(elapsedHours / 24);
  return `${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`;
};

const normalizeTaskId = (value) => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const formatTaskDate = (timestampMs) => {
  if (!Number.isFinite(timestampMs)) {
    return now();
  }

  return new Date(timestampMs).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

const getRequestPath = (requestUrl = '') => {
  try {
    return new URL(requestUrl, 'http://localhost').pathname;
  } catch {
    return String(requestUrl || '').split('?')[0] || '/';
  }
};

const toTaskId = (value) => String(value ?? '').trim();

const taskIdsMatch = (left, right) => toTaskId(left) === toTaskId(right);

const stripAnsi = (value) => String(value || '').replace(/\x1B\[[0-9;]*m/g, '');

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const toNumberOrZero = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const formatAgeFromMs = (ageMs) => {
  if (!Number.isFinite(ageMs)) {
    return 'unknown';
  }

  const ageSeconds = Math.max(1, Math.floor(ageMs / 1000));
  if (ageSeconds < 60) {
    return `${ageSeconds}s ago`;
  }

  const ageMinutes = Math.floor(ageSeconds / 60);
  if (ageMinutes < 60) {
    return `${ageMinutes}m ago`;
  }

  const ageHours = Math.floor(ageMinutes / 60);
  return `${ageHours}h ago`;
};

const toAlertSeverity = (severity) => {
  const normalized = String(severity || '').toLowerCase();
  if (normalized === 'critical' || normalized === 'high') {
    return 'high';
  }

  if (normalized === 'warn' || normalized === 'warning' || normalized === 'medium') {
    return 'medium';
  }

  return 'low';
};

const cloneTasks = (tasks) => tasks.map((task) => ({ ...task }));

const buildTokenUsageData = (status) => {
  const statusByAgent = Array.isArray(status?.sessions?.byAgent) ? status.sessions.byAgent : [];

  const topConsumers = statusByAgent
    .map((entry, index) => {
      const recentSession = Array.isArray(entry?.recent) ? entry.recent[0] : null;
      const totalTokens = Math.max(
        toNumberOrZero(recentSession?.totalTokens),
        toNumberOrZero(recentSession?.inputTokens) + toNumberOrZero(recentSession?.outputTokens)
      );

      const perAgentCost = Number(((totalTokens / 1000) * 0.012).toFixed(2));
      const agentName = toTitleCase(entry?.agentId || `agent-${index + 1}`);

      return {
        agent: agentName,
        tokens: totalTokens,
        cost: perAgentCost,
        color: AGENT_COLORS[index % AGENT_COLORS.length]
      };
    })
    .filter((entry) => entry.tokens > 0)
    .sort((left, right) => right.tokens - left.tokens)
    .slice(0, 5);

  const totalTokensToday = topConsumers.reduce((accumulator, entry) => accumulator + entry.tokens, 0);
  const safeTotalTokens = totalTokensToday > 0 ? totalTokensToday : 50000;
  const costToday = Number(((safeTotalTokens / 1000) * 0.012).toFixed(2));
  const budget = 25;

  const weeklyTrend = [0.72, 0.79, 0.84, 0.91, 0.95, 0.98, 1].map((factor) => (
    Math.max(1000, Math.round(safeTotalTokens * factor))
  ));

  const budgetUsagePercent = (costToday / budget) * 100;
  const suggestions = [];

  if (budgetUsagePercent >= 85) {
    suggestions.push('Shift high-throughput agents to a lower-cost model tier.');
  }

  if (topConsumers[0]) {
    suggestions.push(`Review context size for ${topConsumers[0].agent} to reduce token usage.`);
  }

  if (suggestions.length === 0) {
    suggestions.push('Token usage is healthy. Continue current execution profile.');
  }

  return {
    today: safeTotalTokens,
    cost: costToday,
    budget,
    topConsumers,
    weeklyTrend,
    suggestions
  };
};

const buildSecurityData = (status) => {
  const securityAudit = status?.securityAudit && typeof status.securityAudit === 'object'
    ? status.securityAudit
    : {};
  const summary = securityAudit?.summary && typeof securityAudit.summary === 'object'
    ? securityAudit.summary
    : {};

  const criticalCount = toNumberOrZero(summary.critical);
  const warnCount = toNumberOrZero(summary.warn);
  const infoCount = toNumberOrZero(summary.info);
  const score = clampNumber(100 - (criticalCount * 22) - (warnCount * 8) - (infoCount * 3), 30, 100);

  const findings = Array.isArray(securityAudit?.findings) ? securityAudit.findings : [];
  const alerts = findings
    .filter((finding) => {
      const severity = toAlertSeverity(finding?.severity);
      return severity === 'high' || severity === 'medium';
    })
    .slice(0, 4)
    .map((finding) => {
      const severity = toAlertSeverity(finding?.severity);
      return {
        severity,
        message: finding?.title || finding?.checkId || 'Security finding detected',
        action: severity === 'high' ? 'Mitigate' : 'Review'
      };
    });

  const channelSummary = Array.isArray(status?.channelSummary) ? status.channelSummary : [];
  const normalizedChannels = channelSummary
    .map((entry) => stripAnsi(entry))
    .filter((entry) => entry.includes(':'));

  const apiKeys = normalizedChannels.slice(0, 4).map((channelLine, index) => {
    const [namePart, statusPart] = channelLine.split(':');
    const normalizedStatus = String(statusPart || '').trim().toLowerCase();
    const statusLabel = normalizedStatus.includes('configured') || normalizedStatus.includes('active')
      ? 'active'
      : 'warning';

    return {
      name: String(namePart || `Channel ${index + 1}`).trim(),
      status: statusLabel,
      expires: `${30 + (index * 15)}d`,
      exposed: statusLabel !== 'active'
    };
  });

  if (apiKeys.length === 0) {
    apiKeys.push({ name: 'Gateway Auth', status: 'active', expires: 'n/a', exposed: false });
  }

  const recentActivity = findings.slice(0, 3).map((finding) => ({
    time: 'just now',
    agent: 'System',
    action: finding?.title || finding?.checkId || 'Security audit event'
  }));

  return {
    score,
    alerts,
    apiKeys,
    recentActivity
  };
};

const toFeedStatus = (column) => {
  if (column === 'assigned') {
    return 'green';
  }

  return 'yellow';
};

const toFeedAction = (column) => {
  if (column === 'progress') {
    return 'task in progress';
  }

  if (column === 'review') {
    return 'task in review';
  }

  if (column === 'assigned') {
    return 'task assigned';
  }

  return 'task queued';
};

const toTimelineTime = (timestampMs) => {
  if (!Number.isFinite(timestampMs)) {
    return now();
  }

  return new Date(timestampMs).toLocaleTimeString('en-US', { hour12: false });
};

const buildFeedItems = ({ tasks, agents, statusSessions }) => {
  const fallbackAgent = agents[0]?.name || 'System';
  const taskItems = tasks.slice(0, 6).map((task) => ({
    agent: task.assignee || fallbackAgent,
    action: toFeedAction(task.column),
    message: task.title,
    time: task.time || now(),
    status: toFeedStatus(task.column)
  }));

  if (taskItems.length >= 4) {
    return taskItems;
  }

  const sessionItems = statusSessions.slice(0, 4).map((session) => ({
    agent: toTitleCase(session.agentId || fallbackAgent),
    action: session.abortedLastRun ? 'session flagged' : 'session active',
    message: `Model ${session.model || 'unknown'} running at ${session.percentUsed ?? 0}% context.`,
    time: toTimelineTime(session.updatedAt),
    status: session.abortedLastRun ? 'yellow' : 'green'
  }));

  return [...taskItems, ...sessionItems].slice(0, 8);
};

const buildTimelineItems = ({ status, tasks, statusSessions }) => {
  const timeline = [];

  statusSessions.slice(0, 5).forEach((session, index) => {
    const sessionId = String(session.sessionId || `session-${index}`).slice(0, 8);
    timeline.push({
      id: `timeline-session-${sessionId}-${index}`,
      time: toTimelineTime(session.updatedAt),
      agent: toTitleCase(session.agentId || 'system'),
      type: session.abortedLastRun ? 'error' : 'workflow',
      action: session.abortedLastRun ? `Session ${sessionId} interrupted` : `Session ${sessionId} active`,
      detail: `Model ${session.model || 'unknown'} • ${session.percentUsed ?? 0}% context used.`
    });
  });

  tasks.slice(0, 4).forEach((task, index) => {
    timeline.push({
      id: `timeline-task-${toTaskId(task.id)}-${index}`,
      time: task.time || now(),
      agent: task.assignee || 'System',
      type: task.column === 'review' ? 'task' : 'workflow',
      action: `${toFeedAction(task.column)}: ${task.title}`,
      detail: task.description
    });
  });

  const findings = Array.isArray(status?.securityAudit?.findings)
    ? status.securityAudit.findings
    : [];

  findings.slice(0, 3).forEach((finding, index) => {
    timeline.push({
      id: `timeline-security-${index}`,
      time: now(),
      agent: 'System',
      type: 'security',
      action: finding?.title || finding?.checkId || 'Security audit finding',
      detail: finding?.detail || 'Review security audit details.'
    });
  });

  return timeline.slice(0, 12);
};

const buildSkillIntegrations = ({ status, workspaceFiles, tasks }) => {
  const warningCount = toNumberOrZero(status?.securityAudit?.summary?.warn);
  const reviewTaskCount = tasks.filter((task) => task.column === 'review').length;
  const hasScriptFiles = workspaceFiles.some((file) => String(file.name || '').toLowerCase().endsWith('.ps1'));
  const hasMarkdownFiles = workspaceFiles.some((file) => String(file.name || '').toLowerCase().endsWith('.md'));

  return [
    {
      id: 'orchestration-core',
      name: 'Orchestration Core',
      version: '3.2.0',
      rating: 5,
      security: warningCount > 2 ? 'review' : 'safe',
      summary: 'Coordinates mission tasks, queue updates, and realtime orchestration events.',
      permissions: ['tasks.move', 'tasks.update', 'websocket.broadcast'],
      updateAvailable: false
    },
    {
      id: 'workspace-intel',
      name: 'Workspace Intel',
      version: hasScriptFiles ? '2.0.1' : '1.9.4',
      rating: hasMarkdownFiles ? 5 : 4,
      security: hasScriptFiles ? 'review' : 'safe',
      summary: 'Indexes local workspace files for mission context and quick retrieval.',
      permissions: ['filesystem.read', 'filesystem.metadata'],
      updateAvailable: hasScriptFiles
    },
    {
      id: 'policy-guard',
      name: 'Policy Guard',
      version: '1.4.8',
      rating: Math.max(3, 5 - Math.min(2, warningCount)),
      security: warningCount > 0 || reviewTaskCount > 0 ? 'review' : 'safe',
      summary: 'Validates config and security posture against active policy checks.',
      permissions: ['security.audit.read', 'config.validate'],
      updateAvailable: warningCount > 0
    }
  ];
};

const buildMemorySpaces = ({ status, tasks, workspaceFiles, tokenUsage }) => {
  const sessionCount = toNumberOrZero(status?.sessions?.count);
  const fileCount = workspaceFiles.length;
  const activeTaskCount = tasks.length;
  const tokenVolume = toNumberOrZero(tokenUsage?.today);
  const tokenScale = tokenVolume > 0 ? tokenVolume / 100000 : 1;

  return [
    {
      id: 'openclaw-core',
      name: 'OpenClaw Core',
      sizeMb: Number((6 + (tokenScale * 2)).toFixed(1)),
      entries: Math.max(1200, Math.round(tokenVolume / 10)),
      staleEntries: Math.max(20, Math.round(sessionCount * 8)),
      clusters: ['Agents', 'Sessions', 'Policies', 'Telemetry']
    },
    {
      id: 'workspace-context',
      name: 'Workspace Context',
      sizeMb: Number((4 + (fileCount * 0.35)).toFixed(1)),
      entries: fileCount * 180,
      staleEntries: Math.max(8, Math.round(fileCount * 0.18)),
      clusters: ['Files', 'Scripts', 'Docs', 'Runbooks']
    },
    {
      id: 'mission-queue',
      name: 'Mission Queue',
      sizeMb: Number((3 + (activeTaskCount * 0.4)).toFixed(1)),
      entries: activeTaskCount * 120,
      staleEntries: Math.max(4, tasks.filter((task) => task.column === 'review').length * 12),
      clusters: ['Inbox', 'Assigned', 'Progress', 'Review']
    }
  ];
};

const buildMemoryGraphLinks = () => ([
  { from: 'OpenClaw Core', to: 'Mission Queue' },
  { from: 'Mission Queue', to: 'Workspace Context' },
  { from: 'Workspace Context', to: 'Policies' },
  { from: 'Policies', to: 'OpenClaw Core' },
  { from: 'Agents', to: 'Mission Queue' }
]);

const buildConfigurationValidator = ({ status, workspaceFiles, tasks }) => {
  const findings = Array.isArray(status?.securityAudit?.findings)
    ? status.securityAudit.findings
    : [];
  const warningFindings = findings.filter((finding) => toAlertSeverity(finding?.severity) === 'medium');
  const highFindings = findings.filter((finding) => toAlertSeverity(finding?.severity) === 'high');
  const reviewTaskCount = tasks.filter((task) => task.column === 'review').length;

  const issues = [];

  warningFindings.slice(0, 2).forEach((finding, index) => {
    issues.push({
      id: `warn-${index}`,
      severity: 'warning',
      title: finding?.title || 'Policy warning detected',
      suggestion: finding?.remediation || 'Review policy settings and apply recommendation.',
      autoFixLabel: 'Auto Fix',
      status: 'open'
    });
  });

  if (highFindings[0]) {
    issues.push({
      id: 'review-critical-0',
      severity: 'review',
      title: highFindings[0].title || 'Critical security review required',
      suggestion: highFindings[0].remediation || 'Escalate this finding for manual review.',
      autoFixLabel: 'Review',
      status: 'open'
    });
  }

  if (reviewTaskCount > 0) {
    issues.push({
      id: 'review-queue-health',
      severity: 'review',
      title: `${reviewTaskCount} mission task(s) waiting in Review`,
      suggestion: 'Approve or reassign review-column tasks to maintain flow.',
      autoFixLabel: 'Review',
      status: 'open'
    });
  }

  if (issues.length === 0) {
    issues.push({
      id: 'warning-config-sync',
      severity: 'warning',
      title: 'No active configuration issues detected',
      suggestion: 'Run periodic validation to keep this state healthy.',
      autoFixLabel: 'Recheck',
      status: 'fixed'
    });
  }

  const validatedFiles = workspaceFiles.slice(0, 8).map((file) => ({
    name: file.name,
    status: String(file.name || '').toLowerCase().endsWith('.ps1') ? 'warning' : 'valid'
  }));

  const healthScore = clampNumber(100 - (warningFindings.length * 6) - (highFindings.length * 18) - (reviewTaskCount * 4), 45, 100);

  return {
    healthScore,
    issues,
    validatedFiles
  };
};

const readWorkspaceFiles = (workspaceDir) => {
  if (!workspaceDir || !fs.existsSync(workspaceDir)) {
    return [];
  }

  const entries = fs.readdirSync(workspaceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .slice(0, 40);

  return entries.map((entry) => {
    const filePath = path.join(workspaceDir, entry.name);
    const stats = fs.statSync(filePath);
    const fileType = toFileType(entry.name);

    return {
      name: entry.name,
      description: `Workspace file (${fileType})`,
      icon: toFileIcon(fileType),
      type: fileType,
      lastModified: formatFileAge(stats.mtimeMs),
      path: filePath,
      stats: stats
    };
  });
};

const buildLiveTasks = ({ statusAgents, statusSessions, workspaceFiles }) => {
  const tasks = [];
  const seenTaskIds = new Set();
  const fallbackAssignee = statusAgents[0] ? toTitleCase(statusAgents[0].id) : null;

  const pushTaskIfUnique = (task) => {
    const normalizedId = toTaskId(task?.id);
    if (!normalizedId || seenTaskIds.has(normalizedId)) {
      return;
    }

    seenTaskIds.add(normalizedId);
    tasks.push(task);
  };

  const workspaceTasks = Array.isArray(workspaceFiles)
    ? workspaceFiles.slice(0, 6).map((file, index) => ({
      id: `workspace-${normalizeTaskId(file.name || `file-${index}`)}`,
      column: index < 2 ? 'assigned' : 'inbox',
      title: `Review ${file.name}`,
      description: `Inspect ${file.name} and confirm workspace docs/config stay aligned with mission goals.`,
      time: file.lastModified || now(),
      assignee: index < 2 ? fallbackAssignee : null,
      assigneeInitial: index < 2 && fallbackAssignee ? fallbackAssignee.charAt(0).toUpperCase() : null
    }))
    : [];

  workspaceTasks.forEach(pushTaskIfUnique);

  return tasks;
};

const buildHealthData = ({ status, agents, tasks, workspaceFiles }) => {
  const statusAgents = Array.isArray(status?.agents?.agents) ? status.agents.agents : [];
  const auditFindings = Array.isArray(status?.securityAudit?.findings) ? status.securityAudit.findings : [];

  const agentsHealth = agents.map((agent) => {
    const matchingStatus = statusAgents.find((statusAgent) => (
      toTitleCase(statusAgent?.id) === String(agent.name || '').trim()
    ));

    const ageMs = toNumberOrZero(matchingStatus?.lastActiveAgeMs);
    const isAwake = agent.status === 'awake';
    const isHealthy = isAwake && ageMs <= 2 * 60 * 1000;
    const health = isHealthy ? 'healthy' : (isAwake ? 'degraded' : 'idle');
    const responseMs = clampNumber(Math.round((ageMs / 8) + 110), 80, 2500);
    const successRate = clampNumber(99 - Math.floor(ageMs / 45000), 65, 99);
    const cpuUsage = clampNumber((health === 'healthy' ? 25 : 55) + Math.floor(ageMs / 120000), 8, 95);
    const assignedTasks = tasks.filter((task) => String(task.assignee || '').trim() === agent.name).length;

    return {
      name: agent.name,
      health,
      lastHeartbeat: formatAgeFromMs(ageMs),
      responseTime: `${responseMs}ms`,
      successRate,
      cpuUsage,
      tasks: `${assignedTasks}/5`
    };
  });

  const healthyCount = agentsHealth.filter((agent) => agent.health === 'healthy').length;
  const degradedCount = agentsHealth.filter((agent) => agent.health === 'degraded' || agent.health === 'idle').length;
  const downCount = Math.max(0, agentsHealth.length - healthyCount - degradedCount);

  const gatewayLatency = toNumberOrZero(status?.gateway?.connectLatencyMs);
  const workspaceCount = Array.isArray(workspaceFiles) ? workspaceFiles.length : 0;
  const warnCount = toNumberOrZero(status?.securityAudit?.summary?.warn);

  const systemHealth = [
    {
      name: 'Gateway',
      status: status?.gateway?.reachable ? 'operational' : 'degraded',
      latency: gatewayLatency > 0 ? `${gatewayLatency}ms` : 'n/a'
    },
    {
      name: 'Workspace',
      status: workspaceCount > 0 ? 'accessible' : 'degraded',
      latency: `${workspaceCount} files`
    },
    {
      name: 'Security Audit',
      status: warnCount > 0 ? 'degraded' : 'operational',
      latency: `${warnCount} warnings`
    },
    {
      name: 'Sessions',
      status: toNumberOrZero(status?.sessions?.count) > 0 ? 'connected' : 'degraded',
      latency: `${toNumberOrZero(status?.sessions?.count)} active`
    }
  ];

  const recentErrors = auditFindings
    .filter((finding) => {
      const severity = toAlertSeverity(finding?.severity);
      return severity === 'high' || severity === 'medium';
    })
    .slice(0, 3)
    .map((finding) => ({
      agent: 'System',
      error: finding?.title || finding?.checkId || 'Health warning',
      count: 1
    }));

  return {
    healthy: healthyCount,
    degraded: degradedCount,
    down: downCount,
    systemHealth,
    recentErrors,
    agents: agentsHealth
  };
};

const requestOpenClawReply = (messageText) =>
  new Promise((resolve, reject) => {
    const escapedAgent = escapePowerShellQuotedValue(OPENCLAW_AGENT_ID);
    const escapedMessage = escapePowerShellQuotedValue(messageText);
    const command = `openclaw agent --agent '${escapedAgent}' --message '${escapedMessage}' --json`;

    execFile(
      'powershell.exe',
      ['-NoProfile', '-Command', command],
      {
        timeout: OPENCLAW_AGENT_TIMEOUT_MS,
        maxBuffer: 4 * 1024 * 1024
      },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        const parsed = parseJsonFromCommandOutput(stdout);
        const payloadText = parsed?.result?.payloads?.find((payload) => typeof payload?.text === 'string' && payload.text.trim())?.text;

        if (payloadText && payloadText.trim()) {
          resolve(payloadText.trim());
          return;
        }

        reject(new Error('OpenClaw agent response did not include payload text.'));
      }
    );
  });

const isSessionContinuationTask = (task) => {
  const taskId = String(task?.id || '').toLowerCase();
  const taskTitle = String(task?.title || '').toLowerCase();
  return taskId.startsWith('session-') || taskTitle.startsWith('continue session ') || taskTitle.startsWith('review session ');
};

const initializeMissionTasks = (generatedTasks) => {
  if (missionState.tasks === null) {
    missionState.tasks = cloneTasks(generatedTasks);
    return missionState.tasks;
  }

  const sanitizedTasks = missionState.tasks.filter((task) => !isSessionContinuationTask(task));
  if (sanitizedTasks.length !== missionState.tasks.length) {
    missionState.tasks = sanitizedTasks;
  }

  return missionState.tasks;
};

const broadcastRealtimeEvent = (event) => {
  if (!wsServer) {
    return;
  }

  const serializedEvent = JSON.stringify(event);
  wsServer.clients.forEach((client) => {
    if (client.readyState === SOCKET_OPEN) {
      client.send(serializedEvent);
    }
  });
};

const broadcastTasksReplace = () => {
  broadcastRealtimeEvent({
    type: 'mission.tasks.replace',
    payload: {
      tasks: cloneTasks(missionState.tasks || [])
    }
  });
};

const buildSnapshot = async () => {
  try {
    const status = await getOpenClawStatus();
    const statusAgents = Array.isArray(status?.agents?.agents)
      ? status.agents.agents
      : [];
    const statusSessions = Array.isArray(status?.sessions?.recent)
      ? status.sessions.recent
      : [];
    const workspaceDir = statusAgents[0]?.workspaceDir || '';
    const localFiles = readWorkspaceFiles(workspaceDir);

    const agents = statusAgents.map((agent) => {
      const name = toTitleCase(agent.id);
      return {
        name,
        role: 'OpenClaw Agent',
        status: toAgentStatus(agent.lastActiveAgeMs),
        initial: name.charAt(0).toUpperCase()
      };
    });

    const generatedTasks = buildLiveTasks({ statusAgents, statusSessions, workspaceFiles: localFiles });
    const tasks = initializeMissionTasks(generatedTasks);
    const tokenUsage = buildTokenUsageData(status);
    const security = buildSecurityData(status);
    const health = buildHealthData({ status, agents, tasks, workspaceFiles: localFiles });
    const feedItems = buildFeedItems({ tasks, agents, statusSessions });
    const timelineItems = buildTimelineItems({ status, tasks, statusSessions });
    const skillIntegrations = buildSkillIntegrations({ status, workspaceFiles: localFiles, tasks });
    const memorySpaces = buildMemorySpaces({ status, tasks, workspaceFiles: localFiles, tokenUsage });
    const memoryGraphLinks = buildMemoryGraphLinks();
    const configurationValidator = buildConfigurationValidator({ status, workspaceFiles: localFiles, tasks });

    return {
      agents,
      localFiles,
      tasks: cloneTasks(tasks),
      feedItems,
      timelineItems,
      chatMessages: [],
      skillIntegrations,
      memorySpaces,
      memoryGraphLinks,
      configurationValidator,
      tokenUsage,
      security,
      health
    };
  } catch {
    if (missionState.tasks === null) {
      missionState.tasks = [];
    }

    return {
      agents: [],
      localFiles: [],
      tasks: cloneTasks(missionState.tasks),
      feedItems: buildFeedItems({ tasks: cloneTasks(missionState.tasks), agents: [], statusSessions: [] }),
      timelineItems: buildTimelineItems({ status: {}, tasks: cloneTasks(missionState.tasks), statusSessions: [] }),
      chatMessages: [],
      skillIntegrations: buildSkillIntegrations({ status: {}, workspaceFiles: [], tasks: cloneTasks(missionState.tasks) }),
      memorySpaces: buildMemorySpaces({ status: {}, tasks: cloneTasks(missionState.tasks), workspaceFiles: [], tokenUsage: buildTokenUsageData({}) }),
      memoryGraphLinks: buildMemoryGraphLinks(),
      configurationValidator: buildConfigurationValidator({ status: {}, workspaceFiles: [], tasks: cloneTasks(missionState.tasks) }),
      tokenUsage: buildTokenUsageData({}),
      security: buildSecurityData({}),
      health: buildHealthData({
        status: {},
        agents: [],
        tasks: cloneTasks(missionState.tasks),
        workspaceFiles: []
      })
    };
  }
};

const ensureTaskState = async () => {
  if (missionState.tasks === null) {
    await buildSnapshot();
  }

  return missionState.tasks;
};

const readBody = (req) =>
  new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        resolve({});
      }
    });
  });

const server = http.createServer(async (req, res) => {
  const requestPath = getRequestPath(req.url);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (requestPath === '/api/mission-control/snapshot' && req.method === 'GET') {
    const snapshot = await buildSnapshot();
    sendJson(res, 200, snapshot);
    return;
  }

  if (requestPath === '/api/mission-control/chat' && req.method === 'POST') {
    const body = await readBody(req);
    const message = String(body.message || '').trim();

    if (!message) {
      sendJson(res, 400, {
        error: 'Message is required.'
      });
      return;
    }

    try {
      const openClawReplyText = await requestOpenClawReply(message);

      sendJson(res, 200, {
        reply: {
          id: `reply-${Date.now()}`,
          role: 'assistant',
          author: 'OpenClaw',
          message: openClawReplyText,
          time: now()
        }
      });
    } catch (error) {
      sendJson(res, 200, {
        reply: {
          id: `reply-local-${Date.now()}`,
          role: 'assistant',
          author: 'Jarvis',
          message: `OpenClaw agent bridge failed (${error?.message || 'unknown error'}). Fallback reply: ${message}`,
          time: now()
        }
      });
    }

    return;
  }

  if (requestPath === '/api/mission-control/emergency' && req.method === 'POST') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (requestPath === '/api/mission-control/tasks/move' && req.method === 'POST') {
    await ensureTaskState();
    const body = await readBody(req);
    const taskId = toTaskId(body.taskId);
    const nextColumn = String(body.column || '').trim();

    if (!taskId || !TASK_COLUMNS.has(nextColumn)) {
      sendJson(res, 400, { error: 'taskId and valid column are required.' });
      return;
    }

    const taskIndex = missionState.tasks.findIndex((task) => taskIdsMatch(task.id, taskId));
    if (taskIndex === -1) {
      sendJson(res, 404, { error: 'Task not found.' });
      return;
    }

    missionState.tasks = missionState.tasks.map((task) => (
      taskIdsMatch(task.id, taskId)
        ? { ...task, column: nextColumn }
        : task
    ));

    broadcastTasksReplace();
    sendJson(res, 200, { ok: true, tasks: cloneTasks(missionState.tasks) });
    return;
  }

  if (requestPath.startsWith('/api/mission-control/tasks/') && (req.method === 'PUT' || req.method === 'DELETE')) {
    await ensureTaskState();
    const taskId = decodeURIComponent(requestPath.slice('/api/mission-control/tasks/'.length));

    if (!taskId) {
      sendJson(res, 400, { error: 'Task ID is required.' });
      return;
    }

    const taskIndex = missionState.tasks.findIndex((task) => taskIdsMatch(task.id, taskId));

    if (req.method === 'DELETE') {
      if (taskIndex === -1) {
        sendJson(res, 404, { error: 'Task not found.' });
        return;
      }

      missionState.tasks = missionState.tasks.filter((task) => !taskIdsMatch(task.id, taskId));
      broadcastTasksReplace();
      sendJson(res, 200, { ok: true, tasks: cloneTasks(missionState.tasks) });
      return;
    }

    const body = await readBody(req);
    const incomingTask = body?.task;

    if (!incomingTask || typeof incomingTask !== 'object') {
      sendJson(res, 400, { error: 'Task payload is required.' });
      return;
    }

    if (taskIndex === -1) {
      sendJson(res, 404, { error: 'Task not found.' });
      return;
    }

    const currentTask = missionState.tasks[taskIndex];
    const updatedTask = {
      ...currentTask,
      ...incomingTask,
      id: currentTask.id,
      column: TASK_COLUMNS.has(String(incomingTask.column || '').trim())
        ? String(incomingTask.column).trim()
        : currentTask.column
    };

    missionState.tasks = missionState.tasks.map((task, index) => (index === taskIndex ? updatedTask : task));
    broadcastTasksReplace();
    sendJson(res, 200, { ok: true, task: { ...updatedTask }, tasks: cloneTasks(missionState.tasks) });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

wsServer = new WebSocketServer({
  server,
  path: '/ws/mission-control'
});

wsServer.on('connection', (socket) => {
  buildSnapshot().then((snapshot) => {
    socket.send(
      JSON.stringify({
        type: 'mission.snapshot',
        payload: snapshot
      })
    );
  });
});

server.listen(PORT, () => {
  console.log(`Mock OpenClaw backend running at http://localhost:${PORT}`);
});