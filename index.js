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

  async function getImages(figmaClient, fileId, icons) {
    const iconIds = icons.map(icon => icon.id).join(',');
    const res = await figmaClient.get(`/images/${fileId}?ids=${iconIds}&format=svg`);
    icons.forEach(icon => icon.image = res.data.images[icon.id]);
    return icons;
  }

  async function downloadImage(url, name, iconsPath, removeFromName = '') {
    const nameClean = name.replace(new RegExp(removeFromName, 'g'), '');
    const filePath = path.resolve(iconsPath, `${nameClean}.svg`);
    const writer = fs.createWriteStream(filePath);
    const response = await axios.get(url, { responseType: 'stream' });
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  async function exportIcons(config) {
    createOutputDirectory(config.iconsPath);
    await deleteIcons(config.iconsPath);
    const figmaClientInstance = figma(config.figmaPersonalToken);
    const icons = await getFigmaFile(figmaClientInstance, config.fileId, config.page, config.frame);
    const iconsWithImages = await getImages(figmaClientInstance, config.fileId, icons);
    await Promise.all(iconsWithImages.map(icon => downloadImage(icon.image, icon.name, config.iconsPath, config.removeFromName)));
  }

  module.exports = {
    exportIcons
  };
}
