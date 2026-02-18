const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const normalizedValue = String(value).trim().toLowerCase();
  return normalizedValue === 'true' || normalizedValue === '1' || normalizedValue === 'yes';
};

const parseNumber = (value, defaultValue) => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : defaultValue;
};

const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '');

const apiBaseUrl = trimTrailingSlash(process.env.REACT_APP_MC_API_BASE_URL);
const explicitWsUrl = trimTrailingSlash(process.env.REACT_APP_MC_WS_URL);

const inferredWsUrl = apiBaseUrl
  ? apiBaseUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:')
  : '';

export const runtimeConfig = {
  liveDataEnabled: parseBoolean(process.env.REACT_APP_MC_LIVE_DATA, false),
  missionApiBaseUrl: apiBaseUrl,
  missionWsUrl: explicitWsUrl || inferredWsUrl,
  requestTimeoutMs: parseNumber(process.env.REACT_APP_MC_API_TIMEOUT_MS, 8000)
};
