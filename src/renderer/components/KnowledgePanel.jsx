import React, { useState } from 'react';

const pix = window.pix;

function KnowledgePanel({ apiKeys }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [newsQuery, setNewsQuery] = useState('');
  const [newsResults, setNewsResults] = useState(null);
  const [wikiQuery, setWikiQuery] = useState('');
  const [wikiResults, setWikiResults] = useState(null);
  const [weatherLocation, setWeatherLocation] = useState('');
  const [weatherResult, setWeatherResult] = useState(null);
  const [stockSymbol, setStockSymbol] = useState('');
  const [stockResult, setStockResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('search');

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const results = await pix.knowledge.search({ query: searchQuery });
      setSearchResults(results);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleNews = async () => {
    if (!newsQuery.trim()) return;
    setLoading(true);
    try {
      const results = await pix.knowledge.news({ query: newsQuery });
      setNewsResults(results);
    } catch (e) {
      console.error('News failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleWiki = async () => {
    if (!wikiQuery.trim()) return;
    setLoading(true);
    try {
      const results = await pix.knowledge.wiki({ query: wikiQuery });
      setWikiResults(results);
    } catch (e) {
      console.error('Wikipedia failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleWeather = async () => {
    if (!weatherLocation.trim()) return;
    setLoading(true);
    try {
      const results = await pix.knowledge.weather({ location: weatherLocation });
      setWeatherResult(results);
    } catch (e) {
      console.error('Weather failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleStocks = async () => {
    if (!stockSymbol.trim()) return;
    setLoading(true);
    try {
      const results = await pix.knowledge.stocks({ symbol: stockSymbol });
      setStockResult(results);
    } catch (e) {
      console.error('Stocks failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-height) - 32px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '16px' }}>Knowledge Base</h3>
        {!apiKeys?.serp && (
          <span className="badge warning">SERP API key not configured</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['search', 'news', 'wiki', 'weather', 'stocks'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? '' : 'secondary'}
            style={{ textTransform: 'capitalize' }}
          >
            {tab === 'search' ? '🔍 Search' :
             tab === 'news' ? '📰 News' :
             tab === 'wiki' ? '📚 Wikipedia' :
             tab === 'weather' ? '🌤️ Weather' :
             '📈 Stocks'}
          </button>
        ))}
      </div>

      <div style={{
        flex: 1,
        background: 'var(--bg-secondary)',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        padding: '20px',
        overflowY: 'auto'
      }}>
        {activeTab === 'search' && (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search the web..."
                style={{ flex: 1 }}
              />
              <button onClick={handleSearch} disabled={loading}>
                {loading ? '⏳' : '🔍'} Search
              </button>
            </div>

            {searchResults && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Found {searchResults.totalResults?.toLocaleString() || 0} results
                </div>

                {searchResults.answerBox && (
                  <div style={{
                    background: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '16px',
                    border: '1px solid var(--accent)'
                  }}>
                    <div style={{ fontWeight: '600', marginBottom: '8px' }}>Answer</div>
                    <div>{searchResults.answerBox.answer || searchResults.answerBox.snippet}</div>
                  </div>
                )}

                {searchResults.organic?.map((result, i) => (
                  <div key={i} style={{
                    padding: '16px',
                    borderBottom: '1px solid var(--border)',
                    marginBottom: '8px'
                  }}>
                    <a
                      href={result.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: 'var(--accent)', fontSize: '14px', textDecoration: 'none' }}
                    >
                      {result.title}
                    </a>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0' }}>
                      {result.displayLink}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {result.snippet}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'news' && (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input
                value={newsQuery}
                onChange={(e) => setNewsQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNews()}
                placeholder="Search news..."
                style={{ flex: 1 }}
              />
              <button onClick={handleNews} disabled={loading}>
                {loading ? '⏳' : '📰'} Search
              </button>
            </div>

            {newsResults?.articles?.map((article, i) => (
              <div key={i} style={{
                padding: '16px',
                borderBottom: '1px solid var(--border)',
                marginBottom: '8px'
              }}>
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', fontSize: '14px', textDecoration: 'none' }}
                >
                  {article.title}
                </a>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0' }}>
                  {article.source} • {article.publishedAt}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {article.snippet}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'wiki' && (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input
                value={wikiQuery}
                onChange={(e) => setWikiQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleWiki()}
                placeholder="Search Wikipedia..."
                style={{ flex: 1 }}
              />
              <button onClick={handleWiki} disabled={loading}>
                {loading ? '⏳' : '📚'} Search
              </button>
            </div>

            {wikiResults?.selected && (
              <div style={{
                background: 'var(--bg-tertiary)',
                borderRadius: '8px',
                padding: '20px',
                marginBottom: '16px'
              }}>
                <h4 style={{ marginBottom: '12px' }}>{wikiResults.selected.title}</h4>
                <p style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                  {wikiResults.selected.extract}
                </p>
                <a
                  href={wikiResults.selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accent)', fontSize: '12px', marginTop: '12px', display: 'inline-block' }}
                >
                  Read more on Wikipedia →
                </a>
              </div>
            )}

            {wikiResults?.results?.map((result, i) => (
              <div key={i} style={{
                padding: '12px',
                borderBottom: '1px solid var(--border)'
              }}>
                <div style={{ fontWeight: '500' }}>{result.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {result.wordCount} words
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'weather' && (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input
                value={weatherLocation}
                onChange={(e) => setWeatherLocation(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleWeather()}
                placeholder="Enter location..."
                style={{ flex: 1 }}
              />
              <button onClick={handleWeather} disabled={loading}>
                {loading ? '⏳' : '🌤️'} Get Weather
              </button>
            </div>

            {weatherResult?.weather && (
              <div style={{
                background: 'var(--bg-tertiary)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌤️</div>
                <h3 style={{ marginBottom: '16px' }}>{weatherResult.location}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Temperature</div>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>{weatherResult.weather.temperature}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Condition</div>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>{weatherResult.weather.condition}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Humidity</div>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>{weatherResult.weather.humidity}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Wind</div>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>{weatherResult.weather.wind}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'stocks' && (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <input
                value={stockSymbol}
                onChange={(e) => setStockSymbol(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStocks()}
                placeholder="Enter stock symbol (e.g., AAPL)..."
                style={{ flex: 1 }}
              />
              <button onClick={handleStocks} disabled={loading}>
                {loading ? '⏳' : '📈'} Get Quote
              </button>
            </div>

            {stockResult?.stock && (
              <div style={{
                background: 'var(--bg-tertiary)',
                borderRadius: '12px',
                padding: '24px'
              }}>
                <h3 style={{ marginBottom: '16px' }}>{stockResult.symbol}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Price</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stockResult.stock.price}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Change</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stockResult.stock.change}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Market Cap</div>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>{stockResult.stock.marketCap}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>P/E Ratio</div>
                    <div style={{ fontSize: '18px', fontWeight: '600' }}>{stockResult.stock.peRatio}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default KnowledgePanel;
