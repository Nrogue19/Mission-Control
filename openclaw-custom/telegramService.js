/**
 * Telegram Bot Service for Mission Control
 * Handles notifications, bidirectional chat sync, and multi-channel support
 */

const https = require('https');

const TELEGRAM_API_BASE = 'api.telegram.org';
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_DEFAULT_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// Runtime state — active chat ID can be changed at runtime via API
let activeChatId = TELEGRAM_DEFAULT_CHAT_ID;

// Known channels/groups discovered via getUpdates or manually added
const knownChannels = new Map();

const TELEGRAM_ENABLED = Boolean(TELEGRAM_BOT_TOKEN);
const isTelegramReady = () => Boolean(TELEGRAM_BOT_TOKEN && activeChatId);

// Initialize default channel if configured
if (TELEGRAM_DEFAULT_CHAT_ID) {
  knownChannels.set(String(TELEGRAM_DEFAULT_CHAT_ID), {
    id: String(TELEGRAM_DEFAULT_CHAT_ID),
    title: 'Default Channel',
    type: 'unknown',
    isActive: true,
    addedAt: Date.now()
  });
}

/**
 * Make a request to Telegram Bot API
 */
const telegramApiRequest = (method, params = {}) => {
  return new Promise((resolve, reject) => {
    if (!TELEGRAM_BOT_TOKEN) {
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
      timeout: 15000
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
 * Send a message to the active Telegram chat
 */
const sendTelegramMessage = async (text, options = {}) => {
  if (!isTelegramReady()) {
    return null;
  }

  const targetChatId = options.chat_id || activeChatId;

  const params = {
    chat_id: targetChatId,
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
  if (!isTelegramReady()) {
    return null;
  }

  const text = formatNotification(event);
  return sendTelegramMessage(text);
};

/**
 * Send a chat message to Telegram (for bidirectional sync)
 */
const sendChatToTelegram = async (message) => {
  if (!isTelegramReady()) {
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
 * Get chat/channel info by ID
 */
const getTelegramChatInfo = async (chatId) => {
  if (!TELEGRAM_BOT_TOKEN || !chatId) {
    return null;
  }

  try {
    const result = await telegramApiRequest('getChat', { chat_id: chatId });
    return result;
  } catch {
    return null;
  }
};

/**
 * Discover channels from recent updates and store them
 */
const discoverChannelsFromUpdates = (updates) => {
  if (!Array.isArray(updates)) return;

  for (const update of updates) {
    const chat = update?.message?.chat || update?.channel_post?.chat;
    if (!chat?.id) continue;

    const chatIdStr = String(chat.id);
    const existing = knownChannels.get(chatIdStr);

    knownChannels.set(chatIdStr, {
      id: chatIdStr,
      title: chat.title || chat.first_name || chat.username || `Chat ${chatIdStr}`,
      type: chat.type || 'unknown',
      username: chat.username || null,
      isActive: chatIdStr === String(activeChatId),
      addedAt: existing?.addedAt || Date.now(),
      lastSeen: Date.now()
    });
  }
};

/**
 * Get all known channels
 */
const getKnownChannels = () => {
  const channels = [];
  for (const [id, channel] of knownChannels) {
    channels.push({
      ...channel,
      isActive: id === String(activeChatId)
    });
  }
  return channels;
};

/**
 * Set the active chat ID for sending messages
 */
const setActiveChatId = async (chatId) => {
  const chatIdStr = String(chatId || '').trim();
  if (!chatIdStr) {
    return { ok: false, error: 'Chat ID is required.' };
  }

  // Try to get chat info to validate
  const chatInfo = await getTelegramChatInfo(chatIdStr);

  if (chatInfo) {
    knownChannels.set(chatIdStr, {
      id: chatIdStr,
      title: chatInfo.title || chatInfo.first_name || chatInfo.username || `Chat ${chatIdStr}`,
      type: chatInfo.type || 'unknown',
      username: chatInfo.username || null,
      isActive: true,
      addedAt: knownChannels.get(chatIdStr)?.addedAt || Date.now(),
      lastSeen: Date.now()
    });
  } else if (!knownChannels.has(chatIdStr)) {
    // Add it anyway — user might know the ID is valid
    knownChannels.set(chatIdStr, {
      id: chatIdStr,
      title: `Chat ${chatIdStr}`,
      type: 'unknown',
      isActive: true,
      addedAt: Date.now()
    });
  }

  // Mark previous active as inactive
  for (const [id, channel] of knownChannels) {
    channel.isActive = (id === chatIdStr);
  }

  activeChatId = chatIdStr;

  return {
    ok: true,
    activeChatId: chatIdStr,
    chatInfo: chatInfo || knownChannels.get(chatIdStr)
  };
};

/**
 * Add a channel manually by ID
 */
const addChannel = async (chatId, label) => {
  const chatIdStr = String(chatId || '').trim();
  if (!chatIdStr) {
    return { ok: false, error: 'Chat ID is required.' };
  }

  const chatInfo = await getTelegramChatInfo(chatIdStr);

  knownChannels.set(chatIdStr, {
    id: chatIdStr,
    title: label || chatInfo?.title || chatInfo?.first_name || `Chat ${chatIdStr}`,
    type: chatInfo?.type || 'unknown',
    username: chatInfo?.username || null,
    isActive: chatIdStr === String(activeChatId),
    addedAt: Date.now(),
    lastSeen: chatInfo ? Date.now() : null
  });

  return {
    ok: true,
    channel: knownChannels.get(chatIdStr)
  };
};

/**
 * Remove a known channel
 */
const removeChannel = (chatId) => {
  const chatIdStr = String(chatId || '').trim();
  if (!chatIdStr) {
    return { ok: false, error: 'Chat ID is required.' };
  }

  if (chatIdStr === String(activeChatId)) {
    return { ok: false, error: 'Cannot remove the active channel. Switch to another channel first.' };
  }

  const existed = knownChannels.delete(chatIdStr);
  return { ok: true, removed: existed };
};

/**
 * Get the current active chat ID
 */
const getActiveChatId = () => activeChatId;

/**
 * Get updates from Telegram (for polling messages)
 */
const getTelegramUpdates = async (offset = 0, timeout = 30) => {
  if (!TELEGRAM_BOT_TOKEN) {
    return [];
  }

  try {
    const result = await telegramApiRequest('getUpdates', {
      offset,
      timeout,
      allowed_updates: ['message', 'channel_post']
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
  const rawMsg = update?.message || update?.channel_post;
  if (!rawMsg?.text) {
    return null;
  }

  if (rawMsg.from?.is_bot) {
    return null;
  }

  // Accept messages from the active chat
  if (String(rawMsg.chat?.id || '') !== String(activeChatId)) {
    return null;
  }

  const author = rawMsg.from?.username 
    ? `@${rawMsg.from.username}` 
    : (rawMsg.from?.first_name || 'Telegram User');

  return {
    id: `telegram-${rawMsg.message_id}`,
    role: 'user',
    author,
    message: rawMsg.text,
    time: new Date(rawMsg.date * 1000).toLocaleTimeString('en-US', { hour12: false }),
    source: 'telegram',
    telegramMessageId: rawMsg.message_id
  };
};

/**
 * Start polling for Telegram messages
 */
const startTelegramPolling = (onMessage, intervalMs = 2000) => {
  if (!TELEGRAM_BOT_TOKEN) {
    return { stop: () => {} };
  }

  let lastOffset = 0;
  let polling = true;

  const poll = async () => {
    if (!polling) return;

    try {
      const updates = await getTelegramUpdates(lastOffset, 0);

      // Discover channels from all updates
      discoverChannelsFromUpdates(updates);
      
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

/**
 * Send a test message to verify connection
 */
const sendTestMessage = async (chatId) => {
  const targetId = chatId || activeChatId;
  if (!TELEGRAM_BOT_TOKEN || !targetId) {
    return { ok: false, error: 'Bot token and chat ID are required.' };
  }

  try {
    const result = await sendTelegramMessage(
      '🟢 <b>Mission Control Connected</b>\n\nTelegram integration is active and syncing.',
      { chat_id: targetId }
    );
    return { ok: true, messageId: result?.message_id };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

module.exports = {
  TELEGRAM_ENABLED,
  isTelegramReady,
  sendTelegramMessage,
  notifyTelegram,
  sendChatToTelegram,
  getTelegramBotInfo,
  getTelegramChatInfo,
  getTelegramUpdates,
  parseTelegramMessage,
  startTelegramPolling,
  getKnownChannels,
  setActiveChatId,
  getActiveChatId,
  addChannel,
  removeChannel,
  sendTestMessage
};
