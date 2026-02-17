const http = require('http');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Server: WebSocketServer } = require('ws');

const PORT = 8787;
const OPENCLAW_AGENT_ID = process.env.OPENCLAW_AGENT_ID || 'main';
const OPENCLAW_AGENT_TIMEOUT_MS = Number(process.env.OPENCLAW_AGENT_TIMEOUT_MS || 120000);

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
      path: filePath
    };
  });
};

const buildLiveTasks = ({ statusAgents, statusSessions, workspaceFiles }) => {
  const tasks = [];
  const fallbackAssignee = statusAgents[0] ? toTitleCase(statusAgents[0].id) : null;

  const sessionTasks = Array.isArray(statusSessions)
    ? statusSessions.slice(0, 4).map((session, index) => {
      const sessionAgentName = toTitleCase(session.agentId || fallbackAssignee || 'main');
      const isReview = Boolean(session.abortedLastRun);

      return {
        id: `session-${normalizeTaskId(session.sessionId || `${sessionAgentName}-${index}`)}`,
        column: isReview ? 'review' : 'progress',
        title: isReview
          ? `Review session ${String(session.sessionId || 'run').slice(0, 8)}`
          : `Continue session ${String(session.sessionId || 'run').slice(0, 8)}`,
        description: `Model ${session.model || 'unknown'} • ${session.percentUsed ?? 0}% context used.`,
        time: formatTaskDate(session.updatedAt),
        assignee: sessionAgentName,
        assigneeInitial: sessionAgentName.charAt(0).toUpperCase()
      };
    })
    : [];

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

  tasks.push(...sessionTasks, ...workspaceTasks);

  return tasks;
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

    return {
      agents,
      localFiles,
      tasks: buildLiveTasks({ statusAgents, statusSessions, workspaceFiles: localFiles }),
      feedItems: [],
      timelineItems: [],
      chatMessages: []
    };
  } catch {
    return {
      agents: [],
      localFiles: [],
      tasks: [],
      feedItems: [],
      timelineItems: [],
      chatMessages: []
    };
  }
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
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.url === '/api/mission-control/snapshot' && req.method === 'GET') {
    const snapshot = await buildSnapshot();
    sendJson(res, 200, snapshot);
    return;
  }

  if (req.url === '/api/mission-control/chat' && req.method === 'POST') {
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

  if (req.url === '/api/mission-control/emergency' && req.method === 'POST') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.url === '/api/mission-control/tasks/move' && req.method === 'POST') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.url.startsWith('/api/mission-control/tasks/') && (req.method === 'PUT' || req.method === 'DELETE')) {
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

const wsServer = new WebSocketServer({
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