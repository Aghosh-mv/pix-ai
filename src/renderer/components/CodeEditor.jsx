import React, { useState, useRef, useEffect } from 'react';

const pix = window.pix;

const languages = [
  { id: 'javascript', name: 'JavaScript', ext: '.js' },
  { id: 'typescript', name: 'TypeScript', ext: '.ts' },
  { id: 'python', name: 'Python', ext: '.py' },
  { id: 'ruby', name: 'Ruby', ext: '.rb' },
  { id: 'go', name: 'Go', ext: '.go' },
  { id: 'rust', name: 'Rust', ext: '.rs' },
  { id: 'html', name: 'HTML', ext: '.html' },
  { id: 'css', name: 'CSS', ext: '.css' },
  { id: 'json', name: 'JSON', ext: '.json' },
  { id: 'bash', name: 'Bash', ext: '.sh' },
  { id: 'sql', name: 'SQL', ext: '.sql' },
  { id: 'markdown', name: 'Markdown', ext: '.md' }
];

function CodeEditor({ session }) {
  const [code, setCode] = useState('// Welcome to Pix Code Editor\n\nfunction greet(name) {\n  return `Hello, ${name}! Welcome to Pix AI Harness.`;\n}\n\nconsole.log(greet("World"));');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [fileName, setFileName] = useState('untitled');
  const [saved, setSaved] = useState(true);
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const editorRef = useRef(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const result = await pix.storage.list({ category: 'code', limit: 50 });
      setFiles(result.entries || []);
    } catch (e) {
      console.error('Failed to load files:', e);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setOutput('Running...\n');

    try {
      const result = await pix.execute.code({
        code,
        language,
        sandboxId: null
      });

      setOutput(result.stdout || '');
      if (result.stderr) {
        setOutput(prev => prev + '\n' + result.stderr);
      }
    } catch (error) {
      setOutput(`Error: ${error.error || error.message || 'Execution failed'}`);
    } finally {
      setRunning(false);
    }
  };

  const handleSave = async () => {
    try {
      const entry = await pix.storage.save({
        name: fileName,
        content: code,
        language,
        category: 'code',
        tags: [language]
      });

      setSaved(true);
      setSelectedFile(entry.id);
      await loadFiles();
    } catch (e) {
      console.error('Failed to save:', e);
    }
  };

  const handleLoadFile = async (fileId) => {
    try {
      const entry = await pix.storage.load({ id: fileId });
      setCode(entry.content);
      setLanguage(entry.language);
      setFileName(entry.name);
      setSelectedFile(fileId);
      setSaved(true);
    } catch (e) {
      console.error('Failed to load file:', e);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      setCode(newCode);
      setSaved(false);
      setTimeout(() => {
        e.target.selectionStart = e.target.selectionEnd = start + 2;
      }, 0);
    }
  };

  const formatCode = () => {
    try {
      const formatted = code
        .replace(/\{/g, ' {\n')
        .replace(/\}/g, '\n}\n')
        .replace(/;/g, ';\n')
        .replace(/\n\n\n/g, '\n\n');
      setCode(formatted);
    } catch (e) {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - 32px)' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '16px',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            value={fileName}
            onChange={(e) => { setFileName(e.target.value); setSaved(false); }}
            style={{ width: '200px' }}
            placeholder="File name"
          />
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            {languages.map(lang => (
              <option key={lang.id} value={lang.id}>{lang.name}</option>
            ))}
          </select>
          <span style={{
            fontSize: '12px',
            color: saved ? 'var(--success)' : 'var(--warning)'
          }}>
            {saved ? '✓ Saved' : '● Unsaved'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={formatCode} className="secondary" style={{ padding: '6px 12px' }}>
            ✨ Format
          </button>
          <button onClick={handleSave} className="secondary" style={{ padding: '6px 12px' }}>
            💾 Save
          </button>
          <button onClick={handleRun} disabled={running} className="success" style={{ padding: '6px 12px' }}>
            {running ? '⏳ Running...' : '▶ Run'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', flex: 1 }}>
        <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h4 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Saved Files
          </h4>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            padding: '8px'
          }}>
            {files.map(file => (
              <button
                key={file.id}
                onClick={() => handleLoadFile(file.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px',
                  background: selectedFile === file.id ? 'var(--accent)' : 'transparent',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  marginBottom: '4px'
                }}
              >
                📄 {file.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            flex: 1,
            background: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            overflow: 'hidden'
          }}>
            <textarea
              ref={editorRef}
              value={code}
              onChange={(e) => { setCode(e.target.value); setSaved(false); }}
              onKeyDown={handleKeyDown}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                borderRadius: '12px',
                padding: '16px',
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: '14px',
                lineHeight: '1.6',
                resize: 'none',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                tabSize: 2
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
    </div>
  );
}

export default CodeEditor;
