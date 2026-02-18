const http = require('http');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Server: WebSocketServer } = require('ws');
const {
  TELEGRAM_ENABLED,
  notifyTelegram,
  sendChatToTelegram,
  startTelegramPolling,
  getTelegramBotInfo
} = require('./telegramService');

const PORT = 8787;
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || 'main';
const OPENCLAW_AGENT_TIMEOUT_MS = Number(process.env.OPENCLAW_AGENT_TIMEOUT_MS || 120000);
const TASK_COLUMNS = new Set(['inbox', 'assigned', 'progress', 'review']);
const SOCKET_OPEN = 1;
const AGENT_COLORS = ['#ec4899', '#f59e0b', '#6366f1', '#10b981', '#ef4444', '#8b5cf6'];
const AGENT_CONFIG_FILENAME = '.openclaw-agents.json';
const AGENT_SECRETS_FILENAME = '.openclaw-agent-secrets.json';
const AGENT_CONFIG_PATH = path.join(__dirname, AGENT_CONFIG_FILENAME);
const AGENT_SECRETS_PATH = path.join(__dirname, AGENT_SECRETS_FILENAME);
const AGENT_STATUSES = new Set(['awake', 'idle', 'working']);

const missionState = {
  tasks: null,
  chatMessages: []
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

const logTelegramError = (context, error) => {
  console.error(`${context}:`, error?.message || error);
};

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
const cloneChatMessages = (messages) => messages.map((message) => ({ ...message }));

const appendChatMessageToState = (message) => {
  if (!message || typeof message !== 'object') {
    return;
  }

  const messageId = String(message.id || '').trim();
  if (messageId && missionState.chatMessages.some((entry) => String(entry.id || '').trim() === messageId)) {
    return;
  }

  missionState.chatMessages.push({ ...message });

  if (missionState.chatMessages.length > 300) {
    missionState.chatMessages = missionState.chatMessages.slice(missionState.chatMessages.length - 300);
  }
};

const sanitizeInlineText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const toNormalizedAgentId = (value) => sanitizeInlineText(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || `agent-${Date.now()}`;

const readJsonFileSafe = (filePath, fallbackValue) => {
  if (!fs.existsSync(filePath)) {
    return fallbackValue;
  }

  try {
    const rawText = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(rawText);
    return parsed && typeof parsed === 'object' ? parsed : fallbackValue;
  } catch {
    return fallbackValue;
  }
};

const writeJsonFileSafe = (filePath, payload) => {
  const serialized = JSON.stringify(payload, null, 2);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, serialized, { encoding: 'utf8' });

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  fs.renameSync(tempPath, filePath);
};

const toAgentKeyReference = (agentName, existingReferences = []) => {
  const normalizedBase = sanitizeInlineText(agentName)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const baseName = `OPENCLAW_AGENT_${normalizedBase || 'CUSTOM'}_API_KEY`;
  const normalizedExisting = new Set(existingReferences.map((value) => String(value || '').toUpperCase()));

  if (!normalizedExisting.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  let nextName = `${baseName}_${suffix}`;
  while (normalizedExisting.has(nextName)) {
    suffix += 1;
    nextName = `${baseName}_${suffix}`;
  }

  return nextName;
};

const redactApiKey = (value) => {
  const normalized = String(value || '');
  if (normalized.length <= 8) {
    return '********';
  }

  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
};

const isAllowedByPattern = (value, minLength, maxLength, pattern) => (
  value.length >= minLength
  && value.length <= maxLength
  && pattern.test(value)
);

const validateIncomingAgentPayload = (payload) => {
  const normalizedName = sanitizeInlineText(payload?.name);
  const normalizedRole = sanitizeInlineText(payload?.role);
  const normalizedModel = sanitizeInlineText(payload?.model);
  const apiKey = String(payload?.apiKey || '').trim();
  const errors = [];

  if (!isAllowedByPattern(normalizedName, 2, 48, /^[A-Za-z0-9 _.-]+$/)) {
    errors.push('Agent name must be 2-48 chars and can only include letters, numbers, spaces, _, -, and .');
  }

  if (!isAllowedByPattern(normalizedRole, 2, 80, /^[A-Za-z0-9 _.,/&()\-]+$/)) {
    errors.push('Role must be 2-80 chars and can only include letters, numbers, spaces, and punctuation (.,/&()-).');
  }

  if (!isAllowedByPattern(normalizedModel, 2, 80, /^[A-Za-z0-9._:/\-]+$/)) {
    errors.push('AI model must be 2-80 chars and can only include letters, numbers, ., _, :, /, and -.');
  }

  if (apiKey.length < 12 || apiKey.length > 300 || /\s/.test(apiKey)) {
    errors.push('API key must be 12-300 chars and cannot include spaces.');
  }

  return {
    errors,
    values: {
      name: normalizedName,
      role: normalizedRole,
      model: normalizedModel,
      apiKey
    }
  };
};

const validateIncomingAgentUpdatePayload = (payload) => {
  const normalizedName = sanitizeInlineText(payload?.name);
  const normalizedRole = sanitizeInlineText(payload?.role);
  const normalizedModel = sanitizeInlineText(payload?.model);
  const apiKey = String(payload?.apiKey || '').trim();
  const errors = [];

  if (!isAllowedByPattern(normalizedName, 2, 48, /^[A-Za-z0-9 _.-]+$/)) {
    errors.push('Agent name must be 2-48 chars and can only include letters, numbers, spaces, _, -, and .');
  }

  if (!isAllowedByPattern(normalizedRole, 2, 80, /^[A-Za-z0-9 _.,/&()\-]+$/)) {
    errors.push('Role must be 2-80 chars and can only include letters, numbers, spaces, and punctuation (.,/&()-).');
  }

  if (!isAllowedByPattern(normalizedModel, 2, 80, /^[A-Za-z0-9._:/\-]+$/)) {
    errors.push('AI model must be 2-80 chars and can only include letters, numbers, ., _, :, /, and -.');
  }

  if (apiKey && (apiKey.length < 12 || apiKey.length > 300 || /\s/.test(apiKey))) {
    errors.push('API key must be 12-300 chars and cannot include spaces.');
  }

  return {
    errors,
    values: {
      name: normalizedName,
      role: normalizedRole,
      model: normalizedModel,
      apiKey
    }
  };
};

const readConfiguredAgents = () => {
  const payload = readJsonFileSafe(AGENT_CONFIG_PATH, { version: 1, agents: [] });
  const rawAgents = Array.isArray(payload.agents) ? payload.agents : [];

  return rawAgents
    .map((agent, index) => {
      const name = sanitizeInlineText(agent?.name);
      const role = sanitizeInlineText(agent?.role) || 'Custom Agent';
      const model = sanitizeInlineText(agent?.model) || 'unspecified';
      const status = AGENT_STATUSES.has(String(agent?.status || '').toLowerCase())
        ? String(agent.status).toLowerCase()
        : 'working';
      const id = sanitizeInlineText(agent?.id) || `${toNormalizedAgentId(name || `agent-${index + 1}`)}-${index + 1}`;
      const apiKeyReference = sanitizeInlineText(agent?.apiKeyReference);

      if (!name) {
        return null;
      }

      return {
        id,
        name,
        role,
        model,
        status,
        apiKeyReference,
        createdAt: sanitizeInlineText(agent?.createdAt) || new Date().toISOString()
      };
    })
    .filter(Boolean);
};

const writeConfiguredAgents = (agents) => {
  writeJsonFileSafe(AGENT_CONFIG_PATH, {
    version: 1,
    updatedAt: new Date().toISOString(),
    agents
  });
};

const readConfiguredAgentSecrets = () => {
  const payload = readJsonFileSafe(AGENT_SECRETS_PATH, { version: 1, keys: {} });
  const keys = payload && typeof payload.keys === 'object' && payload.keys !== null
    ? payload.keys
    : {};

  return {
    version: 1,
    keys
  };
};

const writeConfiguredAgentSecrets = (payload) => {
  writeJsonFileSafe(AGENT_SECRETS_PATH, {
    version: 1,
    updatedAt: new Date().toISOString(),
    keys: payload.keys
  });
};

const persistConfiguredAgentState = ({
  previousAgents,
  previousSecrets,
  nextAgents,
  nextSecrets
}) => {
  try {
    writeConfiguredAgents(nextAgents);
    writeConfiguredAgentSecrets(nextSecrets);
  } catch (error) {
    try {
      writeConfiguredAgents(previousAgents);
      writeConfiguredAgentSecrets(previousSecrets);
    } catch {
      // No-op: preserve the original write failure and return it to caller.
    }

    throw error;
  }
};

const findConfiguredAgentIndexById = (agents, agentId) => (
  agents.findIndex((agent) => String(agent.id || '').trim() === String(agentId || '').trim())
);

const toDisplayAgent = (agent) => {
  const name = sanitizeInlineText(agent?.name);
  const status = AGENT_STATUSES.has(String(agent?.status || '').toLowerCase())
    ? String(agent.status).toLowerCase()
    : 'working';

  return {
    id: sanitizeInlineText(agent?.id),
    isConfigManaged: true,
    name,
    role: sanitizeInlineText(agent?.role) || 'Custom Agent',
    status,
    initial: name ? name.charAt(0).toUpperCase() : 'A',
    model: sanitizeInlineText(agent?.model) || undefined
  };
};

const mergeAgents = (runtimeAgents, configuredAgents) => {
  const mergedAgents = [];
  const indexByName = new Map();

  runtimeAgents.forEach((agent) => {
    const key = sanitizeInlineText(agent?.name).toLowerCase();
    if (!key) {
      return;
    }

    indexByName.set(key, mergedAgents.length);
    mergedAgents.push(agent);
  });

  configuredAgents.forEach((configuredAgent) => {
    const configuredDisplay = toDisplayAgent(configuredAgent);
    const key = configuredDisplay.name.toLowerCase();
    if (!key) {
      return;
    }

    const existingIndex = indexByName.get(key);
    if (existingIndex === undefined) {
      indexByName.set(key, mergedAgents.length);
      mergedAgents.push(configuredDisplay);
      return;
    }

    const existingAgent = mergedAgents[existingIndex];
    mergedAgents[existingIndex] = {
      ...existingAgent,
      id: configuredDisplay.id || existingAgent.id,
      isConfigManaged: true,
      role: configuredDisplay.role || existingAgent.role,
      status: existingAgent.status === 'awake' ? 'awake' : configuredDisplay.status,
      model: configuredDisplay.model || existingAgent.model
    };
  });

  return mergedAgents;
};

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
  const localConfigFiles = [
    { name: AGENT_CONFIG_FILENAME, status: fs.existsSync(AGENT_CONFIG_PATH) ? 'valid' : 'warning' },
    { name: AGENT_SECRETS_FILENAME, status: fs.existsSync(AGENT_SECRETS_PATH) ? 'valid' : 'warning' }
  ];

  const healthScore = clampNumber(100 - (warningFindings.length * 6) - (highFindings.length * 18) - (reviewTaskCount * 4), 45, 100);

  return {
    healthScore,
    issues,
    validatedFiles: [...validatedFiles, ...localConfigFiles]
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
    const isAwake = agent.status === 'awake' || agent.status === 'working';
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
  // Send to Telegram for important events
  if (TELEGRAM_ENABLED && event?.type && event?.action) {
    notifyTelegram(event).catch((error) => {
      console.error('Telegram notification failed:', error.message);
    });
  }

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

const buildAndBroadcastAgentSnapshot = async (fallbackAgents) => {
  let snapshot = null;

  try {
    snapshot = await buildSnapshot();
    broadcastRealtimeEvent({
      type: 'mission.agents.replace',
      payload: {
        agents: Array.isArray(snapshot?.agents) ? snapshot.agents : fallbackAgents
      }
    });
    broadcastRealtimeEvent({
      type: 'mission.snapshot',
      payload: snapshot
    });
  } catch {
    broadcastRealtimeEvent({
      type: 'mission.agents.replace',
      payload: {
        agents: fallbackAgents
      }
    });
  }

  return snapshot;
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

    const runtimeAgents = statusAgents.map((agent) => {
      const name = toTitleCase(agent.id);
      return {
        id: `runtime-${toNormalizedAgentId(agent.id)}`,
        isConfigManaged: false,
        name,
        role: 'OpenClaw Agent',
        status: toAgentStatus(agent.lastActiveAgeMs),
        initial: name.charAt(0).toUpperCase()
      };
    });
    const configuredAgents = readConfiguredAgents();
    const agents = mergeAgents(runtimeAgents, configuredAgents);

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
      chatMessages: cloneChatMessages(missionState.chatMessages),
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

    const agents = readConfiguredAgents().map((agent) => toDisplayAgent(agent));

    return {
      agents,
      localFiles: [],
      tasks: cloneTasks(missionState.tasks),
      feedItems: buildFeedItems({ tasks: cloneTasks(missionState.tasks), agents, statusSessions: [] }),
      timelineItems: buildTimelineItems({ status: {}, tasks: cloneTasks(missionState.tasks), statusSessions: [] }),
      chatMessages: cloneChatMessages(missionState.chatMessages),
      skillIntegrations: buildSkillIntegrations({ status: {}, workspaceFiles: [], tasks: cloneTasks(missionState.tasks) }),
      memorySpaces: buildMemorySpaces({ status: {}, tasks: cloneTasks(missionState.tasks), workspaceFiles: [], tokenUsage: buildTokenUsageData({}) }),
      memoryGraphLinks: buildMemoryGraphLinks(),
      configurationValidator: buildConfigurationValidator({ status: {}, workspaceFiles: [], tasks: cloneTasks(missionState.tasks) }),
      tokenUsage: buildTokenUsageData({}),
      security: buildSecurityData({}),
      health: buildHealthData({
        status: {},
        agents,
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
    const incomingMessageId = String(body.messageId || '').trim();

    if (!message) {
      sendJson(res, 400, {
        error: 'Message is required.'
      });
      return;
    }

    // Create user message for sync
    const userMessage = {
      id: incomingMessageId || `chat-user-${Date.now()}`,
      role: 'user',
      author: body.author || 'You',
      message,
      time: now()
    };

    appendChatMessageToState(userMessage);

    // Send to Telegram
    if (TELEGRAM_ENABLED) {
      sendChatToTelegram(userMessage).catch((error) => {
        logTelegramError('Telegram chat sync failed', error);
      });
    }

    // Broadcast user message to websocket clients
    broadcastRealtimeEvent({
      type: 'mission.chat.append',
      payload: userMessage
    });

    try {
      const openClawReplyText = await requestOpenClawReply(message);

      const replyMessage = {
        id: `reply-${Date.now()}`,
        role: 'assistant',
        author: 'OpenClaw',
        message: openClawReplyText,
        time: now()
      };

      appendChatMessageToState(replyMessage);

      // Send reply to Telegram
      if (TELEGRAM_ENABLED) {
        sendChatToTelegram(replyMessage).catch((error) => {
          logTelegramError('Telegram chat sync failed', error);
        });
      }

      // Broadcast reply to websocket clients
      broadcastRealtimeEvent({
        type: 'mission.chat.append',
        payload: replyMessage
      });

      sendJson(res, 200, { reply: replyMessage });
    } catch (error) {
      const fallbackReply = {
        id: `reply-local-${Date.now()}`,
        role: 'assistant',
        author: 'Jarvis',
        message: `OpenClaw agent bridge failed (${error?.message || 'unknown error'}). Fallback reply: ${message}`,
        time: now()
      };

      appendChatMessageToState(fallbackReply);

      // Send fallback reply to Telegram
      if (TELEGRAM_ENABLED) {
        sendChatToTelegram(fallbackReply).catch((error) => {
          logTelegramError('Telegram chat sync failed', error);
        });
      }

      broadcastRealtimeEvent({
        type: 'mission.chat.append',
        payload: fallbackReply
      });

      sendJson(res, 200, { reply: fallbackReply });
    }

    return;
  }

  if (requestPath === '/api/mission-control/emergency' && req.method === 'POST') {
    const body = await readBody(req);
    const action = String(body.action || '').trim() || 'unknown';

    if (TELEGRAM_ENABLED) {
      notifyTelegram({
        type: 'safety',
        action: `Emergency action: ${action}`,
        detail: 'Mission Control emergency mode was updated.',
        agent: 'System'
      }).catch((error) => {
        logTelegramError('Telegram emergency notify failed', error);
      });
    }

    sendJson(res, 200, { ok: true });
    return;
  }

  if (requestPath === '/api/mission-control/agents' && req.method === 'GET') {
    const snapshot = await buildSnapshot();
    sendJson(res, 200, { agents: snapshot.agents || [] });
    return;
  }

  if (requestPath === '/api/mission-control/agents' && req.method === 'POST') {
    const body = await readBody(req);
    const validation = validateIncomingAgentPayload(body);

    if (validation.errors.length > 0) {
      sendJson(res, 400, {
        error: validation.errors[0],
        details: validation.errors
      });
      return;
    }

    const configuredAgents = readConfiguredAgents();
    const duplicate = configuredAgents.some((agent) => (
      String(agent.name || '').toLowerCase() === validation.values.name.toLowerCase()
    ));

    if (duplicate) {
      sendJson(res, 409, { error: 'Agent name already exists in config.' });
      return;
    }

    const configuredSecrets = readConfiguredAgentSecrets();
    const existingReferences = Object.keys(configuredSecrets.keys || {});
    const apiKeyReference = toAgentKeyReference(validation.values.name, existingReferences);
    const createdAt = new Date().toISOString();

    const nextAgent = {
      id: `${toNormalizedAgentId(validation.values.name)}-${Date.now()}`,
      name: validation.values.name,
      role: validation.values.role,
      model: validation.values.model,
      status: 'working',
      apiKeyReference,
      createdAt
    };

    const nextConfiguredAgents = [...configuredAgents, nextAgent];
    const nextSecrets = {
      version: 1,
      keys: {
        ...(configuredSecrets.keys || {}),
        [apiKeyReference]: validation.values.apiKey
      }
    };

    try {
      persistConfiguredAgentState({
        previousAgents: configuredAgents,
        previousSecrets: configuredSecrets,
        nextAgents: nextConfiguredAgents,
        nextSecrets
      });
    } catch {
      sendJson(res, 500, { error: 'Failed to update agent config files.' });
      return;
    }

    const createdAgent = toDisplayAgent(nextAgent);
    const snapshot = await buildAndBroadcastAgentSnapshot([createdAgent]);

    if (TELEGRAM_ENABLED) {
      notifyTelegram({
        type: 'agent',
        action: `Agent added: ${createdAgent.name}`,
        detail: `${createdAgent.role || 'Custom Agent'} configured on ${createdAgent.model || 'unspecified'}.`,
        agent: 'System'
      }).catch((error) => {
        logTelegramError('Telegram agent-create notify failed', error);
      });
    }

    sendJson(res, 201, {
      ok: true,
      agent: {
        ...createdAgent,
        apiKeyReference,
        apiKeyPreview: redactApiKey(validation.values.apiKey)
      },
      configFiles: [AGENT_CONFIG_FILENAME, AGENT_SECRETS_FILENAME],
      snapshot
    });
    return;
  }

  if (requestPath.startsWith('/api/mission-control/agents/') && (req.method === 'PUT' || req.method === 'DELETE')) {
    const agentId = decodeURIComponent(requestPath.slice('/api/mission-control/agents/'.length)).trim();

    if (!agentId) {
      sendJson(res, 400, { error: 'Agent ID is required.' });
      return;
    }

    const configuredAgents = readConfiguredAgents();
    const configuredSecrets = readConfiguredAgentSecrets();
    const targetIndex = findConfiguredAgentIndexById(configuredAgents, agentId);

    if (targetIndex === -1) {
      sendJson(res, 404, { error: 'Config-managed agent not found.' });
      return;
    }

    const targetAgent = configuredAgents[targetIndex];

    if (req.method === 'DELETE') {
      const nextConfiguredAgents = configuredAgents.filter((candidate, index) => index !== targetIndex);
      const nextKeys = { ...(configuredSecrets.keys || {}) };

      if (targetAgent.apiKeyReference) {
        delete nextKeys[targetAgent.apiKeyReference];
      }

      try {
        persistConfiguredAgentState({
          previousAgents: configuredAgents,
          previousSecrets: configuredSecrets,
          nextAgents: nextConfiguredAgents,
          nextSecrets: {
            version: 1,
            keys: nextKeys
          }
        });
      } catch {
        sendJson(res, 500, { error: 'Failed to update agent config files.' });
        return;
      }

      const snapshot = await buildAndBroadcastAgentSnapshot(
        nextConfiguredAgents.map((agent) => toDisplayAgent(agent))
      );

      if (TELEGRAM_ENABLED) {
        notifyTelegram({
          type: 'agent',
          action: `Agent deleted: ${targetAgent.name}`,
          detail: 'Agent removed from the mission roster.',
          agent: 'System'
        }).catch((error) => {
          logTelegramError('Telegram agent-delete notify failed', error);
        });
      }

      sendJson(res, 200, {
        ok: true,
        deletedAgent: toDisplayAgent(targetAgent),
        configFiles: [AGENT_CONFIG_FILENAME, AGENT_SECRETS_FILENAME],
        snapshot
      });
      return;
    }

    const body = await readBody(req);
    const validation = validateIncomingAgentUpdatePayload(body);

    if (validation.errors.length > 0) {
      sendJson(res, 400, {
        error: validation.errors[0],
        details: validation.errors
      });
      return;
    }

    const duplicateName = configuredAgents.some((agent, index) => (
      index !== targetIndex
      && String(agent.name || '').toLowerCase() === validation.values.name.toLowerCase()
    ));

    if (duplicateName) {
      sendJson(res, 409, { error: 'Another config-managed agent already uses that name.' });
      return;
    }

    const resolvedApiKeyReference = targetAgent.apiKeyReference || toAgentKeyReference(
      validation.values.name,
      Object.keys(configuredSecrets.keys || {})
    );
    const updatedAgent = {
      ...targetAgent,
      name: validation.values.name,
      role: validation.values.role,
      model: validation.values.model,
      status: 'working',
      apiKeyReference: resolvedApiKeyReference
    };

    const nextConfiguredAgents = configuredAgents.map((agent, index) => (
      index === targetIndex ? updatedAgent : agent
    ));
    const nextKeys = { ...(configuredSecrets.keys || {}) };

    if (validation.values.apiKey) {
      nextKeys[resolvedApiKeyReference] = validation.values.apiKey;
    }

    try {
      persistConfiguredAgentState({
        previousAgents: configuredAgents,
        previousSecrets: configuredSecrets,
        nextAgents: nextConfiguredAgents,
        nextSecrets: {
          version: 1,
          keys: nextKeys
        }
      });
    } catch {
      sendJson(res, 500, { error: 'Failed to update agent config files.' });
      return;
    }

    const updatedDisplayAgent = toDisplayAgent(updatedAgent);
    const snapshot = await buildAndBroadcastAgentSnapshot(
      nextConfiguredAgents.map((agent) => toDisplayAgent(agent))
    );

    if (TELEGRAM_ENABLED) {
      notifyTelegram({
        type: 'agent',
        action: `Agent updated: ${updatedDisplayAgent.name}`,
        detail: `${updatedDisplayAgent.role || 'Custom Agent'} configured on ${updatedDisplayAgent.model || 'unspecified'}.`,
        agent: 'System'
      }).catch((error) => {
        logTelegramError('Telegram agent-update notify failed', error);
      });
    }

    sendJson(res, 200, {
      ok: true,
      agent: {
        ...updatedDisplayAgent,
        apiKeyReference: resolvedApiKeyReference,
        apiKeyPreview: resolvedApiKeyReference
          ? redactApiKey(nextKeys[resolvedApiKeyReference] || '')
          : null
      },
      configFiles: [AGENT_CONFIG_FILENAME, AGENT_SECRETS_FILENAME],
      snapshot
    });
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

    const movedTask = missionState.tasks.find((task) => taskIdsMatch(task.id, taskId));

    if (TELEGRAM_ENABLED && movedTask) {
      notifyTelegram({
        type: 'task',
        action: `Task moved: ${movedTask.title || taskId}`,
        detail: `Column changed to ${nextColumn}.`,
        agent: movedTask.assignee || 'System'
      }).catch((error) => {
        logTelegramError('Telegram task-move notify failed', error);
      });
    }

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

      const deletedTask = missionState.tasks[taskIndex];

      missionState.tasks = missionState.tasks.filter((task) => !taskIdsMatch(task.id, taskId));

      if (TELEGRAM_ENABLED && deletedTask) {
        notifyTelegram({
          type: 'task',
          action: `Task deleted: ${deletedTask.title || taskId}`,
          detail: 'Task removed from mission queue.',
          agent: deletedTask.assignee || 'System'
        }).catch((error) => {
          logTelegramError('Telegram task-delete notify failed', error);
        });
      }

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

    if (TELEGRAM_ENABLED) {
      notifyTelegram({
        type: 'task',
        action: `Task updated: ${updatedTask.title || taskId}`,
        detail: `Task saved in ${updatedTask.column || currentTask.column} column.`,
        agent: updatedTask.assignee || 'System'
      }).catch((error) => {
        logTelegramError('Telegram task-update notify failed', error);
      });
    }

    broadcastTasksReplace();
    sendJson(res, 200, { ok: true, task: { ...updatedTask }, tasks: cloneTasks(missionState.tasks) });
    return;
  }

  // Telegram status endpoint
  if (requestPath === '/api/mission-control/telegram/status' && req.method === 'GET') {
    const botInfo = await getTelegramBotInfo();
    sendJson(res, 200, {
      enabled: TELEGRAM_ENABLED,
      connected: Boolean(botInfo),
      bot: botInfo ? {
        username: botInfo.username,
        firstName: botInfo.first_name
      } : null
    });
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

// Start Telegram polling for incoming messages
let telegramPoller = null;
if (TELEGRAM_ENABLED) {
  telegramPoller = startTelegramPolling((message) => {
    appendChatMessageToState(message);

    // Broadcast incoming Telegram message to websocket clients
    broadcastRealtimeEvent({
      type: 'mission.chat.append',
      payload: message
    });
  }, 3000);

  console.log('Telegram integration enabled - polling for messages');
}

server.listen(PORT, () => {
  console.log(`Mock OpenClaw backend running at http://localhost:${PORT}`);
  if (TELEGRAM_ENABLED) {
    console.log('Telegram bot connected and syncing with Mission Board');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  if (telegramPoller) {
    telegramPoller.stop();
  }
  server.close(() => {
    process.exit(0);
  });
});
