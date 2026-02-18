import { runtimeConfig } from '../config/runtimeConfig';

const buildUrl = (path) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!runtimeConfig.openclawApiBaseUrl) {
    return normalizedPath;
  }

  return `${runtimeConfig.openclawApiBaseUrl}${normalizedPath}`;
};

const requestWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), runtimeConfig.requestTimeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    if (!response.ok) {
      let errorMessage = `OpenClaw API error: ${response.status} ${response.statusText}`;
      const contentType = response.headers.get('content-type') || '';

      if (contentType.toLowerCase().includes('application/json')) {
        try {
          const errorPayload = await response.json();
          if (typeof errorPayload?.error === 'string' && errorPayload.error.trim()) {
            errorMessage = errorPayload.error.trim();
          }
        } catch {
          // Keep the default status-based message.
        }
      }

      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return null;
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutHandle);
  }
};

export const fetchMissionSnapshot = () => requestWithTimeout(buildUrl('/api/mission-control/snapshot'));

export const postEmergencyAction = (action) => requestWithTimeout(buildUrl('/api/mission-control/emergency'), {
  method: 'POST',
  body: JSON.stringify({ action })
});

export const postTaskColumnUpdate = (taskId, column) => requestWithTimeout(buildUrl('/api/mission-control/tasks/move'), {
  method: 'POST',
  body: JSON.stringify({ taskId, column })
});

export const postTaskUpdate = (task) => requestWithTimeout(buildUrl(`/api/mission-control/tasks/${task.id}`), {
  method: 'PUT',
  body: JSON.stringify({ task })
});

export const deleteTaskById = (taskId) => requestWithTimeout(buildUrl(`/api/mission-control/tasks/${taskId}`), {
  method: 'DELETE'
});

export const postMissionChatMessage = (message, metadata = {}) => requestWithTimeout(buildUrl('/api/mission-control/chat'), {
  method: 'POST',
  body: JSON.stringify({ message, ...metadata })
});

export const postCreateAgent = (agentPayload) => requestWithTimeout(buildUrl('/api/mission-control/agents'), {
  method: 'POST',
  body: JSON.stringify(agentPayload)
});

export const putUpdateAgent = (agentId, agentPayload) => requestWithTimeout(
  buildUrl(`/api/mission-control/agents/${encodeURIComponent(agentId)}`),
  {
    method: 'PUT',
    body: JSON.stringify(agentPayload)
  }
);

export const deleteAgentById = (agentId) => requestWithTimeout(
  buildUrl(`/api/mission-control/agents/${encodeURIComponent(agentId)}`),
  {
    method: 'DELETE'
  }
);

export const fetchTelegramStatus = () => requestWithTimeout(buildUrl('/api/mission-control/telegram/status'));

export { buildUrl };
