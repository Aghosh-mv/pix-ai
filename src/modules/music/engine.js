const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MusicEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.artists = new Map();
    this.albums = new Map();
    this.songs = new Map();
    this.playlists = new Map();
    this.favorites = new Set();
    this.musicDir = path.join(os.homedir(), '.pix/music');
  }

  async initialize() {
    this.logger.info('Initializing Music Engine...');
    await fs.ensureDir(this.musicDir);
    await this.loadMusic();
    this.loadGenres();
    this.logger.info('Music Engine initialized');
  }

  async loadMusic() {
    try {
      const files = await fs.readdir(this.musicDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.musicDir, file));
          if (data.type === 'artist') this.artists.set(data.id, data);
          else if (data.type === 'album') this.albums.set(data.id, data);
          else if (data.type === 'song') this.songs.set(data.id, data);
          else if (data.type === 'playlist') this.playlists.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadGenres() {
    this.genres = [
      { id: 'rock', name: 'Rock', icon: '🎸' },
      { id: 'pop', name: 'Pop', icon: '🎤' },
      { id: 'hip-hop', name: 'Hip-Hop', icon: '🎧' },
      { id: 'electronic', name: 'Electronic', icon: '🎛️' },
      { id: 'jazz', name: 'Jazz', icon: '🎷' },
      { id: 'classical', name: 'Classical', icon: '🎻' },
      { id: 'r&b', name: 'R&B', icon: '🎵' },
      { id: 'country', name: 'Country', icon: '🤠' },
      { id: 'metal', name: 'Metal', icon: '🤘' },
      { id: 'folk', name: 'Folk', icon: '🪕' }
    ];
  }

  async addArtist(params) {
    const { name, genre = '', bio = '', imageUrl = '', website = '' } = params;
    const id = uuidv4();

    const artist = {
      id,
      name,
      genre,
      bio,
      imageUrl,
      website,
      type: 'artist',
      createdAt: new Date().toISOString()
    };

    this.artists.set(id, artist);
    await this.saveItem(artist);
    return artist;
  }

  async updateArtist(id, updates) {
    const artist = this.artists.get(id);
    if (!artist) throw new Error(`Artist not found: ${id}`);

    const updated = { ...artist, ...updates };
    this.artists.set(id, updated);
    await this.saveItem(updated);
    return updated;
  }

  async deleteArtist(id) {
    this.artists.delete(id);
    await fs.remove(path.join(this.musicDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  listArtists(options = {}) {
    const { genre, search } = options;
    let artists = Array.from(this.artists.values());

    if (genre) artists = artists.filter(a => a.genre === genre);
    if (search) {
      const searchLower = search.toLowerCase();
      artists = artists.filter(a => a.name.toLowerCase().includes(searchLower));
    }

    return artists;
  }

  async addAlbum(params) {
    const { artistId, title, releaseYear = 2024, genre = '', imageUrl = '' } = params;
    const id = uuidv4();

    const album = {
      id,
      artistId,
      title,
      releaseYear,
      genre,
      imageUrl,
      songIds: [],
      type: 'album',
      createdAt: new Date().toISOString()
    };

    this.albums.set(id, album);
    await this.saveItem(album);
    return album;
  }

  async updateAlbum(id, updates) {
    const album = this.albums.get(id);
    if (!album) throw new Error(`Album not found: ${id}`);

    const updated = { ...album, ...updates };
    this.albums.set(id, updated);
    await this.saveItem(updated);
    return updated;
  }

  async deleteAlbum(id) {
    this.albums.delete(id);
    await fs.remove(path.join(this.musicDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  listAlbums(options = {}) {
    const { artistId, genre, search } = options;
    let albums = Array.from(this.albums.values());

    if (artistId) albums = albums.filter(a => a.artistId === artistId);
    if (genre) albums = albums.filter(a => a.genre === genre);
    if (search) {
      const searchLower = search.toLowerCase();
      albums = albums.filter(a => a.title.toLowerCase().includes(searchLower));
    }

    return albums;
  }

  async addSong(params) {
    const {
      albumId,
      artistId,
      title,
      duration = 0,
      trackNumber = 0,
      genre = '',
      lyrics = '',
      audioUrl = ''
    } = params;

    const id = uuidv4();
    const song = {
      id,
      albumId,
      artistId,
      title,
      duration,
      trackNumber,
      genre,
      lyrics,
      audioUrl,
      playCount: 0,
      favorite: false,
      type: 'song',
      createdAt: new Date().toISOString()
    };

    this.songs.set(id, song);

    if (albumId) {
      const album = this.albums.get(albumId);
      if (album) {
        album.songIds.push(id);
        this.albums.set(albumId, album);
      }
    }

    await this.saveItem(song);
    return song;
  }

  async updateSong(id, updates) {
    const song = this.songs.get(id);
    if (!song) throw new Error(`Song not found: ${id}`);

    const updated = { ...song, ...updates };
    this.songs.set(id, updated);
    await this.saveItem(updated);
    return updated;
  }

  async deleteSong(id) {
    const song = this.songs.get(id);
    if (song && song.albumId) {
      const album = this.albums.get(song.albumId);
      if (album) {
        album.songIds = album.songIds.filter(sid => sid !== id);
      }
    }

    this.songs.delete(id);
    this.favorites.delete(id);
    await fs.remove(path.join(this.musicDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async playSong(id) {
    const song = this.songs.get(id);
    if (!song) throw new Error(`Song not found: ${id}`);

    song.playCount = (song.playCount || 0) + 1;
    this.songs.set(id, song);
    await this.saveItem(song);

    return song;
  }

  async toggleFavorite(id) {
    const song = this.songs.get(id);
    if (!song) throw new Error(`Song not found: ${id}`);

    song.favorite = !song.favorite;
    this.songs.set(id, song);
    await this.saveItem(song);

    if (song.favorite) this.favorites.add(id);
    else this.favorites.delete(id);

    return song;
  }

  listSongs(options = {}) {
    const { albumId, artistId, genre, search, favorites } = options;
    let songs = Array.from(this.songs.values());

    if (albumId) songs = songs.filter(s => s.albumId === albumId);
    if (artistId) songs = songs.filter(s => s.artistId === artistId);
    if (genre) songs = songs.filter(s => s.genre === genre);
    if (favorites) songs = songs.filter(s => s.favorite);
    if (search) {
      const searchLower = search.toLowerCase();
      songs = songs.filter(s => s.title.toLowerCase().includes(searchLower));
    }

    return songs.sort((a, b) => a.trackNumber - b.trackNumber);
  }

  async createPlaylist(params) {
    const { name, description = '', songIds = [], isPublic = false } = params;
    const id = uuidv4();

    const playlist = {
      id,
      name,
      description,
      songIds,
      isPublic,
      type: 'playlist',
      createdAt: new Date().toISOString()
    };

    this.playlists.set(id, playlist);
    await this.saveItem(playlist);
    return playlist;
  }

  async updatePlaylist(id, updates) {
    const playlist = this.playlists.get(id);
    if (!playlist) throw new Error(`Playlist not found: ${id}`);

    const updated = { ...playlist, ...updates };
    this.playlists.set(id, updated);
    await this.saveItem(updated);
    return updated;
  }

  async deletePlaylist(id) {
    this.playlists.delete(id);
    await fs.remove(path.join(this.musicDir, `${id}.json`)).catch(() => {});
    return { success: true };
  }

  async addToPlaylist(playlistId, songId) {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) throw new Error(`Playlist not found: ${playlistId}`);

    if (!playlist.songIds.includes(songId)) {
      playlist.songIds.push(songId);
    }

    await this.saveItem(playlist);
    return playlist;
  }

  async removeFromPlaylist(playlistId, songId) {
    const playlist = this.playlists.get(playlistId);
    if (!playlist) throw new Error(`Playlist not found: ${playlistId}`);

    playlist.songIds = playlist.songIds.filter(id => id !== songId);
    await this.saveItem(playlist);
    return playlist;
  }

  listPlaylists() {
    return Array.from(this.playlists.values());
  }

  getGenres() {
    return this.genres;
  }

  async getStats() {
    const songs = Array.from(this.songs.values());
    const totalPlays = songs.reduce((sum, s) => sum + (s.playCount || 0), 0);
    const totalDuration = songs.reduce((sum, s) => sum + (s.duration || 0), 0);

    return {
      artists: this.artists.size,
      albums: this.albums.size,
      songs: songs.length,
      playlists: this.playlists.size,
      favorites: songs.filter(s => s.favorite).length,
      totalPlays,
      totalMinutes: Math.round(totalDuration / 60),
      totalHours: Math.round(totalDuration / 3600 * 10) / 10
    };
  }

  async getTopPlayed(limit = 10) {
    return Array.from(this.songs.values())
      .sort((a, b) => (b.playCount || 0) - (a.playCount || 0))
      .slice(0, limit);
  }

  async getRecentlyPlayed(limit = 10) {
    return Array.from(this.songs.values())
      .filter(s => s.lastPlayed)
      .sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed))
      .slice(0, limit);
  }

  async saveItem(item) {
    const filePath = path.join(this.musicDir, `${item.id}.json`);
    await fs.writeJson(filePath, item, { spaces: 2 });
  }

  async exportMusic(format = 'json') {
    const data = {
      artists: Array.from(this.artists.values()),
      albums: Array.from(this.albums.values()),
      songs: Array.from(this.songs.values()),
      playlists: Array.from(this.playlists.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

module.exports = MusicEngine;
