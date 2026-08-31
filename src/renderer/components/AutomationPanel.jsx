import React, { useState, useEffect } from 'react';

const pix = window.pix;

function AutomationPanel({ session }) {
  const [apps, setApps] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [recording, setRecording] = useState(false);
  const [recordedActions, setRecordedActions] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [log, setLog] = useState([]);
  const [automationType, setAutomationType] = useState('screenshot');

  useEffect(() => {
    loadApps();
    loadWebhooks();
  }, []);

  const loadApps = async () => {
    try {
      const appList = await pix.automation.app.list();
      setApps(appList || []);
    } catch (e) {
      console.error('Failed to load apps:', e);
    }
  };

  const loadWebhooks = async () => {
    try {
      const hookList = await pix.automation.webhook?.list?.() || [];
      setWebhooks(hookList);
    } catch (e) {}
  };

  const addLog = (message, type = 'info') => {
    setLog(prev => [...prev, { message, type, timestamp: new Date().toISOString() }]);
  };

  const handleScreenshot = async () => {
    try {
      addLog('Taking screenshot...', 'info');
      const result = await pix.automation.screenshot();
      setScreenshots(prev => [result, ...prev].slice(0, 20));
      addLog(`Screenshot saved: ${result.filename}`, 'success');
    } catch (e) {
      addLog(`Screenshot failed: ${e.message}`, 'error');
    }
  };

  const handleClick = async (x, y) => {
    try {
      addLog(`Clicking at (${x}, ${y})...`, 'info');
      await pix.automation.click({ x, y });
      addLog(`Clicked at (${x}, ${y})`, 'success');
    } catch (e) {
      addLog(`Click failed: ${e.message}`, 'error');
    }
  };

  const handleType = async (text) => {
    try {
      addLog(`Typing: ${text.substring(0, 30)}...`, 'info');
      await pix.automation.type({ text });
      addLog('Text typed successfully', 'success');
    } catch (e) {
      addLog(`Type failed: ${e.message}`, 'error');
    }
  };

  const handleOpenApp = async (appName) => {
    try {
      addLog(`Opening ${appName}...`, 'info');
      await pix.automation.app.open({ name: appName });
      addLog(`${appName} opened`, 'success');
    } catch (e) {
      addLog(`Failed to open ${appName}: ${e.message}`, 'error');
    }
  };

  const handleCloseApp = async (appName) => {
    try {
      addLog(`Closing ${appName}...`, 'info');
      await pix.automation.app.close({ name: appName });
      addLog(`${appName} closed`, 'success');
    } catch (e) {
      addLog(`Failed to close ${appName}: ${e.message}`, 'error');
    }
  };

  const handleDownload = async (url) => {
    try {
      addLog(`Downloading: ${url}...`, 'info');
      const result = await pix.automation.download({ url });
      addLog(`Downloaded: ${result.filename} (${result.size} bytes)`, 'success');
    } catch (e) {
      addLog(`Download failed: ${e.message}`, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - 32px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px' }}>Automation Center</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={loadApps} className="secondary">🔄 Refresh</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px' }}>Quick Actions</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button onClick={handleScreenshot} className="secondary">📸 Screenshot</button>
            <button onClick={() => handleType('Hello from Pix!')} className="secondary">⌨️ Type Text</button>
            <button onClick={() => handleClick(500, 300)} className="secondary">🖱️ Click (500,300)</button>
            <button onClick={() => handleDownload('https://example.com/file.txt')} className="secondary">⬇️ Download</button>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px'
        }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px' }}>Recording</h4>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button
              onClick={() => setRecording(!recording)}
              className={recording ? 'danger' : 'success'}
            >
              {recording ? '⏹ Stop' : '⏺ Record'}
            </button>
            <button
              onClick={() => setRecordedActions([])}
              className="secondary"
              disabled={recordedActions.length === 0}
            >
              🗑️ Clear
            </button>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {recordedActions.length} actions recorded
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px' }}>Applications ({apps.length})</h4>
          <div style={{ display: 'grid', gap: '4px' }}>
            {apps.slice(0, 20).map((app, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px',
                background: 'var(--bg-tertiary)',
                borderRadius: '4px'
              }}>
                <span style={{ fontSize: '12px' }}>{app.name}</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => handleOpenApp(app.name)}
                    style={{
                      background: 'var(--success)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      color: 'white'
                    }}
                  >
                    Open
                  </button>
                  <button
                    onClick={() => handleCloseApp(app.name)}
                    style={{
                      background: 'var(--error)',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      color: 'white'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '16px',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          <h4 style={{ marginBottom: '12px', fontSize: '14px' }}>Screenshots ({screenshots.length})</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {screenshots.map((ss, i) => (
              <div key={i} style={{
                background: 'var(--bg-tertiary)',
                borderRadius: '8px',
                padding: '8px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', marginBottom: '4px' }}>📸</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {ss.filename}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        flex: 1,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h4 style={{ marginBottom: '12px', fontSize: '14px' }}>Activity Log</h4>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '12px'
        }}>
          {log.map((entry, i) => (
            <div key={i} style={{
              marginBottom: '4px',
              color: entry.type === 'error' ? 'var(--error)' :
                     entry.type === 'success' ? 'var(--success)' :
                     'var(--text-secondary)'
            }}>
              <span style={{ color: 'var(--text-muted)' }}>
                [{new Date(entry.timestamp).toLocaleTimeString()}]
              </span>{' '}
              {entry.message}
            </div>
          ))}
          {log.length === 0 && (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
              No activity yet. Try some automation actions!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AutomationPanel;
