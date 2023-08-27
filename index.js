const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mkdirp = require('mkdirp');

const figmaApiBase = 'https://api.figma.com/v1';

const figma = (token) => {
  const instance = axios.create({
    baseURL: figmaApiBase
  });
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
  for (let file of files) {
    const filePath = path.join(directory, file);
    if (fs.lstatSync(filePath).isDirectory()) {
      await deleteIcons(filePath); // Recursive call
    } else {
      fs.unlinkSync(filePath);
    }
  }
  fs.rmdirSync(directory);
}

async function getAllIcons(config) {
  const figmaClientInstance = figma(config.figmaPersonalToken);
  return getFigmaFile(figmaClientInstance, config.fileId, config.page, config.frame);
}

async function downloadIcon(icon, config) {
  const figmaClientInstance = figma(config.figmaPersonalToken);
  const icons = await getImages(figmaClientInstance, config, [icon]);
  await Promise.all(icons.map(i => downloadImage(i.image, i.name, config.iconsPath, config)));
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

  return iconsArray.map((icon) => ({ id: icon.id, name: icon.name }));
}

async function getImages(figmaClient, config, icons) {
  const iconIds = icons.map(icon => icon.id).join(',');
  const res = await figmaClient.get(`/images/${config.fileId}?ids=${iconIds}&format=${config.format || 'svg'}&scale=${config.scale || 1}`);
  icons.forEach(icon => icon.image = res.data.images[icon.id]);
  return icons;
}

async function downloadImage(url, name, iconsPath, config) {
  const finalName = config.name || name; // Use the name in config if provided, else use the original name
  const imagePath = path.resolve(iconsPath, `${finalName}.${config.format}`);
  const writer = fs.createWriteStream(imagePath);
  const response = await axios.get(url, { responseType: 'stream' });
  response.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

module.exports = {
  createOutputDirectory,
  deleteIcons,
  getAllIcons,
  downloadIcon
};
