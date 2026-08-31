import React, { useState, useEffect } from 'react';

const pix = window.pix;

function SettingsPanel({ config, apiKeys, onConfigUpdate, onApiKeysUpdate }) {
  const [activeSection, setActiveSection] = useState('general');
  const [localApiKeys, setLocalApiKeys] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalApiKeys(apiKeys || {});
  }, [apiKeys]);

  const handleSaveApiKeys = async () => {
    await onApiKeysUpdate(localApiKeys);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const sections = [
    { id: 'general', name: 'General', icon: '⚙️' },
    { id: 'api', name: 'API Keys', icon: '🔑' },
    { id: 'ai', name: 'AI Settings', icon: '🤖' },
    { id: 'automation', name: 'Automation', icon: '🔄' },
    { id: 'sandbox', name: 'Sandbox', icon: '🧪' },
    { id: 'storage', name: 'Storage', icon: '💾' },
    { id: 'ui', name: 'Interface', icon: '🎨' },
    { id: 'about', name: 'About', icon: 'ℹ️' }
  ];

  return (
    <div style={{ display: 'flex', gap: '16px', height: 'calc(100vh - var(--header-height) - 32px)' }}>
      <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              background: activeSection === section.id ? 'var(--accent)' : 'transparent',
              color: activeSection === section.id ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left'
            }}
          >
            <span>{section.icon}</span>
            <span>{section.name}</span>
          </button>
        ))}
      </div>

      <div style={{
        flex: 1,
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        padding: '24px',
        overflowY: 'auto'
      }}>
        {activeSection === 'general' && (
          <div>
            <h3 style={{ marginBottom: '20px' }}>General Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SettingToggle
                label="Auto Save"
                description="Automatically save files when changed"
                value={config?.general?.autoSave ?? true}
                onChange={(v) => onConfigUpdate('general.autoSave', v)}
              />
              <SettingToggle
                label="Auto Update"
                description="Automatically update Pix when new versions are available"
                value={config?.general?.autoUpdate ?? true}
                onChange={(v) => onConfigUpdate('general.autoUpdate', v)}
              />
              <SettingToggle
                label="Notifications"
                description="Show desktop notifications"
                value={config?.general?.notifications ?? true}
                onChange={(v) => onConfigUpdate('general.notifications', v)}
              />
              <SettingToggle
                label="Minimize to Tray"
                description="Minimize to system tray instead of closing"
                value={config?.general?.minimizeToTray ?? true}
                onChange={(v) => onConfigUpdate('general.minimizeToTray', v)}
              />
              <SettingToggle
                label="Start Minimized"
                description="Start Pix minimized"
                value={config?.general?.startMinimized ?? false}
                onChange={(v) => onConfigUpdate('general.startMinimized', v)}
              />
            </div>
          </div>
        )}

        {activeSection === 'api' && (
          <div>
            <h3 style={{ marginBottom: '20px' }}>API Keys</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Configure your API keys to unlock different AI providers and features.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <ApiKeyInput
                label="Gemini API Key"
                description="Google Gemini AI - for chat, vision, and code generation"
                value={localApiKeys.gemini || ''}
                onChange={(v) => setLocalApiKeys(prev => ({ ...prev, gemini: v }))}
                placeholder="AIza..."
              />
              <ApiKeyInput
                label="Groq API Key"
                description="Groq - for fast inference with Llama, Mixtral, and more"
                value={localApiKeys.groq || ''}
                onChange={(v) => setLocalApiKeys(prev => ({ ...prev, groq: v }))}
                placeholder="gsk_..."
              />
              <ApiKeyInput
                label="OpenRouter API Key"
                description="OpenRouter - for access to Claude, GPT-4, and many other models"
                value={localApiKeys.openrouter || ''}
                onChange={(v) => setLocalApiKeys(prev => ({ ...prev, openrouter: v }))}
                placeholder="sk-or-..."
              />
              <ApiKeyInput
                label="Z AI API Key"
                description="Z AI - primary AI provider"
                value={localApiKeys.zai || ''}
                onChange={(v) => setLocalApiKeys(prev => ({ ...prev, zai: v }))}
                placeholder="zai_..."
              />
              <ApiKeyInput
                label="SERP API Key"
                description="SerpAPI - for web search, news, and knowledge"
                value={localApiKeys.serp || ''}
                onChange={(v) => setLocalApiKeys(prev => ({ ...prev, serp: v }))}
                placeholder="..."
              />
              <button onClick={handleSaveApiKeys} style={{ alignSelf: 'flex-start' }}>
                {saved ? '✓ Saved!' : '💾 Save API Keys'}
              </button>
            </div>
          </div>
        )}

        {activeSection === 'ai' && (
          <div>
            <h3 style={{ marginBottom: '20px' }}>AI Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SettingSelect
                label="Default Provider"
                value={config?.ai?.defaultProvider || 'gemini'}
                options={[
                  { value: 'gemini', label: 'Gemini' },
                  { value: 'groq', label: 'Groq' },
                  { value: 'openrouter', label: 'OpenRouter' },
                  { value: 'zai', label: 'Z AI' }
                ]}
                onChange={(v) => onConfigUpdate('ai.defaultProvider', v)}
              />
              <SettingRange
                label="Temperature"
                description="Controls randomness (0 = deterministic, 2 = creative)"
                value={config?.ai?.temperature ?? 0.7}
                min={0}
                max={2}
                step={0.1}
                onChange={(v) => onConfigUpdate('ai.temperature', v)}
              />
              <SettingRange
                label="Max Tokens"
                description="Maximum tokens in AI response"
                value={config?.ai?.maxTokens ?? 4096}
                min={256}
                max={128000}
                step={256}
                onChange={(v) => onConfigUpdate('ai.maxTokens', v)}
              />
              <SettingToggle
                label="Stream Responses"
                description="Show AI responses as they are generated"
                value={config?.ai?.streamResponses ?? true}
                onChange={(v) => onConfigUpdate('ai.streamResponses', v)}
              />
              <SettingToggle
                label="Save Conversation History"
                description="Keep a history of AI conversations"
                value={config?.ai?.saveHistory ?? true}
                onChange={(v) => onConfigUpdate('ai.saveHistory', v)}
              />
            </div>
          </div>
        )}

        {activeSection === 'automation' && (
          <div>
            <h3 style={{ marginBottom: '20px' }}>Automation Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SettingRange
                label="Screenshot Quality"
                description="Quality of screenshots (1-100)"
                value={config?.automation?.screenshotQuality ?? 100}
                min={1}
                max={100}
                step={1}
                onChange={(v) => onConfigUpdate('automation.screenshotQuality', v)}
              />
              <SettingRange
                label="Mouse Delay"
                description="Delay between mouse actions (ms)"
                value={config?.automation?.mouseDelay ?? 50}
                min={0}
                max={500}
                step={10}
                onChange={(v) => onConfigUpdate('automation.mouseDelay', v)}
              />
              <SettingRange
                label="Type Delay"
                description="Delay between keystrokes (ms)"
                value={config?.automation?.typeDelay ?? 50}
                min={0}
                max={200}
                step={10}
                onChange={(v) => onConfigUpdate('automation.typeDelay', v)}
              />
              <SettingToggle
                label="Record Actions"
                description="Record automation actions for replay"
                value={config?.automation?.recordingEnabled ?? false}
                onChange={(v) => onConfigUpdate('automation.recordingEnabled', v)}
              />
            </div>
          </div>
        )}

        {activeSection === 'sandbox' && (
          <div>
            <h3 style={{ marginBottom: '20px' }}>Sandbox Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SettingSelect
                label="Default Language"
                value={config?.sandbox?.defaultLanguage || 'javascript'}
                options={[
                  { value: 'javascript', label: 'JavaScript' },
                  { value: 'typescript', label: 'TypeScript' },
                  { value: 'python', label: 'Python' },
                  { value: 'ruby', label: 'Ruby' },
                  { value: 'go', label: 'Go' },
                  { value: 'rust', label: 'Rust' }
                ]}
                onChange={(v) => onConfigUpdate('sandbox.defaultLanguage', v)}
              />
              <SettingRange
                label="Max Sandboxes"
                description="Maximum number of concurrent sandboxes"
                value={config?.sandbox?.maxSandboxes ?? 10}
                min={1}
                max={50}
                step={1}
                onChange={(v) => onConfigUpdate('sandbox.maxSandboxes', v)}
              />
              <SettingRange
                label="Default Timeout (ms)"
                description="Maximum execution time for sandbox code"
                value={config?.sandbox?.defaultTimeout ?? 300000}
                min={1000}
                max={600000}
                step={1000}
                onChange={(v) => onConfigUpdate('sandbox.defaultTimeout', v)}
              />
              <SettingToggle
                label="Network Access"
                description="Allow sandbox to access the network"
                value={config?.sandbox?.networkAccess ?? false}
                onChange={(v) => onConfigUpdate('sandbox.networkAccess', v)}
              />
              <SettingToggle
                label="Auto Cleanup"
                description="Automatically destroy unused sandboxes"
                value={config?.sandbox?.autoCleanup ?? true}
                onChange={(v) => onConfigUpdate('sandbox.autoCleanup', v)}
              />
            </div>
          </div>
        )}

        {activeSection === 'storage' && (
          <div>
            <h3 style={{ marginBottom: '20px' }}>Storage Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SettingRange
                label="Max Files"
                description="Maximum number of files in storage"
                value={config?.storage?.maxFiles ?? 100000}
                min={1000}
                max={1000000}
                step={1000}
                onChange={(v) => onConfigUpdate('storage.maxFiles', v)}
              />
              <SettingToggle
                label="Compression"
                description="Compress files to save disk space"
                value={config?.storage?.compressionEnabled ?? true}
                onChange={(v) => onConfigUpdate('storage.compressionEnabled', v)}
              />
              <SettingToggle
                label="Auto Backup"
                description="Automatically backup storage"
                value={config?.storage?.backupEnabled ?? true}
                onChange={(v) => onConfigUpdate('storage.backupEnabled', v)}
              />
            </div>
          </div>
        )}

        {activeSection === 'ui' && (
          <div>
            <h3 style={{ marginBottom: '20px' }}>Interface Settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <SettingRange
                label="Editor Font Size"
                description="Font size in the code editor"
                value={config?.ui?.editorFontSize ?? 14}
                min={10}
                max={24}
                step={1}
                onChange={(v) => onConfigUpdate('ui.editorFontSize', v)}
              />
              <SettingRange
                label="Tab Size"
                description="Number of spaces per tab"
                value={config?.ui?.editorTabSize ?? 2}
                min={2}
                max={8}
                step={1}
                onChange={(v) => onConfigUpdate('ui.editorTabSize', v)}
              />
              <SettingToggle
                label="Show Line Numbers"
                description="Display line numbers in the editor"
                value={config?.ui?.showLineNumbers ?? true}
                onChange={(v) => onConfigUpdate('ui.showLineNumbers', v)}
              />
              <SettingToggle
                label="Word Wrap"
                description="Wrap long lines in the editor"
                value={config?.ui?.editorWordWrap === 'on'}
                onChange={(v) => onConfigUpdate('ui.editorWordWrap', v ? 'on' : 'off')}
              />
            </div>
          </div>
        )}

        {activeSection === 'about' && (
          <div>
            <h3 style={{ marginBottom: '20px' }}>About Pix</h3>
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '64px', marginBottom: '16px' }}>✨</div>
              <h2 style={{ marginBottom: '8px' }}>Pix AI Harness</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Version 1.0.0</p>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
                Built by the creators of Lux and Vokk
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px',
                marginTop: '24px'
              }}>
                <div style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🤖</div>
                  <div style={{ fontWeight: '600' }}>Multi-AI</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Gemini, Groq, OpenRouter, Z AI</div>
                </div>
                <div style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔄</div>
                  <div style={{ fontWeight: '600' }}>Automation</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Screenshots, Clicks, Typing</div>
                </div>
                <div style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  padding: '16px'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>🧪</div>
                  <div style={{ fontWeight: '600' }}>Sandbox</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Safe code execution</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SettingToggle({ label, description, value, onChange }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid var(--border)'
    }}>
      <div>
        <div style={{ fontWeight: '500' }}>{label}</div>
        {description && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{description}</div>
        )}
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: '48px',
          height: '24px',
          borderRadius: '12px',
          background: value ? 'var(--accent)' : 'var(--bg-tertiary)',
          border: '1px solid var(--border)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'all 0.2s'
        }}
      >
        <div style={{
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: 'white',
          position: 'absolute',
          top: '2px',
          left: value ? '26px' : '2px',
          transition: 'left 0.2s'
        }} />
      </button>
    </div>
  );
}

function SettingSelect({ label, value, options, onChange }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 0',
      borderBottom: '1px solid var(--border)'
    }}>
      <div style={{ fontWeight: '500' }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function SettingRange({ label, description, value, min, max, step, onChange }) {
  return (
    <div style={{
      padding: '12px 0',
      borderBottom: '1px solid var(--border)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div>
          <div style={{ fontWeight: '500' }}>{label}</div>
          {description && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{description}</div>
          )}
        </div>
        <span style={{ fontWeight: '500' }}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}

function ApiKeyInput({ label, description, value, onChange, placeholder }) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div style={{
      padding: '16px',
      background: 'var(--bg-tertiary)',
      borderRadius: '8px',
      border: '1px solid var(--border)'
    }}>
      <div style={{ fontWeight: '500', marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
        {description}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type={showKey ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1 }}
        />
        <button
          onClick={() => setShowKey(!showKey)}
          className="secondary"
          style={{ padding: '8px 12px' }}
        >
          {showKey ? '🙈' : '👁️'}
        </button>
      </div>
    </div>
  );
}

export default SettingsPanel;
