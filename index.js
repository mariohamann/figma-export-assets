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
    if (!page) throw new Error('Cannot find Icons Page, check your settings');

    let iconsArray = page.children;
    if (frameName) {
      const frameRoot = page.children.find(c => c.name === frameName);
      if (!frameRoot) throw new Error(`Cannot find ${frameName} Frame in this Page, check your settings`);
      iconsArray = frameRoot.children;
    }

    let icons = iconsArray.flatMap((icon) => {
      if (this.config.exportVariants && icon.children && icon.children.length > 0) {
        return icon.children.map((child) => {
          const variants = child.name.split(',').map((prop) => {
            return prop.trim();
          }).join('--');
          return { id: child.id, name: icon.name + '/' + variants }
        });
      } else {
        return [{ id: icon.id, name: icon.name }]
      }
    });

    icons = this.findDuplicates('name', icons);
    return icons;
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

  async exportAssets(icons, format, scale) {
    const iconIds = icons.map(icon => icon.id).join(',');
    const res = await this.figmaClientInstance.get(`/images/${this.config.fileId}?ids=${iconIds}&format=${format || 'svg'}&scale=${scale || 1}`);
    icons.forEach(icon => {
      icon.image = res.data.images[icon.id];
      icon.format = format || 'svg';
    });

    return icons;
  }

  async saveAsset(icon, overrideConfig = {}) {
    const finalConfig = { ...this.config, ...overrideConfig };
    const finalName = overrideConfig.name || icon.name;
    const imagePath = path.resolve(finalConfig.iconsPath, `${finalName}.${icon.format}`);
    const writer = fs.createWriteStream(imagePath);

    const response = await axios.get(icon.image, {
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
