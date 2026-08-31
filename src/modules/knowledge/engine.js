const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');

class KnowledgeEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.cache = new NodeCache({ stdTTL: 3600 });
    this.searchHistory = [];
    this.bookmarks = new Map();
  }

  async initialize() {
    this.logger.info('Initializing Knowledge Engine...');
    this.logger.info('Knowledge Engine initialized');
  }

  async search(params) {
    const {
      query,
      numResults = 10,
      country = 'us',
      language = 'en',
      dateRestrict = null,
      fileType = null,
      safeSearch = 'moderate'
    } = params;

    const cacheKey = `search:${query}:${numResults}:${country}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    this.logger.info(`Searching: ${query}`);

    const serpApiKey = this.config.getApiKey('serp');
    if (!serpApiKey) {
      return this.fallbackSearch(query, numResults);
    }

    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          q: query,
          api_key: serpApiKey,
          engine: 'google',
          num: numResults,
          gl: country,
          hl: language,
          safe: safeSearch,
          date_restrict: dateRestrict,
          file_type: fileType
        },
        timeout: 30000
      });

      const results = {
        query,
        totalResults: response.data.search_information?.total_results || 0,
        organic: (response.data.organic_results || []).map(r => ({
          title: r.title,
          link: r.link,
          snippet: r.snippet,
          position: r.position,
          displayLink: r.displayed_link,
          thumbnail: r.thumbnail,
          cachedPageLink: r.cached_page_link
        })),
        knowledge: response.data.knowledge_graph ? {
          title: response.data.knowledge_graph.title,
          type: response.data.knowledge_graph.type,
          description: response.data.knowledge_graph.description,
          imageUrl: response.data.knowledge_graph.image,
          attributes: response.data.knowledge_graph.attributes,
          sources: response.data.knowledge_graph.sources
        } : null,
        answerBox: response.data.answer_box ? {
          type: response.data.answer_box.type,
          answer: response.data.answer_box.answer,
          title: response.data.answer_box.title,
          snippet: response.data.answer_box.snippet
        } : null,
        related: (response.data.related_questions || []).map(q => ({
          question: q.question,
          snippet: q.snippet,
          link: q.link
        })),
        suggestions: response.data.search_suggestions || [],
        timestamp: new Date().toISOString()
      };

      this.cache.set(cacheKey, results);
      this.searchHistory.push({ query, timestamp: new Date().toISOString() });

      return results;
    } catch (error) {
      this.logger.error('Search error:', error.message);
      return this.fallbackSearch(query, numResults);
    }
  }

  async fallbackSearch(query, numResults) {
    return {
      query,
      totalResults: 0,
      organic: [],
      knowledge: null,
      answerBox: null,
      related: [],
      suggestions: [],
      timestamp: new Date().toISOString(),
      note: 'Search unavailable - SERP API key not configured'
    };
  }

  async getNews(params) {
    const {
      query,
      numResults = 10,
      country = 'us',
      language = 'en',
      when = 'week'
    } = params;

    const cacheKey = `news:${query}:${when}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    this.logger.info(`Fetching news: ${query}`);

    const serpApiKey = this.config.getApiKey('serp');
    if (!serpApiKey) {
      return this.fallbackNews(query);
    }

    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          q: query,
          api_key: serpApiKey,
          engine: 'google_news',
          num: numResults,
          gl: country,
          hl: language
        },
        timeout: 30000
      });

      const results = {
        query,
        articles: (response.data.news_results || []).map(a => ({
          title: a.title,
          link: a.link,
          snippet: a.snippet,
          source: a.source,
          imageUrl: a.thumbnail,
          publishedAt: a.date,
          position: a.position
        })),
        timestamp: new Date().toISOString()
      };

      this.cache.set(cacheKey, results);
      return results;
    } catch (error) {
      this.logger.error('News error:', error.message);
      return this.fallbackNews(query);
    }
  }

  async fallbackNews(query) {
    return {
      query,
      articles: [],
      timestamp: new Date().toISOString(),
      note: 'News unavailable - SERP API key not configured'
    };
  }

  async getWikipedia(params) {
    const { query, language = 'en' } = params;

    const cacheKey = `wiki:${query}:${language}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    this.logger.info(`Fetching Wikipedia: ${query}`);

    try {
      const searchResponse = await axios.get(
        `https://${language}.wikipedia.org/w/api.php`, {
          params: {
            action: 'query',
            list: 'search',
            srsearch: query,
            format: 'json',
            srlimit: 5
          },
          timeout: 15000
        }
      );

      const results = searchResponse.data.query.search;

      if (results.length === 0) {
        return { query, results: [], timestamp: new Date().toISOString() };
      }

      const pageId = results[0].pageid;
      const pageResponse = await axios.get(
        `https://${language}.wikipedia.org/w/api.php`, {
          params: {
            action: 'query',
            pageids: pageId,
            prop: 'extracts|info|images',
            exintro: true,
            explaintext: true,
            inprop: 'url',
            format: 'json'
          },
          timeout: 15000
        }
      );

      const page = pageResponse.data.query.pages[pageId];

      const wikiResults = {
        query,
        results: results.map(r => ({
          title: r.title,
          snippet: r.snippet,
          pageId: r.pageid,
          wordCount: r.wordcount,
          timestamp: r.timestamp
        })),
        selected: {
          title: page.title,
          extract: page.extract,
          url: page.fullurl,
          editUrl: page.editurl,
          lastEdited: page.touched
        },
        timestamp: new Date().toISOString()
      };

      this.cache.set(cacheKey, wikiResults);
      return wikiResults;
    } catch (error) {
      this.logger.error('Wikipedia error:', error.message);
      return { query, results: [], error: error.message, timestamp: new Date().toISOString() };
    }
  }

  async getTrends(params) {
    const {
      query,
      geo = 'US',
      time = 'today 12-m'
    } = params;

    const serpApiKey = this.config.getApiKey('serp');
    if (!serpApiKey) {
      return { query, trends: [], note: 'Trends unavailable - SERP API key not configured' };
    }

    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          q: query,
          api_key: serpApiKey,
          engine: 'google_trends',
          geo,
          data_compilation: time
        },
        timeout: 30000
      });

      return {
        query,
        timeline: response.data.timeline || [],
        related: response.data.related_queries || [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Trends error:', error.message);
      return { query, trends: [], error: error.message };
    }
  }

  async getWeather(params) {
    const { location, unit = 'celsius' } = params;

    const serpApiKey = this.config.getApiKey('serp');
    if (!serpApiKey) {
      return { location, note: 'Weather unavailable - SERP API key not configured' };
    }

    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          q: `weather ${location}`,
          api_key: serpApiKey,
          engine: 'google',
          hl: 'en'
        },
        timeout: 15000
      });

      const weather = response.data.knowledge_graph;
      return {
        location,
        weather: weather ? {
          temperature: weather.attributes?.['Temperature'],
          condition: weather.attributes?.['Condition'],
          humidity: weather.attributes?.['Humidity'],
          wind: weather.attributes?.['Wind speed'],
          forecast: weather.attributes?.['Forecast']
        } : null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Weather error:', error.message);
      return { location, error: error.message };
    }
  }

  async getStocks(params) {
    const { symbol } = params;

    const serpApiKey = this.config.getApiKey('serp');
    if (!serpApiKey) {
      return { symbol, note: 'Stocks unavailable - SERP API key not configured' };
    }

    try {
      const response = await axios.get('https://serpapi.com/search', {
        params: {
          q: `${symbol} stock price`,
          api_key: serpApiKey,
          engine: 'google',
          hl: 'en'
        },
        timeout: 15000
      });

      const knowledge = response.data.knowledge_graph;
      return {
        symbol,
        stock: knowledge ? {
          price: knowledge.attributes?.['Stock price'],
          change: knowledge.attributes?.['Stock price change'],
          marketCap: knowledge.attributes?.['Market cap'],
          peRatio: knowledge.attributes?.['P/E ratio']
        } : null,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Stocks error:', error.message);
      return { symbol, error: error.message };
    }
  }

  async bookmark(params) {
    const { url, title, tags = [], notes = '' } = params;
    const id = uuidv4();

    this.bookmarks.set(id, {
      id, url, title, tags, notes,
      createdAt: new Date().toISOString()
    });

    return { id, url, title };
  }

  getBookmarks() {
    return Array.from(this.bookmarks.values());
  }

  getSearchHistory() {
    return this.searchHistory;
  }
}

module.exports = KnowledgeEngine;
