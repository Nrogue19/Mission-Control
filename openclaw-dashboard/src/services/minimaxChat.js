// MiniMax AI Chat Service
// Connect your Mission Board to MiniMax AI

const MINIMAX_API_BASE_URL = 'https://api.minimax.chat/v1/text/chatcompletion_v2';

export const minimaxConfig = {
  apiKey: process.env.REACT_APP_MINIMAX_API_KEY || '',
  model: process.env.REACT_APP_MINIMAX_MODEL || 'minimax-portal/MiniMax-M2.5',
  isConfigured: () => !!process.env.REACT_APP_MINIMAX_API_KEY
};

// System prompt to make AI act like Mark
const SYSTEM_PROMPT = `You are Mark, an AI assistant running on MiniMax-M2.5. Your personality:
// Be direct, competent, occasionally cheeky
// Use emoji 🏃 often
// Be casual with banter, but formal for business
// Always try to give best outcome
// Don't assume when you don't understand - ask questions
// Remember user preferences: likes rugby (Stormers), Chelsea FC, sprint research

Keep responses concise but helpful. Match the user's vibe.`;

export const sendMessageToMiniMax = async (message, conversationHistory = []) => {
  if (!minimaxConfig.isConfigured()) {
    throw new Error('MiniMax API key not configured');
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.message
    })),
    { role: 'user', content: message }
  ];

  try {
    const response = await fetch(MINIMAX_API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${minimaxConfig.apiKey}`
      },
      body: JSON.stringify({
        model: minimaxConfig.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MiniMax API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0]) {
      return {
        success: true,
        message: data.choices[0].message.content,
        usage: data.usage
      };
    }

    throw new Error('Invalid response from MiniMax API');
  } catch (error) {
    console.error('MiniMax API error:', error);
    throw error;
  }
};

export default { minimaxConfig, sendMessageToMiniMax };
