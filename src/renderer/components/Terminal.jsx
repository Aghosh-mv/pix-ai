import React, { useState, useRef, useEffect } from 'react';

const pix = window.pix;

function Terminal({ session }) {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState('~');
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    scrollToBottom();
    inputRef.current?.focus();
  }, [history]);

  const scrollToBottom = () => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  };

  const handleCommand = async (command) => {
    const trimmed = command.trim();
    if (!trimmed) return;

    setHistory(prev => [...prev, { type: 'input', content: trimmed }]);
    setCommandHistory(prev => [...prev, trimmed]);
    setHistoryIndex(-1);
    setInput('');

    const parts = trimmed.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (cmd === 'clear') {
      setHistory([]);
      return;
    }

    if (cmd === 'cd') {
      const newCwd = args[0] || '~';
      setCwd(newCwd);
      setHistory(prev => [...prev, { type: 'output', content: '' }]);
      return;
    }

    if (cmd === 'help') {
      setHistory(prev => [...prev, {
        type: 'output',
        content: `Pix Terminal Commands:
  clear     - Clear terminal
  cd [dir]  - Change directory
  help      - Show this help
  date      - Show current date
  whoami    - Show current user
  ls        - List files
  cat       - Show file contents
  echo      - Print text
  history   - Show command history
  
  Or run any system command directly.`
      }]);
      return;
    }

    if (cmd === 'date') {
      setHistory(prev => [...prev, { type: 'output', content: new Date().toString() }]);
      return;
    }

    if (cmd === 'whoami') {
      try {
        const info = await pix.system.info();
        setHistory(prev => [...prev, { type: 'output', content: info.userInfo.username }]);
      } catch (e) {
        setHistory(prev => [...prev, { type: 'output', content: 'unknown' }]);
      }
      return;
    }

    if (cmd === 'history') {
      const hist = commandHistory.map((c, i) => `  ${i + 1}  ${c}`).join('\n');
      setHistory(prev => [...prev, { type: 'output', content: hist }]);
      return;
    }

    try {
      const result = await pix.execute.command({
        command: trimmed,
        cwd: cwd === '~' ? undefined : cwd
      });

      if (result.stdout) {
        setHistory(prev => [...prev, { type: 'output', content: result.stdout }]);
      }
      if (result.stderr) {
        setHistory(prev => [...prev, { type: 'error', content: result.stderr }]);
      }
    } catch (error) {
      setHistory(prev => [...prev, {
        type: 'error',
        content: error.stderr || error.error || 'Command failed'
      }]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommand(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setInput('');
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setHistory([]);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - var(--header-height) - 32px)',
      background: '#0d1117',
      borderRadius: '12px',
      border: '1px solid var(--border)',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-secondary)'
      }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>⬛ Terminal</span>
          <span style={{ fontSize: '12px', color: 'var(--accent)' }}>{cwd}</span>
        </div>
        <button
          onClick={() => setHistory([])}
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

      <div
        ref={terminalRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: '13px',
          lineHeight: '1.5'
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {history.map((entry, i) => (
          <div key={i} style={{ marginBottom: '4px' }}>
            {entry.type === 'input' && (
              <div>
                <span style={{ color: 'var(--success)' }}>❯ </span>
                <span style={{ color: 'var(--accent)' }}>{cwd} </span>
                <span>{entry.content}</span>
              </div>
            )}
            {entry.type === 'output' && (
              <pre style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: 'var(--text-secondary)'
              }}>
                {entry.content}
              </pre>
            )}
            {entry.type === 'error' && (
              <pre style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: 'var(--error)'
              }}>
                {entry.content}
              </pre>
            )}
          </div>
        ))}

        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ color: 'var(--success)' }}>❯ </span>
          <span style={{ color: 'var(--accent)' }}>{cwd} </span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary)',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              fontSize: '13px',
              caretColor: 'var(--accent)'
            }}
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}

export default Terminal;
