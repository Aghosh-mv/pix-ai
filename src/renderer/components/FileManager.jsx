import React, { useState, useEffect } from 'react';

const pix = window.pix;

function FileManager({ session }) {
  const [currentPath, setCurrentPath] = useState('~');
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);

  useEffect(() => {
    loadFiles();
  }, [currentPath]);

  const loadFiles = async () => {
    try {
      const result = await pix.storage.list({ limit: 500 });
      setFiles(result.entries || []);
    } catch (e) {
      console.error('Failed to load files:', e);
    }
  };

  const handleOpenFile = async (fileId) => {
    try {
      const file = await pix.storage.load({ id: fileId });
      console.log('Opened file:', file.name);
    } catch (e) {
      console.error('Failed to open file:', e);
    }
  };

  const handleDeleteFiles = async () => {
    for (const fileId of selectedFiles) {
      try {
        await pix.storage.delete({ id: fileId });
      } catch (e) {
        console.error('Failed to delete:', e);
      }
    }
    setSelectedFiles([]);
    await loadFiles();
  };

  const handleExport = async () => {
    if (selectedFiles.length === 0) return;
    try {
      await pix.storage.export({ ids: selectedFiles, format: 'zip' });
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

  const getFileIcon = (language) => {
    const icons = {
      javascript: '🟨', typescript: '🟦', python: '🐍',
      ruby: '💎', go: '🔷', rust: '🦀', html: '🌐',
      css: '🎨', json: '📋', markdown: '📝',
      bash: '⬛', yaml: '📄', xml: '📄',
      text: '📄', sql: '🗃️', csv: '📊'
    };
    return icons[language] || '📄';
  };

  const sortedFiles = [...files]
    .filter(f => !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (sortOrder === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - 32px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px' }}>File Manager</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {selectedFiles.length > 0 && (
            <>
              <button onClick={handleExport} className="secondary">
                📦 Export ({selectedFiles.length})
              </button>
              <button onClick={handleDeleteFiles} className="danger">
                🗑️ Delete ({selectedFiles.length})
              </button>
            </>
          )}
          <button onClick={loadFiles} className="secondary">🔄 Refresh</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files..."
          style={{ flex: 1 }}
        />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="name">Name</option>
          <option value="size">Size</option>
          <option value="lines">Lines</option>
          <option value="updatedAt">Date</option>
        </select>
        <button
          onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          className="secondary"
          style={{ padding: '8px 12px' }}
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>
        <button
          onClick={() => setViewMode(prev => prev === 'grid' ? 'list' : 'grid')}
          className="secondary"
          style={{ padding: '8px 12px' }}
        >
          {viewMode === 'grid' ? '☰' : '⊞'}
        </button>
      </div>

      <div style={{
        flex: 1,
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        padding: '16px',
        overflowY: 'auto'
      }}>
        {viewMode === 'grid' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '12px'
          }}>
            {sortedFiles.map(file => (
              <div
                key={file.id}
                onClick={() => toggleFileSelection(file.id)}
                onDoubleClick={() => handleOpenFile(file.id)}
                style={{
                  background: 'var(--bg-tertiary)',
                  borderRadius: '8px',
                  padding: '16px',
                  cursor: 'pointer',
                  border: selectedFiles.includes(file.id)
                    ? '2px solid var(--accent)'
                    : '1px solid var(--border)',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px', textAlign: 'center' }}>
                  {getFileIcon(file.language)}
                </div>
                <div style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {file.name}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                  marginTop: '4px'
                }}>
                  {formatBytes(file.size)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px', textAlign: 'left' }}>
                  <input
                    type="checkbox"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedFiles(sortedFiles.map(f => f.id));
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
                <th style={{ padding: '8px', textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>Modified</th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.map(file => (
                <tr
                  key={file.id}
                  onClick={() => toggleFileSelection(file.id)}
                  onDoubleClick={() => handleOpenFile(file.id)}
                  style={{
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    background: selectedFiles.includes(file.id) ? 'var(--bg-hover)' : 'transparent'
                  }}
                >
                  <td style={{ padding: '8px' }}>
                    <input
                      type="checkbox"
                      checked={selectedFiles.includes(file.id)}
                      onChange={() => toggleFileSelection(file.id)}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <span>{getFileIcon(file.language)} {file.name}</span>
                  </td>
                  <td style={{ padding: '8px' }}>
                    <span className="badge info">{file.language}</span>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {sortedFiles.length === 0 && (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: 'var(--text-muted)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
            <p>No files found. Start saving code to see them here!</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default FileManager;
