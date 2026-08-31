import React, { useState, useEffect, useRef } from 'react';

const pix = window.pix;

function ChatPanel({ session, apiKeys }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState('gemini-pro');
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState('You are Pix, a powerful AI assistant created by the makers of Lux and Vokk. You have access to file systems, automation, coding, and can control applications. You can take screenshots, click, type, download files, open and close apps. You have a sandbox for testing code and large storage for saving code. You can learn from other apps using vision. Always be helpful, creative, and proactive.');
  const [showSettings, setShowSettings] = useState(false);
  const [models, setModels] = useState([]);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    loadModels();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadModels = async () => {
    try {
      const availableModels = await pix.ai.getAvailableModels?.() || [
        { id: 'gemini-pro', name: 'Gemini Pro', provider: 'gemini' },
        { id: 'gemini-ultra', name: 'Gemini Ultra', provider: 'gemini' },
        { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'groq' },
        { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', provider: 'groq' },
        { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'openrouter' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openrouter' },
        { id: 'zai-default', name: 'Z AI Default', provider: 'zai' }
      ];
      setModels(availableModels);
    } catch (e) {
      setModels([
        { id: 'gemini-pro', name: 'Gemini Pro', provider: 'gemini' },
        { id: 'groq-llama', name: 'Groq Llama', provider: 'groq' }
      ]);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await pix.ai.complete({
        prompt: input,
        model,
        systemPrompt,
        temperature,
        conversationId: session
      });

      const assistantMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: response.content,
        model,
        usage: response.usage,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get response'}`,
        error: true,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleScreenshot = async () => {
    try {
      const screenshot = await pix.automation.screenshot();
      setInput(prev => prev + `\n[Screenshot taken: ${screenshot.filepath}]`);
    } catch (e) {
      console.error('Screenshot failed:', e);
    }
  };

  const handleVision = async () => {
    try {
      const screenshot = await pix.automation.screenshot();
      const imageData = await pix.storage.load({ id: screenshot.filepath });
      const response = await pix.ai.vision({
        images: [imageData],
        prompt: 'Describe what you see in this screenshot in detail.',
        model
      });
      const assistantMessage = {
        id: Date.now(),
        role: 'assistant',
        content: `📸 Vision Analysis:\n\n${response.content}`,
        model,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (e) {
      console.error('Vision failed:', e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - 32px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{ minWidth: '200px' }}
          >
            {models.map(m => (
              <option key={m.id} value={m.id}>{m.name} ({m.provider})</option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Temp:</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              style={{ width: '80px' }}
            />
            <span style={{ fontSize: '12px' }}>{temperature}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleScreenshot} className="secondary" style={{ padding: '6px 12px' }}>
            📸 Screenshot
          </button>
          <button onClick={handleVision} className="secondary" style={{ padding: '6px 12px' }}>
            👁️ Vision
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="secondary" style={{ padding: '6px 12px' }}>
            ⚙️
          </button>
        </div>
      </div>

      {showSettings && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '16px'
        }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
            System Prompt
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            style={{ width: '100%', height: '100px', resize: 'vertical' }}
          />
        </div>
      )}

      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--border)'
      }}>
        {messages.length === 0 && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)'
          }}>
            <span style={{ fontSize: '48px', marginBottom: '16px' }}>✨</span>
            <h3 style={{ marginBottom: '8px' }}>Welcome to Pix AI</h3>
            <p style={{ fontSize: '14px' }}>Start a conversation or use the tools above</p>
          </div>
        )}

        {messages.map(message => (
          <div
            key={message.id}
            style={{
              display: 'flex',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              gap: '12px'
            }}
          >
            <div style={{
              maxWidth: '70%',
              padding: '12px 16px',
              borderRadius: '12px',
              background: message.role === 'user'
                ? 'var(--accent)'
                : message.error
                  ? 'rgba(239, 68, 68, 0.2)'
                  : 'var(--bg-tertiary)',
              border: message.error ? '1px solid var(--error)' : 'none',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {message.role === 'assistant' && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  {message.model || 'Pix AI'}
                </div>
              )}
              {message.content}
              {message.usage && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Tokens: {message.usage.total_tokens || 'N/A'}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'var(--bg-tertiary)'
            }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                <span className="animate-pulse">●</span>
                <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
                <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{
        marginTop: '16px',
        display: 'flex',
        gap: '8px'
      }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Shift+Enter for new line)"
          style={{
            flex: 1,
            height: '80px',
            resize: 'none',
            padding: '12px'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          style={{
            width: '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {loading ? '⏳' : '→'}
        </button>
      </div>
    </div>
  );
}

export default ChatPanel;
