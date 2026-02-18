import { runtimeConfig } from '../config/runtimeConfig';

const OPEN = 1;

export const createMissionRealtimeClient = ({
  onStatusChange,
  onEvent,
  onError,
  reconnectDelayMs = 2000,
  maxReconnectDelayMs = 30000
} = {}) => {
  if (!runtimeConfig.missionWsUrl) {
    return {
      connect: () => {
        onStatusChange?.('disabled');
      },
      disconnect: () => {}
    };
  }

  let socket = null;
  let manualDisconnect = false;
  let reconnectAttempts = 0;
  let reconnectTimer = null;

  const updateStatus = (status) => {
    onStatusChange?.(status);
  };

  const clearReconnectTimer = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const getReconnectDelay = () => {
    const exponentialDelay = reconnectDelayMs * (2 ** reconnectAttempts);
    return Math.min(exponentialDelay, maxReconnectDelayMs);
  };

  const scheduleReconnect = () => {
    if (manualDisconnect) {
      return;
    }

    clearReconnectTimer();
    const delayMs = getReconnectDelay();
    updateStatus('reconnecting');

    reconnectTimer = setTimeout(() => {
      reconnectAttempts += 1;
      connect();
    }, delayMs);
  };

  const connect = () => {
    clearReconnectTimer();
    updateStatus('connecting');

    socket = new WebSocket(`${runtimeConfig.missionWsUrl}/ws/mission-control`);

    socket.onopen = () => {
      reconnectAttempts = 0;
      updateStatus('connected');
    };

    socket.onmessage = (event) => {
      try {
        const parsedEvent = JSON.parse(event.data);
        onEvent?.(parsedEvent);
      } catch (error) {
        onError?.(error);
      }
    };

    socket.onerror = (error) => {
      onError?.(error);
    };

    socket.onclose = () => {
      updateStatus('disconnected');
      scheduleReconnect();
    };
  };

  const disconnect = () => {
    manualDisconnect = true;
    clearReconnectTimer();

    if (socket && socket.readyState === OPEN) {
      socket.close();
    }

    updateStatus('disconnected');
  };

  return {
    connect,
    disconnect
  };
};
