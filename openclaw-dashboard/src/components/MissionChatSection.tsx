import React, { useState, useEffect, useRef } from 'react';

// Types
interface ChatMessage {
  id?: string;
  author: string;
  message: string;
  time: string;
  role: string;
}

interface MissionChatSectionProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isSending: boolean;
  dataSourceMode: string;
  connectionStatus: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

// MissionChatSection Component - Extracted from MissionControl.jsx
export const MissionChatSection: React.FC<MissionChatSectionProps> = ({
  messages,
  onSendMessage,
  isSending,
  dataSourceMode,
  connectionStatus,
  isOpen,
  onOpen,
  onClose
}) => {
  const [draftMessage, setDraftMessage] = useState('');
  const messageContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const container = messageContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [isOpen, messages]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedMessage = draftMessage.trim();

    if (!trimmedMessage || isSending) {
      return;
    }

    onSendMessage(trimmedMessage);
    setDraftMessage('');
  };

  const syncLabel = dataSourceMode === 'live'
    ? `Live sync (${connectionStatus})`
    : 'Local mock sync';

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      {!isOpen && (
        <button type="button" className="mission-chat-launcher" onClick={onOpen}>
          <span>Open Chat</span>
          <span className="mission-chat-launcher-count">{messages.length}</span>
        </button>
      )}

      {isOpen && (
        <div className="mission-chat-overlay" onClick={handleOverlayClick}>
          <section className="mission-chat-section mission-chat-section-fullscreen" aria-label="Mission chat section">
            <div className="mission-chat-header">
              <div>
                <div className="mission-chat-title">MISSION CHAT</div>
                <div className="mission-chat-subtitle">Chat directly with OpenClaw orchestration</div>
              </div>
              <div className="mission-chat-header-actions">
                <span className={`mission-chat-sync mission-chat-sync-${dataSourceMode}`}>{syncLabel}</span>
                <button type="button" className="mission-chat-collapse-btn" onClick={onClose}>
                  Collapse
                </button>
              </div>
            </div>

            <div className="mission-chat-messages" role="log" aria-live="polite" ref={messageContainerRef}>
              {messages.length === 0 && (
                <div className="mission-chat-empty">No messages yet. Start a conversation with OpenClaw.</div>
              )}

              {messages.map((message, index) => (
                <div key={message.id || `chat-${index}`} className={`chat-message-row chat-message-row-${message.role}`}>
                  <div className={`chat-message-bubble chat-message-bubble-${message.role}`}>
                    <div className="chat-message-meta">
                      <span>{message.author}</span>
                      <span>{message.time}</span>
                    </div>
                    <div className="chat-message-text">{message.message}</div>
                  </div>
                </div>
              ))}
            </div>

            <form className="mission-chat-compose" onSubmit={handleSubmit}>
              <label htmlFor="mission-chat-input" className="mission-chat-label">Message OpenClaw</label>
              <div className="mission-chat-input-row">
                <input
                  id="mission-chat-input"
                  type="text"
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder="Ask OpenClaw for a plan, summary, or next action..."
                />
                <button type="submit" disabled={isSending || !draftMessage.trim()}>
                  {isSending ? 'Sending...' : 'Send to OpenClaw'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
};

export default MissionChatSection;
