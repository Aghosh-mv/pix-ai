import React, { useState, useEffect } from 'react';

function Header({ activePanel, session, systemInfo }) {
  const [time, setTime] = useState(new Date());
  const [cpuUsage, setCpuUsage] = useState(0);
  const [memUsage, setMemUsage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (systemInfo) {
      const usedMem = systemInfo.totalMemory - systemInfo.freeMemory;
      setMemUsage(Math.round((usedMem / systemInfo.totalMemory) * 100));
    }
  }, [systemInfo]);

  const panelNames = {
    dashboard: 'Dashboard',
    chat: 'AI Chat',
    code: 'Code Editor',
    terminal: 'Terminal',
    sandbox: 'Sandbox',
    automation: 'Automation',
    storage: 'Storage',
    learning: 'Learning',
    knowledge: 'Knowledge',
    files: 'Files',
    settings: 'Settings'
  };

  return (
    <header style={{
      height: 'var(--header-height)',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600' }}>
          {panelNames[activePanel] || 'Pix'}
        </h2>
        {session && (
          <span className="badge info" style={{ fontSize: '10px' }}>
            Session: {session.substring(0, 8)}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {systemInfo && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>CPU:</span>
              <div style={{
                width: '60px',
                height: '4px',
                background: 'var(--bg-tertiary)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${cpuUsage}%`,
                  height: '100%',
                  background: cpuUsage > 80 ? 'var(--error)' : 'var(--accent)',
                  transition: 'width 0.5s'
                }} />
              </div>
              <span>{cpuUsage}%</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <span style={{ color: 'var(--text-muted)' }}>RAM:</span>
              <div style={{
                width: '60px',
                height: '4px',
                background: 'var(--bg-tertiary)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${memUsage}%`,
                  height: '100%',
                  background: memUsage > 80 ? 'var(--error)' : 'var(--accent)',
                  transition: 'width 0.5s'
                }} />
              </div>
              <span>{memUsage}%</span>
            </div>

            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {systemInfo.platform} {systemInfo.arch}
            </div>
          </>
        )}

        <div style={{ fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
          {time.toLocaleTimeString()}
        </div>
      </div>
    </header>
  );
}

export default Header;
