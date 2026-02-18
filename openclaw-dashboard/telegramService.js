/**
 * Telegram Bot Service for OpenClaw Mission Control
 * Handles notifications and bidirectional chat sync
 */

const https = require('https');

const TELEGRAM_API_BASE = 'api.telegram.org';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';
const TELEGRAM_ENABLED = Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);

/**
 * Make a request to Telegram Bot API
 */
const telegramApiRequest = (method, params = {}) => {
  return new Promise((resolve, reject) => {
    if (!TELEGRAM_ENABLED) {
      resolve(null);
      return;
    }

    const postData = JSON.stringify(params);
    const options = {
      hostname: TELEGRAM_API_BASE,
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            resolve(parsed.result);
          } else {
            reject(new Error(parsed.description || 'Telegram API error'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Telegram API timeout'));
    });
    req.write(postData);
    req.end();
  });
};

/**
 * Send a message to the configured Telegram chat
 */
const sendTelegramMessage = async (text, options = {}) => {
  if (!TELEGRAM_ENABLED) {
    return null;
  }

  const params = {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: options.parse_mode || 'HTML',
    disable_notification: options.silent || false
  };

  if (options.reply_to_message_id) {
    params.reply_to_message_id = options.reply_to_message_id;
  }

  return telegramApiRequest('sendMessage', params);
};

/**
 * Format a notification for Telegram
 */
const formatNotification = (event) => {
  const { type, action, detail, agent } = event;
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  
  const icons = {
    workflow: '⚙️',
    safety: '🛡️',
    security: '🔒',
    task: '📋',
    error: '❌',
    agent: '🤖',
    chat: '💬'
  };

  const icon = icons[type] || '📡';
  
  return `<b>${icon} ${action}</b>\n\n${detail || ''}\n\n<i>🕐 ${timestamp} • ${agent || 'System'}</i>`;
};

/**
 * Send a notification to Telegram for mission events
 */
const notifyTelegram = async (event) => {
  if (!TELEGRAM_ENABLED) {
    return null;
  }

  const text = formatNotification(event);
  return sendTelegramMessage(text);
};

/**
 * Send a chat message to Telegram (for bidirectional sync)
 */
const sendChatToTelegram = async (message) => {
  if (!TELEGRAM_ENABLED) {
    return null;
  }

  const { author, message: text, time } = message;
  const formattedText = `<b>${escapeHtml(author)}:</b> ${escapeHtml(text)}\n<i>🕐 ${time || new Date().toLocaleTimeString('en-US', { hour12: false })}</i>`;
  
  return sendTelegramMessage(formattedText);
};

/**
 * Escape HTML special characters
 */
const escapeHtml = (text) => {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

/**
 * Get bot info (for status checks)
 */
const getTelegramBotInfo = async () => {
  if (!TELEGRAM_BOT_TOKEN) {
    return null;
  }

  try {
    const result = await telegramApiRequest('getMe');
    return result;
  } catch {
    return null;
  }
};

/**
 * Get updates from Telegram (for polling messages)
 */
const getTelegramUpdates = async (offset = 0, timeout = 30) => {
  if (!TELEGRAM_ENABLED) {
    return [];
  }

  try {
    const result = await telegramApiRequest('getUpdates', {
      offset,
      timeout,
      allowed_updates: ['message']
    });
    return result || [];
  } catch {
    return [];
  }
};

/**
 * Parse Telegram message into Mission Chat format
 */
const parseTelegramMessage = (update) => {
  if (!update?.message?.text) {
    return null;
  }

  const msg = update.message;

  if (msg.from?.is_bot) {
    return null;
  }

  if (String(msg.chat?.id || '') !== String(TELEGRAM_CHAT_ID)) {
    return null;
  }

  const author = msg.from?.username 
    ? `@${msg.from.username}` 
    : (msg.from?.first_name || 'Telegram User');

  return {
    id: `telegram-${msg.message_id}`,
    role: 'user',
    author,
    message: msg.text,
    time: new Date(msg.date * 1000).toLocaleTimeString('en-US', { hour12: false }),
    source: 'telegram',
    telegramMessageId: msg.message_id
  };
};

/**
 * Start polling for Telegram messages
 */
const startTelegramPolling = (onMessage, intervalMs = 2000) => {
  if (!TELEGRAM_ENABLED) {
    return { stop: () => {} };
  }

  let lastOffset = 0;
  let polling = true;

  const poll = async () => {
    if (!polling) return;

    try {
      const updates = await getTelegramUpdates(lastOffset, 0);
      
      for (const update of updates) {
        lastOffset = Math.max(lastOffset, update.update_id + 1);
        
        const message = parseTelegramMessage(update);
        if (message) {
          onMessage(message);
        }
      }
    } catch (error) {
      console.error('Telegram polling error:', error.message);
    }

    if (polling) {
      setTimeout(poll, intervalMs);
    }
  };

  poll();

  return {
    stop: () => {
      polling = false;
    }
  };
};

module.exports = {
  TELEGRAM_ENABLED,
  sendTelegramMessage,
  notifyTelegram,
  sendChatToTelegram,
  getTelegramBotInfo,
  getTelegramUpdates,
  parseTelegramMessage,
  startTelegramPolling
};
