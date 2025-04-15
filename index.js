const fs = require('node:fs');
const path = require('node:path');
const axios = require('axios');
const mkdirp = require('mkdirp');

class FigmaExporter {
  /**
   * Creates a FigmaExporter.
   * @param {Object} config - The configuration object for the exporter.
   * @param {string} [config.baseURL='https://api.figma.com/v1'] - The base URL for the Figma API. Optional.
   * @param {string} [config.format='svg'] - The format of the exported assets. Optional.
   * @param {string} config.assetsPath - The path to save the exported assets to. Required.
   * @param {number} [config.scale=1] - The scale at which to export assets. Optional.
   * @param {Object} [config.axiosConfig] - Additional Axios config. Optional.
   * @param {boolean} [config.exportVariants=true] - Whether to export variants of the assets. Optional.
   * @param {string} config.figmaPersonalToken - Personal access token for the Figma API. Required.
   * @param {string} config.fileId - The ID of the Figma file to export assets from. Required.
   * @param {string} config.page - The name of the page to export assets from. Required.
   * @param {string} [config.frame] - The name of the frame to export assets from. Optional.
   *
   * @example
   * const exporter = new FigmaExporter({
   *
   *   // Optional
   *   baseURL: 'https://api.figma.com/v1',
   *   format: 'svg',
   *   scale: 1,
   *   axiosConfig: {},
   *   exportVariants: true,
   *
   *   // Required
   *   figmaPersonalToken: 'your-personal-token',
   *   fileId: 'your-file-id',
   *   page: 'your-page-name',
   *   assetsPath: 'path/to/assets',
   *
   *   // Optional
   *   frame: 'your-frame-name'
   * });
   */
  constructor(config) {
    this.config = {
      baseURL: 'https://api.figma.com/v1',
      format: 'svg',
      scale: 1,
      exportVariants: true,
      ...config
    };
    this.figmaClientInstance = this.createFigmaClient(
      this.config.figmaPersonalToken
    );
  }

  /**
   * Creates an Axios instance for the Figma API.
   *
   * @private
   * @param {string} token - Personal access token for the Figma API.
   */
  createFigmaClient(token) {
    const instance = axios.create({
      ...this.config.axiosConfig,
      baseURL: this.config.baseURL
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

  /**
   * Fetches assets from Figma using the configured settings.
   *
   * @private
   *
   * @param {Object} figmaClient - The Figma API client.
   * @param {string} fileId - The ID of the Figma file to export assets from.
   * @param {string} pageName - The name of the page to export assets from.
   * @param {string} frameName - The name of the frame to export assets from.
   * @returns {Promise<Array>} A promise that resolves to an array of assets.
   *
   */
  async getAssetsFromFigmaFile(figmaClient, fileId, pageName, frameName) {
    const res = await figmaClient.get(`/files/${fileId}`);
    const page = res.data.document.children.find((c) => c.name === pageName);
    if (!page) throw new Error('Cannot find Assets Page, check your settings');

    let assetsArray = page.children;
    if (frameName) {
      const frameRoot = page.children.find((c) => c.name === frameName);
      if (!frameRoot)
        throw new Error(
          `Cannot find ${frameName} Frame in this Page, check your settings`
        );
      assetsArray = frameRoot.children;
    }

    let assets = assetsArray.flatMap((asset) => {
      if (
        this.config.exportVariants &&
        asset.children &&
        asset.children.length > 0
      ) {
        return asset.children.map((child) => {
          const variants = child.name
            .split(',')
            .map((prop) => {
              return prop.trim();
            })
            .join('--');
          return { id: child.id, name: asset.name + '/' + variants };
        });
      } else {
        return [{ id: asset.id, name: asset.name }];
      }
    });

    assets = this.findDuplicates('name', assets);
    return assets;
  }

  /**
   * Filters out duplicate assets.
   *
   * @private
   *
   * @param {string} key - The key to filter by.
   * @param {Array} arr - The array to filter.
   * @returns {Array} The filtered array.
   */
  findDuplicates(key, arr) {
    const seen = new Set();
    return arr.filter((item) => {
      const value = item[key];
      if (seen.has(value)) {
        console.warn(`Duplicate key value found: ${value}`);
        return false;
      }
      seen.add(value);
      return true;
    });
  }

  /**
   * Fetches assets from Figma using the configured settings.
   * @returns {Promise<Array>} A promise that resolves to an array of assets.
   */
  async getAssets() {
    return this.getAssetsFromFigmaFile(
      this.figmaClientInstance,
      this.config.fileId,
      this.config.page,
      this.config.frame
    );
  }

  /**
   * Exports assets from Figma in batches.
   * @param {Array} assets - The assets to export.
   * @param {string} [format='svg'] - The format to export the assets in.
   * @param {number} [scale=1] - The scale at which to export the assets.
   * @param {number} [batchSize=100] - The number of assets to export in each batch.
   * @returns {Promise<Array>} A promise that resolves to an array of exported assets.
   */
  async exportAssets(assets, format = 'svg', scale = 1, batchSize = 100) {
    const batches = [];
    for (let i = 0; i < assets.length; i += batchSize) {
      batches.push(assets.slice(i, i + batchSize));
    }

    const results = [];

    for (const batch of batches) {
      const assetIds = batch.map((asset) => asset.id).join(',');
      const res = await this.figmaClientInstance.get(
        `/images/${this.config.fileId}?ids=${assetIds}&format=${format}&scale=${scale}`
      );

      batch.forEach((asset) => {
        asset.image = res.data.images[asset.id];
        asset.format = format;
      });

      results.push(...batch);
    }

    return results;
  }

  /**
   * Saves assets to the configured assets path.
   * @param {Object} asset - The assets to save.
   * @param {Object} [overrideConfig] - Overrides for the exporter config.
   * @param {string} [overrideConfig.name] - Overrides the name of the asset.
   * @param {string} [overrideConfig.format='svg'] - The format of the exported assets. Optional.
   * @param {string} [overrideConfig.assetsPath] - The path to save the exported assets to. Optional.
   * @param {number} [overrideConfig.scale=1] - The scale at which to export assets. Optional.
   * @returns {Promise} A promise that resolves when all assets have been saved.
   */

  async saveAsset(asset, overrideConfig = {}) {
    const finalConfig = { ...this.config, ...overrideConfig };
    const finalName = overrideConfig.name || asset.name;
    const imagePath = path.resolve(
      finalConfig.assetsPath,
      `${finalName}.${asset.format}`
    );

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
