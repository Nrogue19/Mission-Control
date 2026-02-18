# components/MissionChatSection.tsx Documentation

## File
`/src/components/MissionChatSection.tsx`

## Purpose
Extracted chat component for Mission Control - handles chat UI and messaging.

## Key Props
- `messages` - Array of chat messages
- `onSendMessage` - Callback to send message
- `isSending` - Loading state
- `dataSourceMode` - 'live' or 'mock'
- `connectionStatus` - Connection status label
- `isOpen` - Chat open state
- `onOpen` - Open callback
- `onClose` - Close callback

## Features
- Chat message display with role-based styling
- Auto-scroll to latest message
- Message input with send button
- Loading states
- Overlay mode for fullscreen chat
- Dark mode support

## Types
```typescript
interface ChatMessage {
  id?: string;
  author: string;
  message: string;
  time: string;
  role: string;
}
```

## Related Files
- `MissionControl.jsx` - Parent component
- `MissionControl.css` - Chat styles
