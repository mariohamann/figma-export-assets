const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mkdirp = require('mkdirp');

class FigmaExporter {
  constructor(config) {
    this.config = {
      baseURL: 'https://api.figma.com/v1', // default value
      format: 'svg',
      scale: 1,
      exportVariants: true,
      ...config
    };
    this.figmaClientInstance = this.createFigmaClient(this.config.figmaPersonalToken);
  }

  createFigmaClient(token) {
    const instance = axios.create({ baseURL: this.config.baseURL });
    instance.interceptors.request.use((conf) => {
      conf.headers = {
        'Content-Type': 'application/json',
        'X-Figma-Token': token
      };
      conf.startTime = new Date().getTime();
      return conf;
    });
    return instance;
  }

  async getAssetsFromFigmaFile(figmaClient, fileId, pageName, frameName) {
    const res = await figmaClient.get(`/files/${fileId}`);
    const page = res.data.document.children.find(c => c.name === pageName);
    if (!page) throw new Error('Cannot find Assets Page, check your settings');

    let assetsArray = page.children;
    if (frameName) {
      const frameRoot = page.children.find(c => c.name === frameName);
      if (!frameRoot) throw new Error(`Cannot find ${frameName} Frame in this Page, check your settings`);
      assetsArray = frameRoot.children;
    }

    let assets = assetsArray.flatMap((asset) => {
      if (this.config.exportVariants && asset.children && asset.children.length > 0) {
        return asset.children.map((child) => {
          const variants = child.name.split(',').map((prop) => {
            return prop.trim();
          }).join('--');
          return { id: child.id, name: asset.name + '/' + variants }
        });
      } else {
        return [{ id: asset.id, name: asset.name }]
      }
    });

    assets = this.findDuplicates('name', assets);
    return assets;
  }

  findDuplicates(key, arr) {
    const seen = new Set();
    return arr.filter(item => {
      const value = item[key];
      if (seen.has(value)) {
        console.warn(`Duplicate key value found: ${value}`);
        return false;
      }
      seen.add(value);
      return true;
    });
  }

  async getAssets() {
    return this.getAssetsFromFigmaFile(this.figmaClientInstance, this.config.fileId, this.config.page, this.config.frame);
  }

  async exportAssets(assets, format = 'svg', scale = 1, batchSize = 100) {
    const batches = [];
    for (let i = 0; i < assets.length; i += batchSize) {
      batches.push(assets.slice(i, i + batchSize));
    }

    const results = [];

    for (const batch of batches) {
      const assetIds = batch.map(asset => asset.id).join(',');
      const res = await this.figmaClientInstance.get(`/images/${this.config.fileId}?ids=${assetIds}&format=${format}&scale=${scale}`);

      batch.forEach(asset => {
        asset.image = res.data.images[asset.id];
        asset.format = format;
      });

      results.push(...batch);
    }

    return results;
  }

  async saveAsset(asset, overrideConfig = {}) {
    const finalConfig = { ...this.config, ...overrideConfig };
    const finalName = overrideConfig.name || asset.name;
    const imagePath = path.resolve(finalConfig.assetsPath, `${finalName}.${asset.format}`);

    // Ensure directory exists
    const directory = path.dirname(imagePath);
    if (!fs.existsSync(directory)) {
      mkdirp.sync(directory);
    }

    const writer = fs.createWriteStream(imagePath);

    const response = await axios.get(asset.image, {
      responseType: 'stream',
      headers: {
        'X-Figma-Token': this.config.figmaPersonalToken
      }
    });
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }
}

module.exports = {
  FigmaExporter
};
