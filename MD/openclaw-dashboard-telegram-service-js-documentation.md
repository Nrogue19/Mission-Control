# openclaw-dashboard/telegramService.js Documentation

## File
`/openclaw-dashboard/telegramService.js`

## Purpose
Provides Telegram Bot API integration for Mission Control notifications and bidirectional mission chat synchronization.

## Key Contents
- Telegram configuration using `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`
- Shared Telegram API request helper with timeout and JSON parsing
- Notification formatting and dispatch helpers (`notifyTelegram`, `sendTelegramMessage`)
- Mission chat forwarding helper (`sendChatToTelegram`)
- Bot status helper (`getTelegramBotInfo`) used by backend status endpoint
- Polling loop for inbound Telegram messages (`startTelegramPolling`)
- Incoming message parser that filters bot-authored updates and non-target chat IDs

## Runtime Variables
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

## When to Update
Update when Telegram API behavior, notification format, polling strategy, or chat filtering rules change.

## Related Files
- `openclaw-dashboard/mock-backend.js`
- `openclaw-dashboard/.env`
- `openclaw-dashboard/.env.example`
- `openclaw-dashboard/src/MissionControl.jsx`
