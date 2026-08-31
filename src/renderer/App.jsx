import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ChatPanel from './components/ChatPanel';
import CodeEditor from './components/CodeEditor';
import Terminal from './components/Terminal';
import SandboxPanel from './components/SandboxPanel';
import AutomationPanel from './components/AutomationPanel';
import StoragePanel from './components/StoragePanel';
import LearningPanel from './components/LearningPanel';
import KnowledgePanel from './components/KnowledgePanel';
import SettingsPanel from './components/SettingsPanel';
import FileManager from './components/FileManager';
import Dashboard from './components/Dashboard';

const pix = window.pix;

function App() {
  const [activePanel, setActivePanel] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [config, setConfig] = useState(null);
  const [apiKeys, setApiKeys] = useState({});
  const [systemInfo, setSystemInfo] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);

  useEffect(() => {
    loadConfig();
    loadSystemInfo();
    createSession();
  }, []);

  const loadConfig = async () => {
    try {
      const cfg = await pix.config.get();
      setConfig(cfg);
      const keys = await pix.config.getApiKeys();
      setApiKeys(keys || {});
    } catch (e) {
      console.error('Failed to load config:', e);
    }
  };

  const loadSystemInfo = async () => {
    try {
      const info = await pix.system.info();
      setSystemInfo(info);
    } catch (e) {
      console.error('Failed to load system info:', e);
    }
  };

  const createSession = async () => {
    try {
      const { sessionId } = await pix.session.create({ type: 'main' });
      setActiveSession(sessionId);
    } catch (e) {
      console.error('Failed to create session:', e);
    }
  };

  const handleConfigUpdate = async (key, value) => {
    await pix.config.set(key, value);
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleApiKeysUpdate = async (keys) => {
    await pix.config.setApiKeys(keys);
    setApiKeys(keys);
  };

  const renderPanel = () => {
    switch (activePanel) {
      case 'dashboard':
        return <Dashboard systemInfo={systemInfo} sessions={sessions} />;
      case 'chat':
        return <ChatPanel session={activeSession} apiKeys={apiKeys} />;
      case 'code':
        return <CodeEditor session={activeSession} />;
      case 'terminal':
        return <Terminal session={activeSession} />;
      case 'sandbox':
        return <SandboxPanel session={activeSession} />;
      case 'automation':
        return <AutomationPanel session={activeSession} />;
      case 'storage':
        return <StoragePanel session={activeSession} />;
      case 'learning':
        return <LearningPanel session={activeSession} />;
      case 'knowledge':
        return <KnowledgePanel apiKeys={apiKeys} />;
      case 'files':
        return <FileManager session={activeSession} />;
      case 'settings':
        return <SettingsPanel
          config={config}
          apiKeys={apiKeys}
          onConfigUpdate={handleConfigUpdate}
          onApiKeysUpdate={handleApiKeysUpdate}
        />;
      default:
        return <Dashboard systemInfo={systemInfo} />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <Sidebar
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        marginLeft: sidebarCollapsed ? '60px' : 'var(--sidebar-width)'
      }}>
        <Header
          activePanel={activePanel}
          session={activeSession}
          systemInfo={systemInfo}
        />
        <main style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px'
        }}>
          {renderPanel()}
        </main>
      </div>
    </div>
  );
}

export default App;
