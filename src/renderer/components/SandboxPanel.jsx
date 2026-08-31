import React, { useState, useEffect } from 'react';

const pix = window.pix;

function SandboxPanel({ session }) {
  const [sandboxes, setSandboxes] = useState([]);
  const [selectedSandbox, setSelectedSandbox] = useState(null);
  const [code, setCode] = useState('// Write your code here\nconsole.log("Hello from Pix Sandbox!");');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [packages, setPackages] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSandboxName, setNewSandboxName] = useState('');
  const [newSandboxLang, setNewSandboxLang] = useState('javascript');

  useEffect(() => {
    loadSandboxes();
  }, []);

  const loadSandboxes = async () => {
    try {
      const list = await pix.sandbox.list();
      setSandboxes(list || []);
    } catch (e) {
      console.error('Failed to load sandboxes:', e);
    }
  };

  const createSandbox = async () => {
    try {
      const sandbox = await pix.sandbox.create({
        name: newSandboxName || `sandbox-${Date.now()}`,
        language: newSandboxLang
      });
      setSelectedSandbox(sandbox);
      setShowCreateModal(false);
      await loadSandboxes();
    } catch (e) {
      console.error('Failed to create sandbox:', e);
    }
  };

  const executeCode = async () => {
    if (!code.trim()) return;
    setRunning(true);
    setOutput('Running...\n');

    try {
      const result = await pix.sandbox.execute({
        sandboxId: selectedSandbox?.id,
        code,
        language
      });

      setOutput(result.stdout || '');
      if (result.stderr) {
        setOutput(prev => prev + '\n' + result.stderr);
      }
      if (result.duration) {
        setOutput(prev => prev + `\n\nCompleted in ${result.duration}ms`);
      }
    } catch (error) {
      setOutput(`Error: ${error.error || error.message || 'Execution failed'}`);
    } finally {
      setRunning(false);
    }
  };

  const installPackages = async () => {
    if (!selectedSandbox || !packages.trim()) return;

    try {
      await pix.sandbox.install({
        sandboxId: selectedSandbox.id,
        packages: packages.split(',').map(p => p.trim())
      });
      setOutput(prev => prev + '\n\nPackages installed successfully!');
    } catch (e) {
      setOutput(prev => prev + `\n\nFailed to install packages: ${e.error || e.message}`);
    }
  };

  const destroySandbox = async (sandboxId) => {
    try {
      await pix.sandbox.destroy({ sandboxId });
      if (selectedSandbox?.id === sandboxId) {
        setSelectedSandbox(null);
      }
      await loadSandboxes();
    } catch (e) {
      console.error('Failed to destroy sandbox:', e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - 32px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px' }}>Sandbox Environment</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowCreateModal(true)} className="success">
            + New Sandbox
          </button>
          <button onClick={loadSandboxes} className="secondary">
            🔄 Refresh
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
        <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Sandboxes ({sandboxes.length})
          </h4>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            padding: '8px'
          }}>
            {sandboxes.map(sandbox => (
              <div
                key={sandbox.id}
                style={{
                  padding: '12px',
                  background: selectedSandbox?.id === sandbox.id ? 'var(--accent)' : 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  marginBottom: '8px',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedSandbox(sandbox)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '500' }}>{sandbox.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); destroySandbox(sandbox.id); }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--error)',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {sandbox.language} • {sandbox.status}
                </div>
              </div>
            ))}

            {sandboxes.length === 0 && (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: 'var(--text-muted)'
              }}>
                No sandboxes yet. Create one to start!
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="ruby">Ruby</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
              <option value="bash">Bash</option>
            </select>
            <input
              value={packages}
              onChange={(e) => setPackages(e.target.value)}
              placeholder="Packages (comma separated)"
              style={{ flex: 1 }}
            />
            <button onClick={installPackages} className="secondary" disabled={!selectedSandbox}>
              📦 Install
            </button>
            <button onClick={executeCode} disabled={running} className="success">
              {running ? '⏳ Running...' : '▶ Run'}
            </button>
          </div>

          <div style={{
            flex: 1,
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            overflow: 'hidden'
          }}>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '12px',
                padding: '16px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '14px',
                lineHeight: '1.6',
                resize: 'none',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
              }}
              spellCheck={false}
            />
          </div>

          <div style={{
            height: '200px',
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '8px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '12px', fontWeight: '600' }}>Output</span>
              <button
                onClick={() => setOutput('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Clear
              </button>
            </div>
            <pre style={{
              flex: 1,
              margin: 0,
              padding: '16px',
              overflow: 'auto',
              fontSize: '12px',
              fontFamily: "'JetBrains Mono', monospace"
            }}>
              {output || 'No output yet. Click Run to execute.'}
            </pre>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            padding: '24px',
            width: '400px',
            border: '1px solid var(--border)'
          }}>
            <h3 style={{ marginBottom: '16px' }}>Create New Sandbox</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input
                value={newSandboxName}
                onChange={(e) => setNewSandboxName(e.target.value)}
                placeholder="Sandbox name"
              />
              <select value={newSandboxLang} onChange={(e) => setNewSandboxLang(e.target.value)}>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="ruby">Ruby</option>
                <option value="go">Go</option>
                <option value="rust">Rust</option>
                <option value="bash">Bash</option>
              </select>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setShowCreateModal(false)} className="secondary">
                  Cancel
                </button>
                <button onClick={createSandbox} className="success">
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SandboxPanel;
