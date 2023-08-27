const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mkdirp = require('mkdirp');

class FigmaExporter {
  constructor(config) {
    this.config = config;
    this.figmaClientInstance = this.figma(this.config.figmaPersonalToken);
  }

  figma(token) {
    const instance = axios.create({
      baseURL: 'https://api.figma.com/v1'
    });
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

  createOutputDirectory(iconsPath) {
    const directory = path.resolve(iconsPath);
    if (!fs.existsSync(directory)) {
      mkdirp.sync(directory);
    }
  }

  async deleteIcons(iconsPath) {
    const directory = path.resolve(iconsPath);
    const files = fs.readdirSync(directory);
    for (let file of files) {
      const filePath = path.join(directory, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        await this.deleteIcons(filePath); // Recursive call
      } else {
        fs.unlinkSync(filePath);
      }
    }
    fs.rmdirSync(directory);
  }

  async getAllIcons() {
    return this.getFigmaFile(this.figmaClientInstance, this.config.fileId, this.config.page, this.config.frame)
      .then((icons) => this.getImages(this.figmaClientInstance, this.config, icons));
  }

  async downloadIcon(icon, overrideConfig = {}) {
    const finalConfig = { ...this.config, ...overrideConfig };
    const finalName = overrideConfig.name || icon.name;
    const url = icon.image;
    const imagePath = path.resolve(finalConfig.iconsPath, `${finalName}.${finalConfig.format}`);
    const writer = fs.createWriteStream(imagePath);
    const response = await axios.get(url, { responseType: 'stream' });
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  async getFigmaFile(figmaClient, fileId, pageName, frameName) {
    const res = await figmaClient.get(`/files/${fileId}`);
    const page = res.data.document.children.find(c => c.name === pageName);
    if (!page) throw new Error('Cannot find Icons Page, check your settings');

    let iconsArray = page.children;
    if (frameName) {
      const frame = page.children.find(c => c.name === frameName);
      if (!frame) throw new Error(`Cannot find ${frameName} Frame in this Page, check your settings`);
      iconsArray = frame.children;
    }

    return iconsArray.map((icon) => ({ id: icon.id, name: icon.name }));
  }

  async getImages(figmaClient, config, icons) {
    const iconIds = icons.map(icon => icon.id).join(',');
    const res = await figmaClient.get(`/images/${config.fileId}?ids=${iconIds}&format=${config.format || 'svg'}&scale=${config.scale || 1}`);
    icons.forEach(icon => icon.image = res.data.images[icon.id]);
    return icons;
  }

  async downloadImage(url, name, iconsPath, config) {
    const finalName = config.name || name;
    const imagePath = path.resolve(iconsPath, `${finalName}.${config.format}`);
    const writer = fs.createWriteStream(imagePath);
    const response = await axios.get(url, { responseType: 'stream' });
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }
}

module.exports = {
  FigmaExporter
};
