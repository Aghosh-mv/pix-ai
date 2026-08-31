import React from 'react';

const pix = window.pix;

const panels = [
  { id: 'dashboard', name: 'Dashboard', icon: '📊', shortcut: '1' },
  { id: 'chat', name: 'AI Chat', icon: '🤖', shortcut: '2' },
  { id: 'code', name: 'Code Editor', icon: '💻', shortcut: '3' },
  { id: 'terminal', name: 'Terminal', icon: '⬛', shortcut: '4' },
  { id: 'sandbox', name: 'Sandbox', icon: '🧪', shortcut: '5' },
  { id: 'automation', name: 'Automation', icon: '⚙️', shortcut: '6' },
  { id: 'storage', name: 'Storage', icon: '💾', shortcut: '7' },
  { id: 'learning', name: 'Learning', icon: '🧠', shortcut: '8' },
  { id: 'knowledge', name: 'Knowledge', icon: '📚', shortcut: '9' },
  { id: 'files', name: 'Files', icon: '📁', shortcut: '0' },
  { id: 'settings', name: 'Settings', icon: '⚙️', shortcut: 'S' }
];

function Sidebar({ activePanel, onPanelChange, collapsed, onToggleCollapse }) {
  return (
    <div style={{
      width: collapsed ? '60px' : 'var(--sidebar-width)',
      height: '100vh',
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 100,
      transition: 'width 0.2s ease'
    }}>
      <div style={{
        height: 'var(--header-height)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid var(--border)'
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '24px' }}>✨</span>
            <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Pix</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>v1.0</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '16px'
          }}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
        {panels.map(panel => (
          <button
            key={panel.id}
            onClick={() => onPanelChange(panel.id)}
            title={collapsed ? panel.name : undefined}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: collapsed ? '12px' : '12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              background: activePanel === panel.id ? 'var(--accent)' : 'transparent',
              color: activePanel === panel.id ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: '4px',
              transition: 'all 0.2s'
            }}
          >
            <span style={{ fontSize: '18px' }}>{panel.icon}</span>
            {!collapsed && (
              <>
                <span style={{ flex: 1, textAlign: 'left' }}>{panel.name}</span>
                <kbd style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '4px',
                  color: 'var(--text-muted)'
                }}>
                  {panel.shortcut}
                </kbd>
              </>
            )}
          </button>
        ))}
      </nav>

      {!collapsed && (
        <div style={{
          padding: '16px',
          borderTop: '1px solid var(--border)',
          fontSize: '12px',
          color: 'var(--text-muted)',
          textAlign: 'center'
        }}>
          <div>Pix AI Harness</div>
          <div>by Lux & Vokk creators</div>
        </div>
      )}
    </div>
  );
}

export default Sidebar;
