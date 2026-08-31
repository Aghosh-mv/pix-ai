const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class MarkdownImageEngine {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.images = new Map();
    this.albums = new Map();
    this.imageDir = path.join(os.homedir(), '.pix/markdown-images');
  }

  async initialize() {
    this.logger.info('Initializing Markdown Image Engine...');
    await fs.ensureDir(this.imageDir);
    await this.loadImages();
    this.loadImageTypes();
    this.logger.info('Markdown Image Engine initialized');
  }

  async loadImages() {
    try {
      const files = await fs.readdir(this.imageDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readJson(path.join(this.imageDir, file));
          if (data.type === 'image') this.images.set(data.id, data);
          else if (data.type === 'album') this.albums.set(data.id, data);
        }
      }
    } catch (e) {}
  }

  loadImageTypes() {
    this.imageTypes = [
      { id: 'local', name: 'Local Image', syntax: '![alt](./path/to/image.png)', icon: '📁' },
      { id: 'remote', name: 'Remote Image', syntax: '![alt](https://example.com/image.png)', icon: '🌐' },
      { id: 'base64', name: 'Base64 Image', syntax: '![alt](data:image/png;base64,...)', icon: '💾' },
      { id: 'relative', name: 'Relative Path', syntax: '![alt](../images/image.png)', icon: '📂' },
      { id: 'absolute', name: 'Absolute Path', syntax: '![alt](/images/image.png)', icon: '📍' }
    ];
  }

  async createImage(params) {
    const {
      name,
      url,
      alt = '',
      title = '',
      width = null,
      height = null,
      type = 'remote',
      albumId = null,
      tags = []
    } = params;

    const id = uuidv4();
    const image = {
      id,
      name,
      url,
      alt,
      title,
      width,
      height,
      type,
      albumId,
      tags,
      usageCount: 0,
      lastUsed: null,
      type: 'image',
      createdAt: new Date().toISOString()
    };

    this.images.set(id, image);

    if (albumId) {
      const album = this.albums.get(albumId);
      if (album) {
        album.imageIds.push(id);
      }
    }

    return image;
  }

  async updateImage(id, updates) {
    const image = this.images.get(id);
    if (!image) throw new Error(`Image not found: ${id}`);

    const updated = { ...image, ...updates };
    this.images.set(id, updated);
    return updated;
  }

  async deleteImage(id) {
    const image = this.images.get(id);
    if (image && image.albumId) {
      const album = this.albums.get(image.albumId);
      if (album) {
        album.imageIds = album.imageIds.filter(iid => iid !== id);
      }
    }

    this.images.delete(id);
    return { success: true };
  }

  async getImage(id) {
    const image = this.images.get(id);
    if (!image) throw new Error(`Image not found: ${id}`);

    image.usageCount = (image.usageCount || 0) + 1;
    image.lastUsed = new Date().toISOString();
    this.images.set(id, image);

    return image;
  }

  listImages(options = {}) {
    const { type, albumId, tags, search } = options;
    let images = Array.from(this.images.values());

    if (type) images = images.filter(i => i.type === type);
    if (albumId) images = images.filter(i => i.albumId === albumId);
    if (tags && tags.length > 0) {
      images = images.filter(i => tags.some(t => i.tags.includes(t)));
    }
    if (search) {
      const searchLower = search.toLowerCase();
      images = images.filter(i =>
        i.name.toLowerCase().includes(searchLower) ||
        i.alt.toLowerCase().includes(searchLower) ||
        i.url.toLowerCase().includes(searchLower)
      );
    }

    return images.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  generateMarkdown(image, options = {}) {
    const { size = null, alignment = null, caption = null } = options;

    let md = '![';

    if (image.alt) md += image.alt;
    else if (image.name) md += image.name;

    md += '](';
    md += image.url;

    if (image.title) {
      md += ` "${image.title}"`;
    }

    md += ')';

    if (size) {
      md = md.replace('](', ` =${size}x](`);
    }

    if (caption) {
      md += `\n\n*${caption}*`;
    }

    return md;
  }

  generateHTML(image, options = {}) {
    const { maxWidth = '100%', alignment = 'left', className = '' } = options;

    let html = `<img src="${image.url}" alt="${image.alt || image.name}"`;

    if (image.title) html += ` title="${image.title}"`;
    if (image.width) html += ` width="${image.width}"`;
    if (image.height) html += ` height="${image.height}"`;
    if (className) html += ` class="${className}"`;

    html += ' style="max-width: ' + maxWidth + ';"';
    html += ' loading="lazy"';

    return html;
  }

  async createAlbum(params) {
    const { name, description = '', imageIds = [] } = params;
    const id = uuidv4();

    const album = {
      id,
      name,
      description,
      imageIds,
      type: 'album',
      createdAt: new Date().toISOString()
    };

    this.albums.set(id, album);
    return album;
  }

  async updateAlbum(id, updates) {
    const album = this.albums.get(id);
    if (!album) throw new Error(`Album not found: ${id}`);

    const updated = { ...album, ...updates };
    this.albums.set(id, updated);
    return updated;
  }

  async deleteAlbum(id) {
    this.albums.delete(id);
    return { success: true };
  }

  async getAlbum(id) {
    const album = this.albums.get(id);
    if (!album) throw new Error(`Album not found: ${id}`);

    const images = album.imageIds.map(iid => this.images.get(iid)).filter(Boolean);
    return { ...album, images };
  }

  listAlbums() {
    return Array.from(this.albums.values());
  }

  async addToAlbum(albumId, imageId) {
    const album = this.albums.get(albumId);
    if (!album) throw new Error(`Album not found: ${albumId}`);

    const image = this.images.get(imageId);
    if (!image) throw new Error(`Image not found: ${imageId}`);

    if (!album.imageIds.includes(imageId)) {
      album.imageIds.push(imageId);
    }

    image.albumId = albumId;
    this.images.set(imageId, image);

    return album;
  }

  async removeFromAlbum(albumId, imageId) {
    const album = this.albums.get(albumId);
    if (!album) throw new Error(`Album not found: ${albumId}`);

    album.imageIds = album.imageIds.filter(iid => iid !== imageId);

    const image = this.images.get(imageId);
    if (image) {
      image.albumId = null;
      this.images.set(imageId, image);
    }

    return album;
  }

  async searchImages(query) {
    const results = [];
    const queryLower = query.toLowerCase();

    for (const [, image] of this.images) {
      let score = 0;

      if (image.name.toLowerCase().includes(queryLower)) score += 10;
      if (image.alt.toLowerCase().includes(queryLower)) score += 5;
      if (image.url.toLowerCase().includes(queryLower)) score += 3;
      if (image.tags.some(t => t.toLowerCase().includes(queryLower))) score += 2;

      if (score > 0) {
        results.push({ ...image, score });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  async getMostUsed(limit = 10) {
    return Array.from(this.images.values())
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, limit);
  }

  getImageTypes() {
    return this.imageTypes;
  }

  async getStats() {
    const images = Array.from(this.images.values());

    return {
      total: images.length,
      albums: this.albums.size,
      totalUsage: images.reduce((sum, i) => sum + (i.usageCount || 0), 0),
      byType: this.getImagesByType()
    };
  }

  getImagesByType() {
    const images = Array.from(this.images.values());
    const byType = {};

    for (const image of images) {
      byType[image.type] = (byType[image.type] || 0) + 1;
    }

    return byType;
  }

  async exportImages(format = 'json') {
    const data = {
      images: Array.from(this.images.values()),
      albums: Array.from(this.albums.values())
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    if (format === 'markdown') {
      return Array.from(this.images.values())
        .map(img => this.generateMarkdown(img))
        .join('\n\n');
    }

    return data;
  }
}

module.exports = MarkdownImageEngine;
