const http = require('http');
const https = require('https');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Server: WebSocketServer } = require('ws');

const loadEnvFromFile = (envFilePath) => {
  if (!fs.existsSync(envFilePath)) {
    return;
  }

  const envText = fs.readFileSync(envFilePath, 'utf8');
  envText.split(/\r?\n/).forEach((line) => {
    const trimmedLine = String(line || '').trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return;
    }

    const separatorIndex = trimmedLine.indexOf('=');
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const value = trimmedLine.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      return;
    }

    process.env[key] = value;
  });
};

loadEnvFromFile(path.join(__dirname, '.env'));

const {
  TELEGRAM_ENABLED,
  isTelegramReady,
  notifyTelegram,
  sendChatToTelegram,
  startTelegramPolling,
  getTelegramBotInfo,
  getKnownChannels,
  setActiveChatId,
  getActiveChatId,
  addChannel,
  removeChannel,
  sendTestMessage
} = require('./telegramService');

const PORT = Number(process.env.PORT || 8797);
const MC_AGENT_ID = process.env.MC_AGENT_ID || 'main';
const MC_AGENT_TIMEOUT_MS = Number(process.env.MC_AGENT_TIMEOUT_MS || 120000);
const TASK_COLUMNS = new Set(['inbox', 'assigned', 'progress', 'review']);
const SOCKET_OPEN = 1;
const AGENT_COLORS = ['#ec4899', '#f59e0b', '#6366f1', '#10b981', '#ef4444', '#8b5cf6'];
const AGENT_CONFIG_FILENAME = '.mc-agents.json';
const AGENT_SECRETS_FILENAME = '.mc-agent-secrets.json';
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

const parseBooleanEnv = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalized = String(value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};

const resolveStandaloneWorkspaceDir = () => {
  const rawValue = String(process.env.MC_WORKSPACE_DIR || '').trim();

  if (!rawValue || rawValue === '.') {
    return __dirname;
  }

  return path.isAbsolute(rawValue)
    ? rawValue
    : path.join(__dirname, rawValue);
};

const STANDALONE_MODE = parseBooleanEnv(process.env.MC_STANDALONE_MODE, true);
const STANDALONE_WORKSPACE_DIR = resolveStandaloneWorkspaceDir();

const STANDALONE_WORKSPACE_TEMPLATES = [
  {
    name: 'USER.md',
    type: 'config',
    description: 'User profile and preference baseline for standalone runtime.',
    content: '# USER\n\n- Name: Local Operator\n- Mode: standalone\n- Preferred style: concise and actionable\n'
  },
  {
    name: 'AGENT.md',
    type: 'config',
    description: 'Primary standalone agent configuration.',
    content: `# AGENT\n\n- agent_id: ${MC_AGENT_ID}\n- role: Mission Orchestrator\n- timeout_ms: ${MC_AGENT_TIMEOUT_MS}\n- mode: standalone\n`
  },
  {
    name: 'AGENTS.md',
    type: 'config',
    description: 'Multi-agent roster and responsibilities.',
    content: `# AGENTS\n\n## ${MC_AGENT_ID}\n- Role: Mission Orchestrator\n- Status: active\n- Workspace: ${STANDALONE_WORKSPACE_DIR}\n`
  },
  {
    name: 'HEARTBEAT.md',
    type: 'schedule',
    description: 'Health and heartbeat checklist for runtime monitoring.',
    content: '# HEARTBEAT\n\n- Verify backend API responds\n- Verify websocket stream is connected\n- Verify mission queue has no stuck review tasks\n'
  },
  {
    name: 'SOUL.md',
    type: 'config',
    description: 'Behavior profile and communication style.',
    content: '# SOUL\n\n- Tone: direct\n- Priority: reliability first\n- Principle: prefer deterministic safe operations\n'
  },
  {
    name: 'TOOLS.md',
    type: 'config',
    description: 'Tooling policy and approved action patterns.',
    content: '# TOOLS\n\n- API: mission-control REST\n- Realtime: mission-control websocket\n- Persistence: local JSON + markdown workspace context\n'
  },
  {
    name: 'IDENTITY.md',
    type: 'config',
    description: 'Standalone runtime identity document.',
    content: '# IDENTITY\n\nMission Control Standalone Runtime\n'
  },
  {
    name: 'BOOTSTRAP.md',
    type: 'schedule',
    description: 'Startup checklist for local standalone operations.',
    content: '# BOOTSTRAP\n\n1. Start backend\n2. Start frontend\n3. Verify snapshot endpoint\n4. Verify websocket connectivity\n'
  },
  {
    name: 'MEMORY.md',
    type: 'data',
    description: 'Mission memory scratchpad for persistent notes.',
    content: '# MEMORY\n\n- Keep important mission context here for manual continuity.\n'
  },
  {
    name: 'CRON.md',
    type: 'schedule',
    description: 'Scheduled mission jobs and recurring checks.',
    content: '# CRON\n\n- Every 30s: snapshot refresh\n- Every deploy: run build validation\n'
  }
];

const STANDALONE_FILE_ORDER = STANDALONE_WORKSPACE_TEMPLATES.map((template) => template.name.toUpperCase());
const STANDALONE_FILE_METADATA = STANDALONE_WORKSPACE_TEMPLATES.reduce((lookup, template) => {
  lookup[template.name.toUpperCase()] = {
    type: template.type,
    description: template.description
  };
  return lookup;
}, {});

const ensureStandaloneWorkspaceScaffold = (workspaceDir) => {
  if (!STANDALONE_MODE) {
    return;
  }

  const resolvedWorkspaceDir = String(workspaceDir || STANDALONE_WORKSPACE_DIR || '').trim();
  if (!resolvedWorkspaceDir) {
    return;
  }

  fs.mkdirSync(resolvedWorkspaceDir, { recursive: true });

  STANDALONE_WORKSPACE_TEMPLATES.forEach((template) => {
    const targetPath = path.join(resolvedWorkspaceDir, template.name);
    if (fs.existsSync(targetPath)) {
      return;
    }

    fs.writeFileSync(targetPath, template.content, { encoding: 'utf8' });
  });
};

const buildStandaloneStatus = () => {
  ensureStandaloneWorkspaceScaffold(STANDALONE_WORKSPACE_DIR);

  const configuredAgents = typeof readConfiguredAgents === 'function' ? readConfiguredAgents() : [];
  const taskCount = Array.isArray(missionState.tasks) ? missionState.tasks.length : 0;
  const reviewCount = Array.isArray(missionState.tasks)
    ? missionState.tasks.filter((task) => String(task?.column || '').trim() === 'review').length
    : 0;
  const nowMs = Date.now();

  const agentSeeds = configuredAgents.length > 0
    ? configuredAgents
    : [];

  const runtimeAgents = agentSeeds.map((agent, index) => {
    const agentId = String(agent?.id || agent?.name || `agent-${index + 1}`)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `agent-${index + 1}`;

    return {
      id: agentId,
      lastActiveAgeMs: 20000 + (index * 14000),
      workspaceDir: STANDALONE_WORKSPACE_DIR
    };
  });

  const sessionCount = Math.max(1, runtimeAgents.length);
  const recentSessions = runtimeAgents.map((agent, index) => ({
    sessionId: `standalone-${index + 1}`,
    agentId: agent.id,
    model: configuredAgents[index]?.model || 'standalone-local',
    updatedAt: nowMs - (index * 45000),
    percentUsed: 38 + (index * 8),
    abortedLastRun: false
  }));

  const byAgent = runtimeAgents.map((agent, index) => ({
    agentId: agent.id,
    recent: [{
      totalTokens: 18000 + (index * 6500),
      inputTokens: 12000 + (index * 4500),
      outputTokens: 6000 + (index * 2000)
    }]
  }));

  const warningCount = reviewCount > 0 ? Math.max(1, Math.min(3, reviewCount)) : (taskCount > 8 ? 1 : 0);

  return {
    gateway: {
      reachable: true,
      connectLatencyMs: 42
    },
    agents: {
      agents: runtimeAgents
    },
    sessions: {
      count: sessionCount,
      recent: recentSessions,
      byAgent
    },
    securityAudit: {
      summary: {
        critical: 0,
        warn: warningCount,
        info: taskCount > 0 ? 1 : 0
      },
      findings: warningCount > 0
        ? [{
          severity: 'warning',
          title: 'Standalone mode policy review',
          detail: 'Review mission tasks in the review column before shipping changes.',
          remediation: 'Complete or re-assign review tasks.'
        }]
        : []
    },
    channelSummary: [
      'Mission API: configured',
      'Realtime WS: configured',
      TELEGRAM_ENABLED ? 'Telegram: active' : 'Telegram: disabled'
    ]
  };
};

const getMissionStatus = () =>
  new Promise((resolve) => {
    if (STANDALONE_MODE) {
      resolve(buildStandaloneStatus());
      return;
    }

    execFile(
      'powershell.exe',
      ['-NoProfile', '-Command', 'mission-control status --json'],
      {
        timeout: 30000,
        maxBuffer: 4 * 1024 * 1024
      },
      (error, stdout) => {
        if (error) {
          console.warn(`Status command failed (${error.message}). Using standalone status fallback.`);
          resolve(buildStandaloneStatus());
          return;
        }

        const parsed = parseJsonFromCommandOutput(stdout);

        if (!parsed || typeof parsed !== 'object') {
          console.warn('Status output could not be parsed. Using standalone status fallback.');
          resolve(buildStandaloneStatus());
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
  const baseName = `MC_AGENT_${normalizedBase || 'CUSTOM'}_API_KEY`;
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
  const apiKey = String(payload?.apiKey || '').replace(/[\s\r\n]+/g, '');
  const errors = [];

  if (!isAllowedByPattern(normalizedName, 2, 48, /^[A-Za-z0-9 _.-]+$/)) {
    errors.push('Agent name must be 2-48 chars and can only include letters, numbers, spaces, _, -, and .');
  }

  if (!isAllowedByPattern(normalizedRole, 2, 80, /^[A-Za-z0-9 _.,/&()\-]+$/)) {
    errors.push('Role must be 2-80 chars and can only include letters, numbers, spaces, and punctuation (.,/&()-).');
  }

  if (!isAllowedByPattern(normalizedModel, 2, 80, /^[A-Za-z0-9 ._:/\-]+$/)) {
    errors.push('AI model must be 2-80 chars and can only include letters, numbers, spaces, ., _, :, /, and -.');
  }

  if (apiKey.length < 4 || apiKey.length > 500 || /\s/.test(apiKey)) {
    errors.push('API key must be 4-500 chars and cannot include spaces.');
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
  const apiKey = String(payload?.apiKey || '').replace(/[\s\r\n]+/g, '');
  const errors = [];

  if (!isAllowedByPattern(normalizedName, 2, 48, /^[A-Za-z0-9 _.-]+$/)) {
    errors.push('Agent name must be 2-48 chars and can only include letters, numbers, spaces, _, -, and .');
  }

  if (!isAllowedByPattern(normalizedRole, 2, 80, /^[A-Za-z0-9 _.,/&()\-]+$/)) {
    errors.push('Role must be 2-80 chars and can only include letters, numbers, spaces, and punctuation (.,/&()-).');
  }

  if (!isAllowedByPattern(normalizedModel, 2, 80, /^[A-Za-z0-9 ._:/\-]+$/)) {
    errors.push('AI model must be 2-80 chars and can only include letters, numbers, spaces, ., _, :, /, and -.');
  }

  if (apiKey && (apiKey.length < 4 || apiKey.length > 500 || /\s/.test(apiKey))) {
    errors.push('API key must be 4-500 chars and cannot include spaces.');
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
      id: 'mission-core',
      name: 'Mission Core',
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
  { from: 'Mission Core', to: 'Mission Queue' },
  { from: 'Mission Queue', to: 'Workspace Context' },
  { from: 'Workspace Context', to: 'Policies' },
  { from: 'Policies', to: 'Mission Core' },
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
  const resolvedWorkspaceDir = workspaceDir && fs.existsSync(workspaceDir)
    ? workspaceDir
    : STANDALONE_WORKSPACE_DIR;

  ensureStandaloneWorkspaceScaffold(resolvedWorkspaceDir);

  if (!resolvedWorkspaceDir || !fs.existsSync(resolvedWorkspaceDir)) {
    return [];
  }

  const orderLookup = new Map(STANDALONE_FILE_ORDER.map((name, index) => [name, index]));

  const entries = fs.readdirSync(resolvedWorkspaceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => !String(entry.name || '').startsWith('.'))
    .sort((left, right) => {
      const leftName = String(left.name || '').toUpperCase();
      const rightName = String(right.name || '').toUpperCase();
      const leftOrder = orderLookup.has(leftName) ? orderLookup.get(leftName) : Number.MAX_SAFE_INTEGER;
      const rightOrder = orderLookup.has(rightName) ? orderLookup.get(rightName) : Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      const leftIsMarkdown = leftName.endsWith('.MD');
      const rightIsMarkdown = rightName.endsWith('.MD');
      if (leftIsMarkdown !== rightIsMarkdown) {
        return leftIsMarkdown ? -1 : 1;
      }

      return String(left.name || '').localeCompare(String(right.name || ''));
    })
    .slice(0, 60);

  return entries.map((entry) => {
    const filePath = path.join(resolvedWorkspaceDir, entry.name);
    const stats = fs.statSync(filePath);
    const metadata = STANDALONE_FILE_METADATA[String(entry.name || '').toUpperCase()] || null;
    const fileType = metadata?.type || toFileType(entry.name);

    return {
      name: entry.name,
      description: metadata?.description || `Workspace file (${fileType})`,
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

const buildMissionContext = () => {
  const activeTasks = Array.isArray(missionState.tasks) ? missionState.tasks : [];
  const configuredAgents = typeof readConfiguredAgents === 'function' ? readConfiguredAgents() : [];
  const workspaceFiles = readWorkspaceFiles(STANDALONE_WORKSPACE_DIR);
  const mdFiles = workspaceFiles.filter((f) => f.name.toLowerCase().endsWith('.md'));

  const buckets = {
    inbox: activeTasks.filter((t) => t?.column === 'inbox'),
    assigned: activeTasks.filter((t) => t?.column === 'assigned'),
    progress: activeTasks.filter((t) => t?.column === 'progress'),
    review: activeTasks.filter((t) => t?.column === 'review')
  };

  const totalTasks = activeTasks.length;
  const agentCount = Math.max(1, configuredAgents.length);
  const agentNames = configuredAgents.map((a) => a.name).filter(Boolean);
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return { activeTasks, configuredAgents, workspaceFiles, mdFiles, buckets, totalTasks, agentCount, agentNames, timeOfDay, hour };
};

const conversationMemory = [];
const MAX_CONVERSATION_MEMORY = 20;

const addToConversationMemory = (role, text) => {
  conversationMemory.push({ role, text: String(text || '').slice(0, 500), ts: Date.now() });
  while (conversationMemory.length > MAX_CONVERSATION_MEMORY) {
    conversationMemory.shift();
  }
};

const generateIntelligentReply = (message) => {
  const ctx = buildMissionContext();
  const lower = message.toLowerCase().trim();
  const words = lower.split(/\s+/);

  // Greetings
  if (/^(hi|hey|hello|yo|sup|what'?s? up|howdy|good\s*(morning|afternoon|evening))[\s!?.]*$/i.test(lower)) {
    const greetings = [
      `Hey! Good ${ctx.timeOfDay}. I'm online and monitoring ${ctx.totalTasks} task(s) across ${ctx.agentCount} agent(s). What do you need?`,
      `What's up! Mission Control is active — ${ctx.buckets.progress.length} task(s) in progress right now. How can I help?`,
      `Hey there! All systems operational. ${ctx.agentCount} agent(s) on duty, ${ctx.totalTasks} task(s) in the pipeline. What's on your mind?`,
      `Good ${ctx.timeOfDay}! I'm here and ready. Currently tracking ${ctx.totalTasks} tasks. Ask me anything about the mission.`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // Thanks / acknowledgment
  if (/^(thanks|thank you|thx|ty|cheers|appreciate|cool|nice|great|awesome|perfect|got it|ok|okay)[\s!?.]*$/i.test(lower)) {
    const acks = [
      'Anytime! Let me know if you need anything else.',
      'You got it. I\'m here if you need me.',
      'No problem! Standing by for your next command.',
      'Happy to help. Mission Control is always watching.'
    ];
    return acks[Math.floor(Math.random() * acks.length)];
  }

  // Who are you / identity
  if (/\b(who are you|what are you|your name|identify)\b/.test(lower)) {
    return `I'm your Mission Control AI assistant — a standalone orchestrator running independently. I manage your agents, tasks, workspace files, and mission operations. No external dependencies needed. I'm fully self-contained and ready to work.`;
  }

  // Help / commands
  if (/\b(help|command|what can you do|capabilities|features)\b/.test(lower)) {
    return `Here's what I can do:\n\n` +
      `📊 **Status & Overview** — Ask "status", "overview", or "how are things"\n` +
      `📋 **Task Management** — "tasks", "what's in progress", "review blockers", "inbox"\n` +
      `🤖 **Agent Info** — "agents", "team", "who's working"\n` +
      `📁 **Workspace Files** — "files", "show workspace", "what files exist"\n` +
      `📈 **Analytics** — "throughput", "productivity", "metrics"\n` +
      `🎯 **Recommendations** — "what should I do", "priorities", "next action"\n` +
      `💬 **General Chat** — I can discuss mission strategy, planning, and more\n\n` +
      `Just talk to me naturally — I understand context.`;
  }

  // Status / overview / summary / health
  if (/\b(status|overview|summary|health|how.*(things|going|we doing|it going|everything)|sit.?rep|report)\b/.test(lower)) {
    const parts = [`📊 **Mission Status Report**\n`];
    parts.push(`🤖 **Agents:** ${ctx.agentCount} active${ctx.agentNames.length > 0 ? ` (${ctx.agentNames.join(', ')})` : ''}`);
    parts.push(`📋 **Tasks:** ${ctx.totalTasks} total`);

    if (ctx.totalTasks > 0) {
      parts.push(`  → Inbox: ${ctx.buckets.inbox.length} | Assigned: ${ctx.buckets.assigned.length} | In Progress: ${ctx.buckets.progress.length} | Review: ${ctx.buckets.review.length}`);
    }

    parts.push(`📁 **Workspace:** ${ctx.mdFiles.length} config files, ${ctx.workspaceFiles.length} total files`);

    if (ctx.buckets.review.length > 0) {
      parts.push(`\n⚠️ **Attention:** ${ctx.buckets.review.length} task(s) waiting in review — consider clearing these first.`);
    }

    if (ctx.buckets.progress.length > 0) {
      const inProgressNames = ctx.buckets.progress.map((t) => t.title).filter(Boolean).slice(0, 3);
      parts.push(`\n🔄 **Active work:** ${inProgressNames.join(', ')}`);
    }

    const uptime = Math.floor(process.uptime() / 60);
    parts.push(`\n⏱️ Runtime: ${uptime}m | Mode: Standalone | All systems green`);

    return parts.join('\n');
  }

  // Tasks - detailed
  if (/\b(tasks?|queue|kanban|backlog|board|what.*(work|doing|pending|todo))\b/.test(lower)) {
    if (ctx.totalTasks === 0) {
      return `📋 No tasks in the mission queue right now. You can add tasks from the board or ask me to help plan new ones.`;
    }

    const parts = [`📋 **Task Board Overview** (${ctx.totalTasks} total)\n`];

    if (ctx.buckets.inbox.length > 0) {
      parts.push(`📥 **Inbox (${ctx.buckets.inbox.length}):**`);
      ctx.buckets.inbox.slice(0, 5).forEach((t) => parts.push(`  • ${t.title}${t.assignee ? ` → ${t.assignee}` : ''}`));
    }

    if (ctx.buckets.assigned.length > 0) {
      parts.push(`📌 **Assigned (${ctx.buckets.assigned.length}):**`);
      ctx.buckets.assigned.slice(0, 5).forEach((t) => parts.push(`  • ${t.title}${t.assignee ? ` → ${t.assignee}` : ''}`));
    }

    if (ctx.buckets.progress.length > 0) {
      parts.push(`🔄 **In Progress (${ctx.buckets.progress.length}):**`);
      ctx.buckets.progress.slice(0, 5).forEach((t) => parts.push(`  • ${t.title}${t.assignee ? ` → ${t.assignee}` : ''}`));
    }

    if (ctx.buckets.review.length > 0) {
      parts.push(`👀 **Review (${ctx.buckets.review.length}):**`);
      ctx.buckets.review.slice(0, 5).forEach((t) => parts.push(`  • ${t.title}${t.assignee ? ` → ${t.assignee}` : ''}`));
    }

    return parts.join('\n');
  }

  // Agents / team
  if (/\b(agents?|team|roster|who.*(working|active|online|available)|crew|squad)\b/.test(lower)) {
    if (ctx.agentNames.length === 0) {
      return `🤖 No config-managed agents yet. You can add agents from the sidebar using the "+ Add Agent" button. Each agent can have its own role, model, and API key.`;
    }

    const parts = [`🤖 **Agent Roster** (${ctx.agentCount} active)\n`];
    ctx.configuredAgents.forEach((a) => {
      parts.push(`  • **${a.name}** — ${a.role || 'Custom Agent'}${a.model ? ` (${a.model})` : ''} — Status: ${a.status || 'working'}`);
    });

    return parts.join('\n');
  }

  // Review blockers
  if (/\b(reviews?|blockers?|blocked|stuck|bottleneck)\b/.test(lower)) {
    if (ctx.buckets.review.length === 0) {
      return `✅ No review blockers right now. Pipeline is clear. ${ctx.buckets.progress.length > 0 ? `${ctx.buckets.progress.length} task(s) actively in progress.` : ''}`;
    }

    const parts = [`⚠️ **Review Blockers** (${ctx.buckets.review.length} task(s) waiting)\n`];
    ctx.buckets.review.forEach((t) => {
      parts.push(`  • **${t.title}**${t.assignee ? ` — assigned to ${t.assignee}` : ' — unassigned'}`);
    });
    parts.push(`\n💡 **Recommendation:** Clear review items first to improve throughput and unblock the pipeline.`);

    return parts.join('\n');
  }

  // Files / workspace
  if (/\b(files?|workspace|configs?|\.md|documents?|what files|show files)\b/.test(lower)) {
    const parts = [`📁 **Workspace Files** (${ctx.workspaceFiles.length} total)\n`];

    ctx.mdFiles.slice(0, 12).forEach((f) => {
      parts.push(`  • **${f.name}** — ${f.description} (${f.lastModified})`);
    });

    if (ctx.workspaceFiles.length > ctx.mdFiles.length) {
      const otherCount = ctx.workspaceFiles.length - ctx.mdFiles.length;
      parts.push(`\n  + ${otherCount} other file(s)`);
    }

    parts.push(`\n💡 Click any file in the sidebar to view and edit it directly.`);

    return parts.join('\n');
  }

  // Priorities / recommendations / what should I do
  if (/\b(priorit|recommend|suggest|what should|next action|what.*(do|focus|work on)|plan)\b/.test(lower)) {
    const suggestions = [];

    if (ctx.buckets.review.length > 0) {
      suggestions.push(`🔴 **Clear ${ctx.buckets.review.length} review task(s)** — These are blocking your pipeline.`);
    }

    if (ctx.buckets.inbox.length > 0) {
      suggestions.push(`🟡 **Triage ${ctx.buckets.inbox.length} inbox task(s)** — Assign them to agents to keep work flowing.`);
    }

    if (ctx.agentNames.length === 0) {
      suggestions.push(`🤖 **Add agents** — Configure at least one agent to start delegating work.`);
    }

    if (ctx.buckets.progress.length === 0 && ctx.totalTasks > 0) {
      suggestions.push(`⚡ **Start working** — No tasks are in progress. Move assigned tasks forward.`);
    }

    if (suggestions.length === 0) {
      suggestions.push(`✅ Looking good! Pipeline is healthy. Consider adding new tasks or reviewing workspace files for optimization.`);
    }

    return `🎯 **Recommended Actions**\n\n${suggestions.join('\n')}`;
  }

  // Metrics / analytics / throughput
  if (/\b(metrics?|analytics?|throughput|productiv|performance|stats?)\b/.test(lower)) {
    const completionRate = ctx.totalTasks > 0 ? Math.round((ctx.buckets.review.length / ctx.totalTasks) * 100) : 0;
    const activeRate = ctx.totalTasks > 0 ? Math.round((ctx.buckets.progress.length / ctx.totalTasks) * 100) : 0;
    const uptime = Math.floor(process.uptime() / 60);

    return `📈 **Mission Metrics**\n\n` +
      `  • Total tasks: ${ctx.totalTasks}\n` +
      `  • Active rate: ${activeRate}% (${ctx.buckets.progress.length} in progress)\n` +
      `  • Review queue: ${completionRate}% (${ctx.buckets.review.length} pending)\n` +
      `  • Agents online: ${ctx.agentCount}\n` +
      `  • Workspace files: ${ctx.workspaceFiles.length}\n` +
      `  • Uptime: ${uptime} minutes\n` +
      `  • Mode: Standalone (fully self-contained)`;
  }

  // Telegram
  if (/\b(telegram|notification|alert|channel|chat.*(id|group))\b/.test(lower)) {
    if (TELEGRAM_ENABLED) {
      return `📱 **Telegram Integration: Active**\n\nBot is connected and syncing messages bidirectionally. Notifications are being sent for task updates, agent changes, and chat messages.\n\nYou can change the active channel from the Telegram settings in Mission Control.`;
    }
    return `📱 **Telegram Integration: Not configured**\n\nTo enable Telegram:\n1. Set \`TELEGRAM_BOT_TOKEN\` in your .env file\n2. Set \`TELEGRAM_CHAT_ID\` for the target channel/group\n3. Restart the backend\n\nYou can get a bot token from @BotFather on Telegram.`;
  }

  // Time / date
  if (/\b(time|date|day|what.*(time|day|date)|clock)\b/.test(lower)) {
    const now = new Date();
    return `🕐 Current time: ${now.toLocaleTimeString('en-US', { hour12: false })} | Date: ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`;
  }

  // Conversational fallback — actually engage with what the user said
  const recentContext = conversationMemory.slice(-4).map((m) => m.text).join(' ').toLowerCase();

  if (/\b(are you down|you there|alive|awake|online|working)\b/.test(lower)) {
    return `I'm right here and fully operational! 🟢 All systems are running. ${ctx.totalTasks > 0 ? `Currently tracking ${ctx.totalTasks} task(s).` : ''} What do you need?`;
  }

  if (/\b(no response|not working|broken|bug|error|wrong|issue)\b/.test(lower)) {
    return `I hear you — I'm working now and responding to everything. If something specific isn't working, tell me what you're seeing and I'll help troubleshoot. You can ask me about tasks, agents, files, status, or anything mission-related.`;
  }

  if (/\?$/.test(message.trim())) {
    // It's a question — try to give a helpful answer
    if (/\b(how many|count|number)\b/.test(lower)) {
      if (/task/.test(lower)) return `You have ${ctx.totalTasks} task(s) total: ${ctx.buckets.inbox.length} inbox, ${ctx.buckets.assigned.length} assigned, ${ctx.buckets.progress.length} in progress, ${ctx.buckets.review.length} in review.`;
      if (/agent/.test(lower)) return `${ctx.agentCount} agent(s) are configured${ctx.agentNames.length > 0 ? `: ${ctx.agentNames.join(', ')}` : ''}.`;
      if (/file/.test(lower)) return `${ctx.workspaceFiles.length} workspace files (${ctx.mdFiles.length} markdown config files).`;
    }

    return `Good question. Here's what I know:\n\n` +
      `• ${ctx.agentCount} agent(s) active\n` +
      `• ${ctx.totalTasks} task(s) in pipeline\n` +
      `• ${ctx.workspaceFiles.length} workspace files\n\n` +
      `Can you be more specific about what you'd like to know? I can help with tasks, agents, files, status, priorities, metrics, or Telegram setup.`;
  }

  // Smart conversational responses for general messages
  const conversational = [
    `Got it — "${message}". I'm tracking that. Is there something specific you'd like me to help with? I can manage tasks, check agent status, review files, or give you a mission overview.`,
    `Understood. I'm here and listening. For quick actions, try: "status" for an overview, "tasks" for the board, "agents" for the team, or "help" for all commands.`,
    `Roger that. Mission Control is active with ${ctx.totalTasks} task(s) and ${ctx.agentCount} agent(s). What's the next move?`,
    `Copy. I'm monitoring everything — ${ctx.buckets.progress.length} task(s) in progress, ${ctx.buckets.review.length} in review. Need me to do something specific?`
  ];

  return conversational[Math.floor(Math.random() * conversational.length)];
};

const resolveAgentCredentials = () => {
  const agents = readConfiguredAgents();
  const secrets = readConfiguredAgentSecrets();

  for (const agent of agents) {
    const ref = agent.apiKeyReference;
    if (!ref) continue;
    const rawKey = secrets.keys?.[ref];
    const apiKey = rawKey ? String(rawKey).replace(/[\s\r\n]+/g, '') : '';
    if (!apiKey || apiKey.length < 4) continue;
    return { agent, apiKey, model: agent.model || 'gpt-4o-mini' };
  }

  return null;
};

const detectProvider = (model) => {
  const lower = String(model || '').toLowerCase();
  if (lower.startsWith('claude') || lower.includes('anthropic')) return 'anthropic';
  if (lower.startsWith('gemini') || lower.includes('google')) return 'google';
  if (lower.includes('minimax') || lower.includes('abab') || lower.includes('hailuo')) return 'minimax';
  if (lower.includes('glm') || lower.includes('zhipu') || lower.includes('chatglm')) return 'zhipu';
  if (lower.includes('kimi') || lower.includes('moonshot')) return 'moonshot';
  return 'openai';
};

const buildSystemPrompt = () => {
  const ctx = buildMissionContext();
  const uptime = Math.floor(process.uptime() / 60);

  const taskLines = [];
  if (ctx.buckets.inbox.length > 0) {
    taskLines.push(`📥 Inbox (${ctx.buckets.inbox.length}): ${ctx.buckets.inbox.slice(0, 5).map((t) => `"${t.title}"${t.assignee ? ` → ${t.assignee}` : ''}`).join(', ')}`);
  }
  if (ctx.buckets.assigned.length > 0) {
    taskLines.push(`📌 Assigned (${ctx.buckets.assigned.length}): ${ctx.buckets.assigned.slice(0, 5).map((t) => `"${t.title}"${t.assignee ? ` → ${t.assignee}` : ''}`).join(', ')}`);
  }
  if (ctx.buckets.progress.length > 0) {
    taskLines.push(`🔄 In Progress (${ctx.buckets.progress.length}): ${ctx.buckets.progress.slice(0, 5).map((t) => `"${t.title}"${t.assignee ? ` → ${t.assignee}` : ''}`).join(', ')}`);
  }
  if (ctx.buckets.review.length > 0) {
    taskLines.push(`👀 Review (${ctx.buckets.review.length}): ${ctx.buckets.review.slice(0, 5).map((t) => `"${t.title}"${t.assignee ? ` → ${t.assignee}` : ''}`).join(', ')}`);
  }
  const taskBlock = taskLines.length > 0 ? taskLines.join('\n') : 'No tasks in queue.';

  const agentBlock = ctx.configuredAgents.length > 0
    ? ctx.configuredAgents.map((a) => `• ${a.name} — ${a.role || 'Custom Agent'}${a.model ? ` (${a.model})` : ''} — ${a.status || 'working'}`).join('\n')
    : 'No agents configured yet. User can add agents from the sidebar.';

  const fileBlock = ctx.workspaceFiles.slice(0, 15).map((f) => `• ${f.name}${f.description ? ` — ${f.description}` : ''}`).join('\n') || 'No workspace files.';

  return `You are Mission Control — an AI-powered mission orchestration system. You are the central intelligence hub that manages agents, tasks, workspace files, and operations for the user's mission board.

## Your Personality & Style
- You speak like a **military operations center AI** — concise, direct, operational
- Use **emoji prefixes** for structure: 📊 for status, 📋 for tasks, 🤖 for agents, 📁 for files, 🎯 for recommendations, ⚠️ for warnings, ✅ for confirmations
- Use **bold markdown** for headers and key terms
- Give **real data** from the live mission state below — never make up numbers
- Be **proactive** — suggest next actions, flag blockers, recommend priorities
- Keep responses **concise and actionable** — no fluff, no filler
- When greeting, always include a quick status snapshot (agent count, task count, active work)
- You are **always monitoring** — you know the exact state of every task, agent, and file
- You are **fully self-contained** — standalone mode, no external dependencies

## Live Mission State
**Time:** ${ctx.timeOfDay} | **Uptime:** ${uptime}m | **Mode:** Standalone

**Tasks (${ctx.totalTasks} total):**
${taskBlock}

**Agents (${ctx.agentCount}):**
${agentBlock}

**Workspace Files (${ctx.workspaceFiles.length}):**
${fileBlock}

**Telegram:** ${TELEGRAM_ENABLED ? 'Active — bidirectional sync enabled' : 'Not configured'}

## Your Capabilities
You can discuss and help with:
- 📊 Status reports and mission overviews
- 📋 Task management — planning, prioritization, triage, blockers
- 🤖 Agent management — roles, capabilities, workload
- 📁 Workspace files — what exists, what needs updating
- 📈 Metrics — throughput, active rates, pipeline health
- 🎯 Recommendations — what to do next, priorities, optimizations
- 💬 General mission strategy and planning
- 📱 Telegram integration status

## Conversation History
The user's recent messages are included in the conversation. Maintain context across messages and refer back to previous topics when relevant.`;
};

const httpsRequest = (options, postData) =>
  new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const errMsg = parsed?.error?.message || parsed?.error?.type || `API error ${res.statusCode}`;
            reject(new Error(errMsg));
            return;
          }
          resolve(parsed);
        } catch (err) {
          reject(new Error(`Failed to parse API response: ${err.message}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('API request timeout')); });
    req.write(postData);
    req.end();
  });

const callOpenAiApi = async (apiKey, model, messages) => {
  const postData = JSON.stringify({
    model,
    messages,
    max_tokens: 1024,
    temperature: 0.7
  });

  const result = await httpsRequest({
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: MC_AGENT_TIMEOUT_MS
  }, postData);

  return result?.choices?.[0]?.message?.content?.trim() || null;
};

const callAnthropicApi = async (apiKey, model, messages) => {
  const systemMsg = messages.find((m) => m.role === 'system');
  const chatMessages = messages.filter((m) => m.role !== 'system');

  const postData = JSON.stringify({
    model,
    max_tokens: 1024,
    system: systemMsg?.content || '',
    messages: chatMessages
  });

  const result = await httpsRequest({
    hostname: 'api.anthropic.com',
    port: 443,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: MC_AGENT_TIMEOUT_MS
  }, postData);

  const textBlock = Array.isArray(result?.content)
    ? result.content.find((b) => b.type === 'text')
    : null;
  return textBlock?.text?.trim() || null;
};

const stripThinkTags = (text) => {
  if (!text) return text;
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
};

const normalizeMiniMaxModel = (model) => {
  const lower = String(model || '').toLowerCase().replace(/\s+/g, '');
  if (lower.includes('m2.5') || lower.includes('m25')) return 'MiniMax-M2.5';
  if (lower.includes('m2.1') || lower.includes('m21')) return 'MiniMax-M2.1';
  if (lower.includes('m2')) return 'MiniMax-M2';
  if (lower.includes('highspeed') || lower.includes('fast') || lower.includes('lightning')) return 'MiniMax-M2.5-highspeed';
  return 'MiniMax-M2.5';
};

const callMiniMaxApiWithHost = async (hostname, apiKey, model, messages) => {
  const resolvedModel = normalizeMiniMaxModel(model);

  const postData = JSON.stringify({
    model: resolvedModel,
    messages,
    max_tokens: 1024,
    temperature: 0.7
  });

  console.log(`MiniMax: calling ${resolvedModel} via OpenAI API at ${hostname}/v1`);

  const result = await httpsRequest({
    hostname,
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: MC_AGENT_TIMEOUT_MS
  }, postData);

  const rawContent = result?.choices?.[0]?.message?.content || '';
  return stripThinkTags(rawContent) || null;
};

const callMiniMaxApi = async (apiKey, model, messages) => {
  // Try international endpoint first, then China endpoint
  try {
    return await callMiniMaxApiWithHost('api.minimax.io', apiKey, model, messages);
  } catch (firstError) {
    console.log(`MiniMax international endpoint failed (${firstError.message}), trying China endpoint...`);
    try {
      return await callMiniMaxApiWithHost('api.minimaxi.com', apiKey, model, messages);
    } catch (secondError) {
      throw new Error(`MiniMax API failed on both endpoints: ${firstError.message} / ${secondError.message}`);
    }
  }
};

const normalizeZhipuModel = (model) => {
  const lower = String(model || '').toLowerCase().replace(/\s+/g, '');
  if (lower.includes('5') && lower.includes('plus')) return 'glm-5-plus';
  if (lower.includes('5')) return 'glm-5';
  if (lower.includes('4-plus') || lower.includes('4plus')) return 'glm-4-plus';
  if (lower.includes('4')) return 'glm-4';
  return 'glm-5';
};

const callZhipuApi = async (apiKey, model, messages) => {
  const resolvedModel = normalizeZhipuModel(model);

  const postData = JSON.stringify({
    model: resolvedModel,
    messages,
    max_tokens: 1024,
    temperature: 0.7
  });

  console.log(`Zhipu AI: calling ${resolvedModel} via OpenAI-compatible API at open.bigmodel.cn/api/paas/v4`);

  const result = await httpsRequest({
    hostname: 'open.bigmodel.cn',
    port: 443,
    path: '/api/paas/v4/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: MC_AGENT_TIMEOUT_MS
  }, postData);

  const rawContent = result?.choices?.[0]?.message?.content || '';
  return stripThinkTags(rawContent) || null;
};

const normalizeMoonshotModel = (model) => {
  const lower = String(model || '').toLowerCase().replace(/\s+/g, '');
  if (lower.includes('2.5')) return 'kimi-2.5';
  if (lower.includes('2') && lower.includes('latest')) return 'kimi-latest';
  if (lower.includes('128k')) return 'moonshot-v1-128k';
  if (lower.includes('32k')) return 'moonshot-v1-32k';
  if (lower.includes('8k')) return 'moonshot-v1-8k';
  if (lower.includes('v1')) return 'moonshot-v1-auto';
  return 'kimi-2.5';
};

const callMoonshotApi = async (apiKey, model, messages) => {
  const resolvedModel = normalizeMoonshotModel(model);

  const postData = JSON.stringify({
    model: resolvedModel,
    messages,
    max_tokens: 1024,
    temperature: 0.7
  });

  console.log(`Moonshot AI: calling ${resolvedModel} via OpenAI-compatible API at api.moonshot.cn/v1`);

  const result = await httpsRequest({
    hostname: 'api.moonshot.cn',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(postData)
    },
    timeout: MC_AGENT_TIMEOUT_MS
  }, postData);

  const rawContent = result?.choices?.[0]?.message?.content || '';
  return stripThinkTags(rawContent) || null;
};

const callAiModel = async (apiKey, model, messages) => {
  const provider = detectProvider(model);

  if (provider === 'anthropic') {
    return callAnthropicApi(apiKey, model, messages);
  }

  if (provider === 'minimax') {
    return callMiniMaxApi(apiKey, model, messages);
  }

  if (provider === 'zhipu') {
    return callZhipuApi(apiKey, model, messages);
  }

  if (provider === 'moonshot') {
    return callMoonshotApi(apiKey, model, messages);
  }

  // Default: OpenAI-compatible API (works for OpenAI, OpenRouter, etc.)
  return callOpenAiApi(apiKey, model, messages);
};

const requestMissionReply = async (messageText) => {
  const normalizedMessage = String(messageText || '').trim();

  if (!normalizedMessage) {
    return 'Please send a message so I can assist with mission planning.';
  }

  addToConversationMemory('user', normalizedMessage);

  const credentials = resolveAgentCredentials();

  if (!credentials) {
    console.log('No agent API key configured — using built-in replies.');
    const reply = generateIntelligentReply(normalizedMessage);
    addToConversationMemory('assistant', reply);
    return reply;
  }

  try {
    const systemPrompt = buildSystemPrompt();
    const historyMessages = conversationMemory.slice(-10).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.text
    }));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: normalizedMessage }
    ];

    console.log(`Calling ${credentials.agent.model} for ${credentials.agent.name}...`);
    const aiReply = await callAiModel(credentials.apiKey, credentials.agent.model, messages);

    if (aiReply) {
      addToConversationMemory('assistant', aiReply);
      return aiReply;
    }

    console.warn('AI returned empty response — falling back to built-in reply.');
    const reply = generateIntelligentReply(normalizedMessage);
    addToConversationMemory('assistant', reply);
    return reply;
  } catch (error) {
    console.warn(`AI API call failed (${error.message}) — falling back to built-in reply.`);
    const reply = generateIntelligentReply(normalizedMessage);
    addToConversationMemory('assistant', reply);
    return reply;
  }
};

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
    const status = await getMissionStatus();
    const statusAgents = Array.isArray(status?.agents?.agents)
      ? status.agents.agents
      : [];
    const statusSessions = Array.isArray(status?.sessions?.recent)
      ? status.sessions.recent
      : [];
    const workspaceDir = statusAgents[0]?.workspaceDir || '';
    const localFiles = readWorkspaceFiles(workspaceDir);

    const configuredAgents = readConfiguredAgents();

    let agents;
    if (STANDALONE_MODE) {
      // In standalone mode, only show config-managed agents — no phantom runtime agents
      agents = configuredAgents.map((agent) => toDisplayAgent(agent));
    } else {
      const runtimeAgents = statusAgents.map((agent) => {
        const name = toTitleCase(agent.id);
        return {
          id: `runtime-${toNormalizedAgentId(agent.id)}`,
          isConfigManaged: false,
          name,
          role: 'Mission Agent',
          status: toAgentStatus(agent.lastActiveAgeMs),
          initial: name.charAt(0).toUpperCase()
        };
      });
      agents = mergeAgents(runtimeAgents, configuredAgents);
    }

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
      const missionReplyText = await requestMissionReply(message);

      // Get the first available agent's name as the reply author
      const configuredAgents = readConfiguredAgents();
      const replyAuthor = configuredAgents.length > 0 ? configuredAgents[0].name : 'Mission Control';

      const replyMessage = {
        id: `reply-${Date.now()}`,
        role: 'assistant',
        author: replyAuthor,
        message: missionReplyText,
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
      // Get the first available agent's name as the reply author
      const configuredAgents = readConfiguredAgents();
      const replyAuthor = configuredAgents.length > 0 ? configuredAgents[0].name : 'Mission Control';

      const fallbackReply = {
        id: `reply-local-${Date.now()}`,
        role: 'assistant',
        author: replyAuthor,
        message: `Agent bridge failed (${error?.message || 'unknown error'}). Fallback reply: ${message}`,
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

  // Workspace file read endpoint
  if (requestPath === '/api/mission-control/workspace/files' && req.method === 'GET') {
    const localFiles = readWorkspaceFiles(STANDALONE_WORKSPACE_DIR);
    sendJson(res, 200, { files: localFiles.map(({ stats, ...rest }) => rest) });
    return;
  }

  // Workspace file content read endpoint
  if (requestPath.startsWith('/api/mission-control/workspace/file/') && req.method === 'GET') {
    const fileName = decodeURIComponent(requestPath.slice('/api/mission-control/workspace/file/'.length)).trim();

    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      sendJson(res, 400, { error: 'Invalid file name.' });
      return;
    }

    const filePath = path.join(STANDALONE_WORKSPACE_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      sendJson(res, 404, { error: 'File not found.' });
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const stats = fs.statSync(filePath);
      sendJson(res, 200, {
        name: fileName,
        content,
        lastModified: formatFileAge(stats.mtimeMs),
        size: stats.size
      });
    } catch {
      sendJson(res, 500, { error: 'Failed to read file.' });
    }
    return;
  }

  // Workspace file content write endpoint
  if (requestPath.startsWith('/api/mission-control/workspace/file/') && req.method === 'PUT') {
    const fileName = decodeURIComponent(requestPath.slice('/api/mission-control/workspace/file/'.length)).trim();

    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      sendJson(res, 400, { error: 'Invalid file name.' });
      return;
    }

    const body = await readBody(req);
    const content = body.content;

    if (typeof content !== 'string') {
      sendJson(res, 400, { error: 'Content string is required.' });
      return;
    }

    const filePath = path.join(STANDALONE_WORKSPACE_DIR, fileName);

    try {
      fs.writeFileSync(filePath, content, { encoding: 'utf8' });
      const stats = fs.statSync(filePath);

      if (TELEGRAM_ENABLED) {
        notifyTelegram({
          type: 'workflow',
          action: `File updated: ${fileName}`,
          detail: `Workspace file ${fileName} was edited (${content.length} chars).`,
          agent: 'System'
        }).catch((error) => {
          logTelegramError('Telegram file-update notify failed', error);
        });
      }

      broadcastRealtimeEvent({
        type: 'mission.file.updated',
        payload: { name: fileName, lastModified: formatFileAge(stats.mtimeMs), size: stats.size }
      });

      sendJson(res, 200, {
        ok: true,
        name: fileName,
        lastModified: formatFileAge(stats.mtimeMs),
        size: stats.size
      });
    } catch {
      sendJson(res, 500, { error: 'Failed to write file.' });
    }
    return;
  }

  // Workspace file create endpoint
  if (requestPath === '/api/mission-control/workspace/file' && req.method === 'POST') {
    const body = await readBody(req);
    const fileName = String(body.name || '').trim();
    const content = typeof body.content === 'string' ? body.content : '';

    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      sendJson(res, 400, { error: 'Valid file name is required.' });
      return;
    }

    const filePath = path.join(STANDALONE_WORKSPACE_DIR, fileName);

    if (fs.existsSync(filePath)) {
      sendJson(res, 409, { error: 'File already exists. Use PUT to update.' });
      return;
    }

    try {
      fs.writeFileSync(filePath, content, { encoding: 'utf8' });
      const stats = fs.statSync(filePath);

      broadcastRealtimeEvent({
        type: 'mission.file.created',
        payload: { name: fileName, lastModified: formatFileAge(stats.mtimeMs), size: stats.size }
      });

      sendJson(res, 201, {
        ok: true,
        name: fileName,
        lastModified: formatFileAge(stats.mtimeMs),
        size: stats.size
      });
    } catch {
      sendJson(res, 500, { error: 'Failed to create file.' });
    }
    return;
  }

  // Workspace file delete endpoint
  if (requestPath.startsWith('/api/mission-control/workspace/file/') && req.method === 'DELETE') {
    const fileName = decodeURIComponent(requestPath.slice('/api/mission-control/workspace/file/'.length)).trim();

    if (!fileName || fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      sendJson(res, 400, { error: 'Invalid file name.' });
      return;
    }

    const filePath = path.join(STANDALONE_WORKSPACE_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      sendJson(res, 404, { error: 'File not found.' });
      return;
    }

    try {
      fs.unlinkSync(filePath);

      broadcastRealtimeEvent({
        type: 'mission.file.deleted',
        payload: { name: fileName }
      });

      sendJson(res, 200, { ok: true, deletedFile: fileName });
    } catch {
      sendJson(res, 500, { error: 'Failed to delete file.' });
    }
    return;
  }

  // Telegram status endpoint (enhanced with channel info)
  if (requestPath === '/api/mission-control/telegram/status' && req.method === 'GET') {
    const botInfo = await getTelegramBotInfo();
    sendJson(res, 200, {
      enabled: TELEGRAM_ENABLED,
      ready: isTelegramReady(),
      connected: Boolean(botInfo),
      activeChatId: getActiveChatId(),
      bot: botInfo ? {
        username: botInfo.username,
        firstName: botInfo.first_name
      } : null,
      channels: getKnownChannels()
    });
    return;
  }

  // Telegram channels list
  if (requestPath === '/api/mission-control/telegram/channels' && req.method === 'GET') {
    sendJson(res, 200, {
      channels: getKnownChannels(),
      activeChatId: getActiveChatId()
    });
    return;
  }

  // Switch active Telegram channel
  if (requestPath === '/api/mission-control/telegram/channels/switch' && req.method === 'POST') {
    const body = await readBody(req);
    const chatId = String(body.chatId || '').trim();

    if (!chatId) {
      sendJson(res, 400, { error: 'chatId is required.' });
      return;
    }

    const result = await setActiveChatId(chatId);

    if (!result.ok) {
      sendJson(res, 400, { error: result.error });
      return;
    }

    broadcastRealtimeEvent({
      type: 'mission.telegram.channelChanged',
      payload: { activeChatId: result.activeChatId, chatInfo: result.chatInfo }
    });

    sendJson(res, 200, result);
    return;
  }

  // Add a Telegram channel
  if (requestPath === '/api/mission-control/telegram/channels' && req.method === 'POST') {
    const body = await readBody(req);
    const chatId = String(body.chatId || '').trim();
    const label = String(body.label || '').trim();

    if (!chatId) {
      sendJson(res, 400, { error: 'chatId is required.' });
      return;
    }

    const result = await addChannel(chatId, label);

    if (!result.ok) {
      sendJson(res, 400, { error: result.error });
      return;
    }

    sendJson(res, 201, result);
    return;
  }

  // Remove a Telegram channel
  if (requestPath.startsWith('/api/mission-control/telegram/channels/') && req.method === 'DELETE') {
    const chatId = decodeURIComponent(requestPath.slice('/api/mission-control/telegram/channels/'.length)).trim();

    if (!chatId) {
      sendJson(res, 400, { error: 'Chat ID is required.' });
      return;
    }

    const result = removeChannel(chatId);

    if (!result.ok) {
      sendJson(res, 400, { error: result.error });
      return;
    }

    sendJson(res, 200, result);
    return;
  }

  // Send test message to Telegram
  if (requestPath === '/api/mission-control/telegram/test' && req.method === 'POST') {
    const body = await readBody(req);
    const chatId = String(body.chatId || '').trim() || undefined;

    const result = await sendTestMessage(chatId);
    sendJson(res, result.ok ? 200 : 400, result);
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
  console.log(`Mission Control backend running at http://localhost:${PORT}`);
  if (TELEGRAM_ENABLED) {
    console.log('Telegram bot connected and syncing with Mission Control');
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
