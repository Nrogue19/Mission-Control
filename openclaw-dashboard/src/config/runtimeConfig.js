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

const apiBaseUrl = trimTrailingSlash(process.env.REACT_APP_OPENCLAW_API_BASE_URL);
const explicitWsUrl = trimTrailingSlash(process.env.REACT_APP_OPENCLAW_WS_URL);

const inferredWsUrl = apiBaseUrl
  ? apiBaseUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:')
  : '';

export const runtimeConfig = {
  liveDataEnabled: parseBoolean(process.env.REACT_APP_OPENCLAW_LIVE_DATA, false),
  openclawApiBaseUrl: apiBaseUrl,
  openclawWsUrl: explicitWsUrl || inferredWsUrl,
  requestTimeoutMs: parseNumber(process.env.REACT_APP_OPENCLAW_API_TIMEOUT_MS, 8000),
  
  // MiniMax AI Config
  minimaxApiKey: process.env.REACT_APP_MINIMAX_API_KEY || '',
  minimaxModel: process.env.REACT_APP_MINIMAX_MODEL || 'minimax-portal/MiniMax-M2.5',
  minimaxEnabled: !!process.env.REACT_APP_MINIMAX_API_KEY,
  
  // Clean mode - no mock data
  cleanMode: parseBoolean(process.env.REACT_APP_CLEAN_MODE, false)
};
