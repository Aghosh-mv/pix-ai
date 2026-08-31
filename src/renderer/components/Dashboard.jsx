import React, { useState, useEffect } from 'react';

const pix = window.pix;

function Dashboard({ systemInfo, sessions }) {
  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const storageStats = await pix.storage.stats();
      setStats(storageStats);
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="animate-fade-in" style={{ display: 'grid', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <StatCard
          title="Total Files"
          value={stats?.totalFiles || 0}
          icon="📄"
          color="var(--accent)"
        />
        <StatCard
          title="Total Size"
          value={formatBytes(stats?.totalSize || 0)}
          icon="💾"
          color="var(--success)"
        />
        <StatCard
          title="Lines of Code"
          value={stats?.totalLines?.toLocaleString() || '0'}
          icon="📝"
          color="var(--warning)"
        />
        <StatCard
          title="Active Sessions"
          value={sessions?.length || 0}
          icon="🔗"
          color="var(--error)"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>System Overview</h3>
          {systemInfo && (
            <div style={{ display: 'grid', gap: '12px' }}>
              <InfoRow label="Platform" value={`${systemInfo.platform} (${systemInfo.arch})`} />
              <InfoRow label="Hostname" value={systemInfo.hostname} />
              <InfoRow label="CPUs" value={`${systemInfo.cpus.length} cores`} />
              <InfoRow label="Total Memory" value={formatBytes(systemInfo.totalMemory)} />
              <InfoRow label="Free Memory" value={formatBytes(systemInfo.freeMemory)} />
              <InfoRow label="Uptime" value={`${Math.floor(systemInfo.uptime / 3600)}h ${Math.floor((systemInfo.uptime % 3600) / 60)}m`} />
              <InfoRow label="User" value={systemInfo.userInfo.username} />
            </div>
          )}
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Quick Actions</h3>
          <div style={{ display: 'grid', gap: '8px' }}>
            <QuickAction icon="🤖" label="Start AI Chat" onClick={() => {}} />
            <QuickAction icon="📸" label="Take Screenshot" onClick={() => {}} />
            <QuickAction icon="🧪" label="New Sandbox" onClick={() => {}} />
            <QuickAction icon="📁" label="Open Files" onClick={() => {}} />
            <QuickAction icon="⚙️" label="Settings" onClick={() => {}} />
          </div>
        </div>
      </div>

      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Storage by Category</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {stats?.byCategory && Object.entries(stats.byCategory).map(([category, data]) => (
            <div key={category} style={{
              background: 'var(--bg-tertiary)',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>
                {category === 'code' ? '💻' : category === 'screenshot' ? '📸' : category === 'data' ? '📊' : '📄'}
              </div>
              <div style={{ fontSize: '14px', fontWeight: '600', textTransform: 'capitalize' }}>
                {category}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {data.count} files
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {formatBytes(data.size)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '20px'
      }}>
        <h3 style={{ marginBottom: '16px', fontSize: '16px' }}>Languages</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {stats?.byLanguage && Object.entries(stats.byLanguage).map(([language, data]) => (
            <div key={language} style={{
              background: 'var(--bg-tertiary)',
              borderRadius: '8px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontWeight: '500' }}>{language}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {data.count} files
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, color }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        background: `${color}20`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '24px'
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{title}</div>
        <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{value}</div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function QuickAction({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border)',
        borderRadius: '8px',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s'
      }}
    >
      <span style={{ fontSize: '18px' }}>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default Dashboard;
