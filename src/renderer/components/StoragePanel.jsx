import React, { useState, useEffect } from 'react';

const pix = window.pix;

function StoragePanel({ session }) {
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [viewMode, setViewMode] = useState('list');

  useEffect(() => {
    loadFiles();
    loadStats();
  }, [category, language]);

  const loadFiles = async () => {
    try {
      const result = await pix.storage.list({ category, language, limit: 100 });
      setFiles(result.entries || []);
    } catch (e) {
      console.error('Failed to load files:', e);
    }
  };

  const loadStats = async () => {
    try {
      const s = await pix.storage.stats();
      setStats(s);
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadFiles();
      return;
    }
    try {
      const results = await pix.storage.search({ query: searchQuery, category, language });
      setFiles(results);
    } catch (e) {
      console.error('Search failed:', e);
    }
  };

  const handleDelete = async (fileId) => {
    try {
      await pix.storage.delete({ id: fileId });
      await loadFiles();
      await loadStats();
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  const handleExport = async () => {
    if (selectedFiles.length === 0) return;
    try {
      const result = await pix.storage.export({ ids: selectedFiles, format: 'zip' });
      console.log('Exported:', result);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const toggleFileSelection = (fileId) => {
    setSelectedFiles(prev =>
      prev.includes(fileId)
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - 32px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px' }}>Storage Manager</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {selectedFiles.length > 0 && (
            <button onClick={handleExport} className="secondary">
              📦 Export ({selectedFiles.length})
            </button>
          )}
          <button onClick={loadFiles} className="secondary">🔄 Refresh</button>
        </div>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
          <StatCard title="Total Files" value={stats.totalFiles} icon="📄" />
          <StatCard title="Total Size" value={formatBytes(stats.totalSize)} icon="💾" />
          <StatCard title="Lines of Code" value={stats.totalLines?.toLocaleString() || '0'} icon="📝" />
          <StatCard title="Languages" value={Object.keys(stats.byLanguage || {}).length} icon="🌐" />
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search files..."
          style={{ flex: 1 }}
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All Categories</option>
          <option value="code">Code</option>
          <option value="screenshot">Screenshots</option>
          <option value="data">Data</option>
          <option value="log">Logs</option>
        </select>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="">All Languages</option>
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="typescript">TypeScript</option>
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="json">JSON</option>
        </select>
        <button onClick={handleSearch} className="secondary">🔍 Search</button>
      </div>

      <div style={{
        flex: 1,
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '12px', fontWeight: '600' }}>
            Files ({files.length})
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                background: viewMode === 'list' ? 'var(--accent)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
                color: viewMode === 'list' ? 'white' : 'var(--text-muted)'
              }}
            >
              ☰
            </button>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'var(--accent)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
                color: viewMode === 'grid' ? 'white' : 'var(--text-muted)'
              }}
            >
              ⊞
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {viewMode === 'list' ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <input
                      type="checkbox"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFiles(files.map(f => f.id));
                        } else {
                          setSelectedFiles([]);
                        }
                      }}
                    />
                  </th>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>Name</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>Language</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>Size</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>Lines</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>Date</th>
                  <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {files.map(file => (
                  <tr key={file.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px' }}>
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.id)}
                        onChange={() => toggleFileSelection(file.id)}
                      />
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span style={{ fontSize: '12px' }}>📄 {file.name}</span>
                    </td>
                    <td style={{ padding: '8px' }}>
                      <span className="badge info" style={{ fontSize: '10px' }}>{file.language}</span>
                    </td>
                    <td style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {formatBytes(file.size)}
                    </td>
                    <td style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {file.lines}
                    </td>
                    <td style={{ padding: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(file.updatedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <button
                        onClick={() => handleDelete(file.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--error)',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
              {files.map(file => (
                <div
                  key={file.id}
                  style={{
                    background: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                    padding: '16px',
                    cursor: 'pointer',
                    border: selectedFiles.includes(file.id) ? '2px solid var(--accent)' : '1px solid var(--border)'
                  }}
                  onClick={() => toggleFileSelection(file.id)}
                >
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📄</div>
                  <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>{file.name}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {file.language} • {formatBytes(file.size)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {files.length === 0 && (
            <div style={{
              padding: '40px',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              No files found. Start saving code to see them here!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px'
    }}>
      <span style={{ fontSize: '24px' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{title}</div>
        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{value}</div>
      </div>
    </div>
  );
}

export default StoragePanel;
