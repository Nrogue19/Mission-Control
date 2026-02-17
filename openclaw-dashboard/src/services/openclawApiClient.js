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
      throw new Error(`OpenClaw API error: ${response.status} ${response.statusText}`);
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

export const postMissionChatMessage = (message) => requestWithTimeout(buildUrl('/api/mission-control/chat'), {
  method: 'POST',
  body: JSON.stringify({ message })
});

export { buildUrl };
