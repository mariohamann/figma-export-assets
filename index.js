const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mkdirp = require('mkdirp');

{
  const figmaApiBase = 'https://api.figma.com/v1';

  const figma = (token) => {
    const instance = axios.create({ baseURL: figmaApiBase });
    instance.interceptors.request.use((conf) => {
      conf.headers = {
        'Content-Type': 'application/json',
        'X-Figma-Token': token
      };
      return conf;
    });
    return instance;
  };

  function createOutputDirectory(iconsPath) {
    const directory = path.resolve(iconsPath);
    if (!fs.existsSync(directory)) {
      mkdirp.sync(directory);
    }
  }

  async function deleteIcons(iconsPath) {
    const directory = path.resolve(iconsPath);
    const files = fs.readdirSync(directory);
    const filesToDelete = [];
    const subdirectories = [];

    for (let file of files) {
      const filePath = path.join(directory, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        const subFiles = fs.readdirSync(filePath);
        filesToDelete.push(...subFiles.map(subFile => path.join(filePath, subFile)));
        subdirectories.push(filePath);
      } else if (file !== 'README.md') {
        filesToDelete.push(filePath);
      }
    }

    filesToDelete.forEach(fs.unlinkSync);
    subdirectories.forEach(fs.rmdirSync);
  }

  async function getFigmaFile(figmaClient, fileId, pageName, frameName) {
    const res = await figmaClient.get(`/files/${fileId}`);
    const page = res.data.document.children.find(c => c.name === pageName);
    if (!page) throw new Error('Cannot find Icons Page, check your settings');

    let iconsArray = page.children;
    if (frameName) {
      const frame = page.children.find(c => c.name === frameName);
      if (!frame) throw new Error(`Cannot find ${frameName} Frame in this Page, check your settings`);
      iconsArray = frame.children;
    }
    return iconsArray.map(icon => ({ id: icon.id, name: icon.name }));
  }

  async function getImages(figmaClient, config, icons) {
    const iconIds = icons.map(icon => icon.id).join(',');
    const res = await figmaClient.get(`/images/${config.fileId}?ids=${iconIds}&format=${config.format}&scale=${config.scale}`);
    icons.forEach(icon => icon.image = res.data.images[icon.id]);
    return icons;
  }

  async function downloadImage(url, name, iconsPath, config, removeFromName = '') {
    const nameClean = name.replace(new RegExp(removeFromName, 'g'), '');
    const suffix = config.scale == 1 ? '' : `@${config.scale}x`;
    const imagePath = path.resolve(iconsPath, `${nameClean}${suffix}.${config.format}`);
    const writer = fs.createWriteStream(imagePath);
    const response = await axios.get(url, { responseType: 'stream' });
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', () => resolve({
        name: `${name}.${config.format}`,
        size: fs.statSync(imagePath).size
      }));
      writer.on('error', reject);
    });
  }

  async function exportIcons(config) {
    createOutputDirectory(config.iconsPath);
    await deleteIcons(config.iconsPath);
    const figmaClientInstance = figma(config.figmaPersonalToken);
    const icons = await getFigmaFile(figmaClientInstance, config.fileId, config.page, config.frame);
    const iconsWithImages = await getImages(figmaClientInstance, config, icons);
    await Promise.all(iconsWithImages.map(icon => downloadImage(icon.image, icon.name, config.iconsPath, config, config.removeFromName)));
  }

  module.exports = {
    exportIcons
  };

  module.exports = {
    exportIcons
  };
}
