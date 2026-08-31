import React, { useState, useEffect } from 'react';

const pix = window.pix;

function LearningPanel({ session }) {
  const [observations, setObservations] = useState([]);
  const [skills, setSkills] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [stats, setStats] = useState(null);
  const [teachInput, setTeachInput] = useState('');
  const [teachName, setTeachName] = useState('');
  const [recallQuery, setRecallQuery] = useState('');
  const [recallResults, setRecallResults] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const p = await pix.learning.patterns();
      setPatterns(p || []);

      const s = await pix.learning.getStats?.() || { observations: 0, patterns: 0, knowledge: 0, skills: 0 };
      setStats(s);
    } catch (e) {
      console.error('Failed to load learning data:', e);
    }
  };

  const handleTeach = async () => {
    if (!teachName.trim() || !teachInput.trim()) return;

    try {
      await pix.learning.teach({
        name: teachName,
        description: teachInput,
        type: 'skill',
        steps: teachInput.split('\n').filter(s => s.trim()),
        tags: ['user-taught']
      });

      setTeachName('');
      setTeachInput('');
      await loadData();
    } catch (e) {
      console.error('Failed to teach:', e);
    }
  };

  const handleRecall = async () => {
    if (!recallQuery.trim()) return;

    try {
      const results = await pix.learning.recall({ query: recallQuery });
      setRecallResults(results || []);
    } catch (e) {
      console.error('Failed to recall:', e);
    }
  };

  const handleObserve = async () => {
    try {
      await pix.learning.observe({
        type: 'manual',
        description: 'Manual observation from Learning Panel',
        tags: ['manual']
      });
      await loadData();
    } catch (e) {
      console.error('Failed to observe:', e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - 32px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px' }}>Learning Center</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handleObserve} className="secondary">📸 Observe</button>
          <button onClick={loadData} className="secondary">🔄 Refresh</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['overview', 'teach', 'recall', 'patterns'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? '' : 'secondary'}
            style={{
              textTransform: 'capitalize'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>👁️</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats?.observations || 0}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Observations</div>
          </div>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧩</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats?.patterns || 0}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Patterns</div>
          </div>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🧠</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats?.knowledge || 0}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Knowledge</div>
          </div>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🎯</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats?.skills || 0}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Skills</div>
          </div>
        </div>
      )}

      {activeTab === 'teach' && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h4 style={{ marginBottom: '16px' }}>Teach Pix a New Skill</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input
              value={teachName}
              onChange={(e) => setTeachName(e.target.value)}
              placeholder="Skill name"
            />
            <textarea
              value={teachInput}
              onChange={(e) => setTeachInput(e.target.value)}
              placeholder="Describe the skill steps (one step per line)..."
              style={{ height: '200px', resize: 'vertical' }}
            />
            <button onClick={handleTeach} style={{ alignSelf: 'flex-start' }}>
              🎓 Teach Skill
            </button>
          </div>
        </div>
      )}

      {activeTab === 'recall' && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h4 style={{ marginBottom: '16px' }}>Recall Knowledge</h4>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <input
              value={recallQuery}
              onChange={(e) => setRecallQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRecall()}
              placeholder="Search for skills or knowledge..."
              style={{ flex: 1 }}
            />
            <button onClick={handleRecall}>🔍 Recall</button>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {recallResults.map((result, i) => (
              <div key={i} style={{
                padding: '16px',
                background: 'var(--bg-tertiary)',
                borderRadius: '8px',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600' }}>{result.name || result.title}</span>
                  <span className="badge info">{result.type || result.source}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {result.description || result.content}
                </div>
                {result.tags && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                    {result.tags.map((tag, j) => (
                      <span key={j} className="badge" style={{ fontSize: '10px' }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {recallResults.length === 0 && recallQuery && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                No results found for "{recallQuery}"
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'patterns' && (
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '20px'
        }}>
          <h4 style={{ marginBottom: '16px' }}>Discovered Patterns</h4>
          <div style={{ display: 'grid', gap: '8px' }}>
            {patterns.map((pattern, i) => (
              <div key={i} style={{
                padding: '16px',
                background: 'var(--bg-tertiary)',
                borderRadius: '8px',
                border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600' }}>{pattern.name || pattern.type}</span>
                  <span className="badge success">Confidence: {(pattern.confidence * 100).toFixed(0)}%</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {pattern.description}
                </div>
              </div>
            ))}

            {patterns.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧩</div>
                <p>No patterns discovered yet. Pix will learn as you use it!</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default LearningPanel;
