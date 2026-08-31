const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class PodcastEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.podcasts = new Map();
    this.episodes = new Map();
    this.subscriptions = new Map();
    this.playlists = new Map();
    this.podcastDir = path.join(os.homedir(), '.pix/podcasts');
  }

  async initialize() {
    this.logger.info('Initializing Podcast Engine...');
    await fs.ensureDir(this.podcastDir);
    await this.loadPodcasts();
    this.loadCategories();
    this.logger.info('Podcast Engine initialized');
  }

  async loadPodcasts() {
    try {
      const files = await fs.readdir(this.podcastDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.podcastDir, file));
          if (data.type === 'podcast') this.podcasts.set(data.id, data);
          else if (data.type === 'episode') this.episodes.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadCategories() {
    this.categories = [
      { id: 'technology', name: 'Technology', icon: '💻' },
      { id: 'business', name: 'Business', icon: '💼' },
      { id: 'science', name: 'Science', icon: '🔬' },
      { id: 'health', name: 'Health & Wellness', icon: '🏥' },
      { id: 'comedy', name: 'Comedy', icon: '😂' },
      { id: 'education', name: 'Education', icon: '📚' },
      { id: 'news', name: 'News & Politics', icon: '📰' },
      { id: 'storytelling', name: 'Storytelling', icon: '📖' },
      { id: 'music', name: 'Music', icon: '🎵' },
      { id: 'sports', name: 'Sports', icon: '⚽' }
    ];
  }

  async addPodcast(params) {
    const {
      title,
      author,
      description = '',
      category = 'technology',
      website = '',
      rssUrl = '',
      imageUrl = '',
      episodes = []
    } = params;

    const id = uuidv4();
    const podcast = {
      id,
      title,
      author,
      description,
      category,
      website,
      rssUrl,
      imageUrl,
      episodeCount: episodes.length,
      subscribed: false,
      createdAt: new Date().toISOString()
    };

    this.podcasts.set(id, podcast);

    for (const ep of episodes) {
      await this.addEpisode({ ...ep, podcastId: id });
    }

    return podcast;
  }

  async updatePodcast(id, updates) {
    const podcast = this.podcasts.get(id);
    if (!podcast) throw new Error(`Podcast not found: ${id}`);

    const updated = { ...podcast, ...updates };
    this.podcasts.set(id, updated);
    return updated;
  }

  async deletePodcast(id) {
    this.podcasts.delete(id);

    for (const [epId, ep] of this.episodes) {
      if (ep.podcastId === id) this.episodes.delete(epId);
    }

    return { success: true };
  }

  async getPodcast(id) {
    return this.podcasts.get(id);
  }

  listPodcasts(options = {}) {
    const { category, subscribed, search } = options;

    let podcasts = Array.from(this.podcasts.values());

    if (category) podcasts = podcasts.filter(p => p.category === category);
    if (subscribed !== undefined) podcasts = podcasts.filter(p => p.subscribed === subscribed);
    if (search) {
      const searchLower = search.toLowerCase();
      podcasts = podcasts.filter(p =>
        p.title.toLowerCase().includes(searchLower) ||
        p.author.toLowerCase().includes(searchLower)
      );
    }

    return podcasts;
  }

  async subscribe(podcastId) {
    const podcast = this.podcasts.get(podcastId);
    if (!podcast) throw new Error(`Podcast not found: ${podcastId}`);

    podcast.subscribed = true;
    this.podcasts.set(podcastId, podcast);
    return podcast;
  }

  async unsubscribe(podcastId) {
    const podcast = this.podcasts.get(podcastId);
    if (!podcast) throw new Error(`Podcast not found: ${podcastId}`);

    podcast.subscribed = false;
    this.podcasts.set(podcastId, podcast);
    return podcast;
  }

  async addEpisode(params) {
    const {
      podcastId,
      title,
      description = '',
      duration = 0,
      audioUrl = '',
      publishedDate = new Date().toISOString(),
      notes = ''
    } = params;

    const id = uuidv4();
    const episode = {
      id,
      podcastId,
      title,
      description,
      duration,
      audioUrl,
      publishedDate: new Date(publishedDate).toISOString(),
      notes,
      played: false,
      progress: 0,
      completed: false,
      createdAt: new Date().toISOString()
    };

    this.episodes.set(id, episode);
    return episode;
  }

  async updateEpisode(id, updates) {
    const episode = this.episodes.get(id);
    if (!episode) throw new Error(`Episode not found: ${id}`);

    const updated = { ...episode, ...updates };
    this.episodes.set(id, updated);
    return updated;
  }

  async markPlayed(episodeId) {
    const episode = this.episodes.get(episodeId);
    if (!episode) throw new Error(`Episode not found: ${episodeId}`);

    episode.played = true;
    episode.completed = true;
    episode.progress = 100;
    this.episodes.set(episodeId, episode);
    return episode;
  }

  async updateProgress(episodeId, progress) {
    const episode = this.episodes.get(episodeId);
    if (!episode) throw new Error(`Episode not found: ${episodeId}`);

    episode.progress = Math.min(100, progress);
    episode.played = episode.progress > 0;
    episode.completed = episode.progress >= 100;
    this.episodes.set(episodeId, episode);
    return episode;
  }

  getEpisodes(podcastId = null) {
    const episodes = Array.from(this.episodes.values());
    if (podcastId) {
      return episodes.filter(e => e.podcastId === podcastId)
        .sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate));
    }
    return episodes.sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate));
  }

  async getEpisode(id) {
    return this.episodes.get(id);
  }

  async createPlaylist(params) {
    const { name, description = '', episodeIds = [] } = params;
    const id = uuidv4();

    const playlist = {
      id,
      name,
      description,
      episodeIds,
      createdAt: new Date().toISOString()
    };

    this.playlists.set(id, playlist);
    return playlist;
  }

  async addToPlaylist(playlistId, episodeId) {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) throw new Error(`Playlist not found: ${playlistId}`);

    if (!playlist.episodeIds.includes(episodeId)) {
      playlist.episodeIds.push(episodeId);
    }

    return playlist;
  }

  async removeFromPlaylist(playlistId, episodeId) {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) throw new Error(`Playlist not found: ${playlistId}`);

    playlist.episodeIds = playlist.episodeIds.filter(id => id !== episodeId);
    return playlist;
  }

  getPlaylists() {
    return Array.from(this.playlists.values());
  }

  getCategories() {
    return this.categories;
  }

  async getStats() {
    const podcasts = Array.from(this.podcasts.values());
    const episodes = Array.from(this.episodes.values());
    const played = episodes.filter(e => e.played);
    const totalTime = played.reduce((sum, e) => sum + e.duration, 0);

    return {
      totalPodcasts: podcasts.length,
      subscribed: podcasts.filter(p => p.subscribed).length,
      totalEpisodes: episodes.length,
      playedEpisodes: played.length,
      totalMinutes: totalTime,
      totalHours: Math.round(totalTime / 60 * 10) / 10,
      playlists: this.playlists.size
    };
  }

  async savePodcast(podcast) {
    const filePath = path.join(this.podcastDir, `${podcast.id}.json`);
    await fs.writeJson(filePath, { ...podcast, type: 'podcast' }, { spaces: 2 });
  }

  async exportPodcasts(format = 'json') {
    const podcasts = Array.from(this.podcasts.values());
    const episodes = Array.from(this.episodes.values());

    if (format === 'json') {
      return JSON.stringify({ podcasts, episodes }, null, 2);
    }

    return { podcasts, episodes };
  }
}

module.exports = PodcastEngine;
