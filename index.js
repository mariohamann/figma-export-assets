import fs from "node:fs";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { join } from "node:path";
import { Readable } from "node:stream";
import { mkdirp } from "mkdirp";
import pLimit from "p-limit";

/**
 * @typedef {Object} Config
 * @property {string} figmaPersonalToken - Personal access token for the Figma API.
 * @property {string} fileId - The ID of the Figma file to export assets from.
 * @property {string} page - The name of the page to export assets from.
 * @property {string} assetsPath - The path to save the exported assets.
 * @property {string} [format='svg'] - The format of the exported assets.
 * @property {number} [scale=1] - The scale at which to export assets.
 * @property {boolean} [exportVariants=true] - Whether to export variants of the assets.
 * @property {string} [frame] - The name of the frame to export assets from.
 * @property {number} [depth] - Maximum number of nested levels to traverse in the Figma file.
 *   See [Figma API docs](https://developers.figma.com/docs/rest-api/file-endpoints/#get-files-endpoint) 
 *   for more details.
 * @property {number} [batchSize=100] - The number of assets to export in each batch.
 * @property {number} [concurrencyLimit=5] - The maximum number of concurrent requests.
 * @property {boolean} [skipExistingFiles=false] - Whether to skip existing files.
*/

/**
 * @typedef {Object} Asset
 * @property {string} id - The ID of the asset.
 * @property {string} name - The name of the asset.
 * @property {string} [url] - The URL of the asset image.
 * @property {string} [assetsPath] - The path to save the asset.
 */

export default class FigmaExporter {
  /**
   * Creates a FigmaExporter.
   * @param {Config} config
   *
   * @property {Array<Asset>} assets - The array of assets to be exported.
   *
   * @example
   * const exporter = new FigmaExporter({
   *
   *   // Optional
   *   baseURL: 'https://api.figma.com/v1',
   *   format: 'svg',
   *   scale: 1,
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
      baseURL: "https://api.figma.com",
      format: "svg",
      scale: 1,
      exportVariants: true,
      batchSize: 100,
      concurrencyLimit: 5,
      ...config,
    };
    this.assets = [];
  }

  /**
   * Makes a `GET` request to the Figma API
   *
   * @private
   * @param {string} endpoint - API endpoint
   * @param {Object} [params] - Query parameters
   * @returns {Promise<any>} Parsed JSON response
   */
  async figmaGet(endpoint, params = {}) {
    const url = new URL(endpoint, this.config.baseURL);

    // Add query parameters if any
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Figma-Token": this.config.figmaPersonalToken,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error with status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Sets the assets by fetching them from the Figma API.
   *
   * @returns {Promise<FigmaExporter>} The FigmaExporter instance.
   */
  async setAssets() {
    const res = await this.figmaGet(`v1/files/${this.config.fileId}`, {
      depth: this.config.depth,
    });

    const page = res.document.children.find(
      (c) => c.name === this.config.page
    );

    if (!page)
      throw new Error(`Cannot find page "${this.config.page}", check your settings`);

    let assetsArray = page.children;
    if (this.config.frame) {
      const frameRoot = page.children.find(
        (c) => c.name === this.config.frame
      );
      if (!frameRoot)
        throw new Error(
          `Cannot find ${this.config.frame} Frame in this Page, check your settings`
        );
      assetsArray = frameRoot.children;
    }

    const assets = assetsArray.flatMap((asset) => {
      if (!this.config.exportVariants || !asset.children?.length) {
        return [
          {
            id: asset.id,
            name: asset.name,
          },
        ];
      }

      return asset.children.map((child) => {
        const variants = child.name
          .split(",")
          .map((prop) => prop.trim())
          .join("--");
        return {
          id: child.id,
          name: `${asset.name}/${variants}`,
        };
      });
    });

    const findDuplicates = (key, arr) => {
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
    };

    this.assets = findDuplicates("name", assets);

    return this;
  }

  async processAssets(config = this.config, assets = this.assets) {
    // Export step
    for (let i = 0; i < assets.length; i += config.batchSize) {
      const batch = assets.slice(i, i + config.batchSize);
      const assetIds = batch.map((a) => a.id).join(",");

      const res = await this.figmaGet(`v1/images/${config.fileId}`, {
        ids: assetIds,
        format: config.format,
        scale: config.scale
      });

      batch.forEach((asset) => {
        asset.url = res.images[asset.id];
      });
    }

    // Save step
    const limit = pLimit(config.concurrencyLimit);
    const tasks = assets
      .filter((asset) => asset.url)
      .map((asset) =>
        limit(async () => {
          const fileName = `${asset.name}.${config.format}`;
          const filePath = path.resolve(config.assetsPath, fileName);
          const dir = path.dirname(filePath);

          if (!fs.existsSync(dir)) mkdirp.sync(dir);

          const res = await fetch(asset.url, {
            headers: { "X-Figma-Token": config.figmaPersonalToken },
          });

          if (!res.ok) {
            console.warn(`Download failed: ${fileName} – ${res.status}`);
            return;
          }

          const buffer = await res.arrayBuffer();
          const readable = Readable.from(Buffer.from(buffer));
          const writer = fs.createWriteStream(filePath);

          return new Promise((resolve, reject) => {
            readable.pipe(writer);
            writer.on("finish", resolve);
            writer.on("error", reject);
          });
        })
      );

    await Promise.allSettled(tasks);
  }

  /** 
   * Creates assets by asking the Figma API for the assets and saving them to the specified path.
   *
   * @param {function} [assetTransformFn] - Callback function to transform the asset names.
   * @param {Object} [configOverrides] - Overrides for the default configuration.
   * @returns {Promise<FigmaExporter>} The FigmaExporter instance.
   */
  async createAssets(assetTransformFn = (assets) => assets, configOverrides = {}) {
    const config = { ...this.config, ...configOverrides };
    const assetsIncludingAssetsPath = this.assets.map((asset) => ({
      ...asset,
      assetsPath: config.assetsPath,
    }));
    let assets = assetTransformFn([...assetsIncludingAssetsPath]);

    function getAllFilesRecursively(dir, rootDir = dir) {
      const files = new Set();

      for (const item of readdirSync(dir)) {
        const fullPath = join(dir, item);
        const relativePath = path.relative(rootDir, fullPath);
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          for (const sub of getAllFilesRecursively(fullPath, rootDir)) {
            files.add(sub);
          }
        } else {
          files.add(relativePath);
        }
      }

      return files;
    }


    if (config.skipExistingFiles) {
      let skipped = 0;

      const existingFiles = getAllFilesRecursively(config.assetsPath);

      assets = assets.filter((asset) => {
        const fileName = `${asset.name}.${config.format}`;
        const relativePath = path.normalize(fileName);

        const isDuplicate = existingFiles.has(relativePath);
        if (isDuplicate) {
          skipped++;
        }
        return !isDuplicate;
      });

      if (skipped > 0) {
        console.warn(
          `Skipped: ${skipped}`
        );
      }
    }

    try {
      await this.processAssets(config, assets);
    } catch (err) {
      console.error("createAssets() failed:", err);
    }

    return this;
  }
}
